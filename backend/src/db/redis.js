// M3 - Nguyễn Anh Quân: Tầng Redis cache cho dữ liệu đọc (catalog, tổng hợp tồn kho).
// Truy vết: NFR-PER-01, NFR-PER-06, BR-12.
//
// Nguyên tắc bắt buộc:
// 1. Redis CHỈ dùng để cache dữ liệu đọc; TUYỆT ĐỐI KHÔNG dùng để quyết định reserve/checkout.
//    PostgreSQL là nguồn sự thật duy nhất (Single Source of Truth).
// 2. Khi Redis tắt hoặc gặp sự cố mạng, các hàm tự động fallback sang đọc DB trực tiếp (fail-open
//    cho cache đọc, không làm gián đoạn hệ thống).
// 3. Sau mỗi transaction làm thay đổi tồn kho hoặc sản phẩm (SAU KHI COMMIT), service gọi
//    invalidateInventoryCache() hoặc invalidateProductCache() để xóa các key liên quan.

import Redis from 'ioredis'

export const CachePrefix = Object.freeze({
    CATALOG_LIST: 'mw:catalog:list:',
    CATALOG_DETAIL: 'mw:catalog:detail:',
    INVENTORY_SUMMARY: 'mw:inv:summary',
    INVENTORY_BY_WAREHOUSE: 'mw:inv:wh:',
    INVENTORY_BY_PRODUCT: 'mw:inv:prod:',
})

export function loadCacheConfig(env = globalThis.process?.env ?? {}) {
    const enabled = env.REDIS_ENABLED !== 'false' && Boolean(env.REDIS_URL)
    const catalogTtl = Number(env.CACHE_TTL_CATALOG_SECONDS ?? 60)
    const inventoryTtl = Number(env.CACHE_TTL_INVENTORY_SECONDS ?? 15)

    return Object.freeze({
        enabled,
        redisUrl: env.REDIS_URL ?? 'redis://localhost:6379',
        catalogTtlSeconds: Number.isInteger(catalogTtl) && catalogTtl > 0 ? catalogTtl : 60,
        inventoryTtlSeconds: Number.isInteger(inventoryTtl) && inventoryTtl > 0 ? inventoryTtl : 15,
    })
}

// ---------------------------------------------------------------------------
// Cache store (Redis thật hoặc In-memory dùng cho môi trường không bật Redis / test)
// ---------------------------------------------------------------------------

export function createMemoryCacheStore() {
    const entries = new Map()

    function isExpired(entry) {
        return entry.expiresAt !== null && Date.now() >= entry.expiresAt
    }

    return {
        async get(key) {
            const entry = entries.get(key)
            if (!entry) return null
            if (isExpired(entry)) {
                entries.delete(key)
                return null
            }
            return entry.value
        },
        async set(key, value, ttlSeconds) {
            const expiresAt = ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : null
            entries.set(key, { value, expiresAt })
        },
        async del(...keys) {
            let deleted = 0
            for (const key of keys.flat()) {
                if (entries.delete(key)) deleted += 1
            }
            return deleted
        },
        async delByPrefix(prefix) {
            let deleted = 0
            for (const key of [...entries.keys()]) {
                if (key.startsWith(prefix)) {
                    entries.delete(key)
                    deleted += 1
                }
            }
            return deleted
        },
        async disconnect() {
            entries.clear()
        },
    }
}

export function createRedisCacheStore(redisClient) {
    return {
        async get(key) {
            return redisClient.get(key)
        },
        async set(key, value, ttlSeconds) {
            if (ttlSeconds > 0) {
                await redisClient.set(key, value, 'EX', ttlSeconds)
            } else {
                await redisClient.set(key, value)
            }
        },
        async del(...keys) {
            const flat = keys.flat().filter(Boolean)
            if (flat.length === 0) return 0
            return redisClient.del(...flat)
        },
        async delByPrefix(prefix) {
            let cursor = '0'
            let deleted = 0
            do {
                const [nextCursor, foundKeys] = await redisClient.scan(
                    cursor,
                    'MATCH',
                    `${prefix}*`,
                    'COUNT',
                    100
                )
                cursor = nextCursor
                if (foundKeys.length > 0) {
                    deleted += await redisClient.del(...foundKeys)
                }
            } while (cursor !== '0')
            return deleted
        },
        async disconnect() {
            await redisClient.quit()
        },
    }
}

let defaultStore = null

export function getDefaultCacheStore(env = globalThis.process?.env ?? {}) {
    if (defaultStore) {
        return defaultStore
    }

    const config = loadCacheConfig(env)

    if (!config.enabled) {
        defaultStore = createMemoryCacheStore()
        return defaultStore
    }

    const client = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
    })

    // Không để lỗi kết nối Redis làm crash tiến trình Node.
    client.on('error', () => {})

    defaultStore = createRedisCacheStore(client)
    return defaultStore
}

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

export const CacheKeys = Object.freeze({
    catalogList({ search = '', category = '', page = 1, limit = 20 } = {}) {
        const normalizedSearch = String(search).trim().toLowerCase()
        const normalizedCategory = String(category).trim().toLowerCase()
        return `${CachePrefix.CATALOG_LIST}q=${encodeURIComponent(normalizedSearch)}:c=${encodeURIComponent(normalizedCategory)}:p=${page}:l=${limit}`
    },
    catalogDetail(productId) {
        return `${CachePrefix.CATALOG_DETAIL}${productId}`
    },
    inventorySummary() {
        return CachePrefix.INVENTORY_SUMMARY
    },
    inventoryByWarehouse(warehouseId) {
        return `${CachePrefix.INVENTORY_BY_WAREHOUSE}${warehouseId}`
    },
    inventoryByProduct(productId) {
        return `${CachePrefix.INVENTORY_BY_PRODUCT}${productId}`
    },
})

// ---------------------------------------------------------------------------
// Cache-aside helper & Invalidation
// ---------------------------------------------------------------------------

/**
 * Đọc qua cache (cache-aside):
 * - Nếu trúng cache → trả dữ liệu đã parse.
 * - Nếu trượt hoặc lỗi Redis → gọi `loader()` lấy từ PostgreSQL rồi lưu lại với `ttlSeconds`.
 * KHÔNG bao giờ dùng hàm này cho bước kiểm kho/giữ hàng trong checkout!
 */
export async function getOrSetCache(key, ttlSeconds, loader, { store = getDefaultCacheStore() } = {}) {
    if (typeof loader !== 'function') {
        throw new TypeError('loader phải là hàm tải dữ liệu từ PostgreSQL.')
    }

    try {
        const cached = await store.get(key)
        if (cached !== null && cached !== undefined) {
            return JSON.parse(cached)
        }
    } catch {
        // Lỗi Redis hoặc JSON hỏng → bỏ qua cache, đọc thẳng PostgreSQL.
    }

    const freshData = await loader()

    if (freshData !== undefined) {
        try {
            await store.set(key, JSON.stringify(freshData), ttlSeconds)
        } catch {
            // Không làm hỏng request nếu ghi cache thất bại.
        }
    }

    return freshData
}

/**
 * Xóa cache tồn kho và chi tiết/danh sách sản phẩm bị ảnh hưởng sau khi reserve/release/consume/restore/restock.
 * Nhận `affected = { warehouseIds, productIds }` trả về từ các hàm ghi trong `inventory.repository.js`.
 */
export async function invalidateInventoryCache(
    { warehouseIds = [], productIds = [] } = {},
    { store = getDefaultCacheStore() } = {}
) {
    const keysToDelete = [
        CacheKeys.inventorySummary(),
        ...warehouseIds.map((id) => CacheKeys.inventoryByWarehouse(id)),
        ...productIds.map((id) => CacheKeys.inventoryByProduct(id)),
        ...productIds.map((id) => CacheKeys.catalogDetail(id)),
    ]

    try {
        await store.del(keysToDelete)
        // Danh sách catalog có kèm trạng thái inStock nên cũng cần làm mới.
        await store.delByPrefix(CachePrefix.CATALOG_LIST)
    } catch {
        // Lỗi mạng Redis không được làm thất bại thao tác DB đã commit.
    }
}

/**
 * Xóa cache sản phẩm khi Admin thêm/sửa/ngừng kinh doanh sản phẩm (UC07 – SR-PROD-01..03).
 */
export async function invalidateProductCache(
    { productIds = [] } = {},
    { store = getDefaultCacheStore() } = {}
) {
    try {
        if (productIds.length > 0) {
            await store.del(
                productIds.flatMap((id) => [
                    CacheKeys.catalogDetail(id),
                    CacheKeys.inventoryByProduct(id),
                ])
            )
        }
        await store.del(CacheKeys.inventorySummary())
        await store.delByPrefix(CachePrefix.CATALOG_LIST)
    } catch {
        // Bỏ qua lỗi cache.
    }
}
