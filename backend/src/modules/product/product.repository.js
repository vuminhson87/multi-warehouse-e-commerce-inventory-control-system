// M3 - Nguyễn Anh Quân: Tầng lưu trữ sản phẩm (Catalog & Admin Product Management).
// Truy vết: SR-CAT-01..03, SR-PROD-01..03, SR-ORD-01, SR-HIS-02, NFR-PER-01, NFR-SEC-07.
//
// Nguyên tắc:
// - Danh mục khách xem (listActiveProducts) chỉ trả sản phẩm `isActive = true` (SR-CAT-01)
//   và kèm tổng `available` / `inStock` từ các kho (SR-CAT-03).
// - Admin ngừng kinh doanh (discontinueProduct) chỉ đặt `isActive = false`, KHÔNG xóa bản ghi
//   để lịch sử đơn hàng còn nguyên vẹn (SR-PROD-03).
// - Khi checkout, M2 dùng `findActiveProductsForCheckout` để lấy tên/giá chuẩn từ PostgreSQL
//   tạo snapshot vào `order_items`, không bao giờ tin tên/giá do frontend gửi lên.

import { getAvailableByProduct } from '../inventory/inventory.repository.js'
import { SEED_WAREHOUSES } from '../../../prisma/seed-data.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'

function mapProduct(row, available = 0) {
    return {
        id: row.id,
        sku: row.sku,
        name: row.name,
        category: row.category,
        price: Number(row.price),
        description: row.description,
        imageUrl: row.imageUrl ?? null,
        isActive: row.isActive,
        discontinuedAt: row.discontinuedAt ?? null,
        available,
        inStock: row.isActive && available > 0,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    }
}

function assertPositivePrice(price, field = 'price') {
    const num = typeof price === 'string' ? Number(price) : price
    if (typeof num !== 'number' || !Number.isFinite(num) || num <= 0) {
        throw validationError([{ field, reason: 'Giá sản phẩm phải là số dương.' }])
    }
    return num
}

function assertNonEmptyString(value, field, maxLength = 200) {
    if (typeof value !== 'string' || value.trim().length === 0 || value.trim().length > maxLength) {
        throw validationError([
            { field, reason: `Không được để trống và tối đa ${maxLength} ký tự.` },
        ])
    }
    return value.trim()
}

/**
 * SR-CAT-01, SR-CAT-02, SR-CAT-03: Danh sách sản phẩm đang kinh doanh cho khách hàng,
 * hỗ trợ tìm theo tên hoặc danh mục và đính kèm trạng thái tồn kho tổng hợp.
 */
export async function listActiveProducts(
    client,
    { search = '', category = '', page = 1, limit = 24 } = {}
) {
    const trimmedSearch = String(search ?? '').trim()
    const trimmedCategory = String(category ?? '').trim()

    const where = {
        isActive: true,
        ...(trimmedCategory
            ? { category: { equals: trimmedCategory, mode: 'insensitive' } }
            : {}),
        ...(trimmedSearch
            ? {
                  OR: [
                      { name: { contains: trimmedSearch, mode: 'insensitive' } },
                      { category: { contains: trimmedSearch, mode: 'insensitive' } },
                  ],
              }
            : {}),
    }

    const [total, products] = await Promise.all([
        client.product.count({ where }),
        client.product.findMany({
            where,
            orderBy: { id: 'asc' },
            skip: (page - 1) * limit,
            take: limit,
        }),
    ])

    const availableMap = await getAvailableByProduct(
        client,
        products.map((p) => p.id)
    )

    return {
        total,
        page,
        limit,
        items: products.map((p) => mapProduct(p, availableMap.get(p.id) ?? 0)),
    }
}

/**
 * SR-CAT-03: Chi tiết một sản phẩm kèm trạng thái tồn kho.
 * Nếu `includeInactive = false` (mặc định cho khách hàng), sản phẩm ngừng bán sẽ trả null.
 */
export async function findProductById(client, productId, { includeInactive = false } = {}) {
    const product = await client.product.findUnique({ where: { id: productId } })

    if (!product || (!includeInactive && !product.isActive)) {
        return null
    }

    const availableMap = await getAvailableByProduct(client, [product.id])
    return mapProduct(product, availableMap.get(product.id) ?? 0)
}

/**
 * Phục vụ M2 khi checkout (UC04): lấy thông tin sản phẩm từ DB để kiểm tra sản phẩm
 * tồn tại, còn kinh doanh (`isActive = true`) và lấy `name`, `price` làm snapshot.
 * Ném `AppError(PRODUCT_UNAVAILABLE)` nếu có bất kỳ sản phẩm nào không tồn tại hoặc đã ngừng bán.
 */
export async function findActiveProductsForCheckout(client, productIds) {
    const uniqueIds = [...new Set(productIds)]
    const products = await client.product.findMany({
        where: { id: { in: uniqueIds } },
    })

    const byId = new Map(products.map((p) => [p.id, p]))
    const unavailableIds = uniqueIds.filter((id) => {
        const p = byId.get(id)
        return !p || !p.isActive
    })

    if (unavailableIds.length > 0) {
        throw new AppError(
            ErrorCodes.PRODUCT_UNAVAILABLE,
            'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.',
            unavailableIds.map((id) => ({
                field: `product:${id}`,
                reason: 'Sản phẩm không khả dụng.',
            }))
        )
    }

    return uniqueIds.map((id) => {
        const p = byId.get(id)
        return {
            id: p.id,
            sku: p.sku,
            name: p.name,
            price: Number(p.price),
            isActive: p.isActive,
        }
    })
}

/**
 * SR-PROD-01: Admin thêm sản phẩm mới và khởi tạo dòng tồn kho (onHand=0, reserved=0) cho các kho.
 */
export async function createProduct(
    tx,
    { sku, name, category, price, description = '', imageUrl = null, warehouseIds }
) {
    const cleanName = assertNonEmptyString(name, 'name', 200)
    const cleanCategory = assertNonEmptyString(category, 'category', 80)
    const cleanPrice = assertPositivePrice(price, 'price')
    const cleanSku =
        sku !== undefined && sku !== null
            ? assertNonEmptyString(sku, 'sku', 40)
            : `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    const product = await tx.product.create({
        data: {
            sku: cleanSku,
            name: cleanName,
            category: cleanCategory,
            price: cleanPrice,
            description: String(description ?? ''),
            imageUrl,
            isActive: true,
        },
    })

    const targetWarehouses =
        Array.isArray(warehouseIds) && warehouseIds.length > 0
            ? warehouseIds
            : (await tx.warehouse.findMany({ select: { id: true } })).map((w) => w.id)

    const fallbackWarehouses =
        targetWarehouses.length > 0 ? targetWarehouses : SEED_WAREHOUSES.map((w) => w.id)

    await tx.inventory.createMany({
        data: fallbackWarehouses.map((warehouseId) => ({
            warehouseId,
            productId: product.id,
            onHand: 0,
            reserved: 0,
            lowStockThreshold: 0,
        })),
        skipDuplicates: true,
    })

    return mapProduct(product, 0)
}

/**
 * SR-PROD-02: Admin cập nhật thông tin sản phẩm. Lịch sử đơn cũ giữ nguyên nhờ snapshot ở OrderItem.
 */
export async function updateProduct(tx, productId, { name, category, price, description, imageUrl }) {
    const data = {}
    if (name !== undefined) data.name = assertNonEmptyString(name, 'name', 200)
    if (category !== undefined) data.category = assertNonEmptyString(category, 'category', 80)
    if (price !== undefined) data.price = assertPositivePrice(price, 'price')
    if (description !== undefined) data.description = String(description)
    if (imageUrl !== undefined) data.imageUrl = imageUrl

    const updated = await tx.product.update({
        where: { id: productId },
        data,
    })

    const availableMap = await getAvailableByProduct(tx, [productId])
    return mapProduct(updated, availableMap.get(productId) ?? 0)
}

/**
 * SR-PROD-03: Admin ngừng kinh doanh sản phẩm (soft-discontinue, không xóa bản ghi).
 */
export async function discontinueProduct(tx, productId) {
    const updated = await tx.product.update({
        where: { id: productId },
        data: { isActive: false, discontinuedAt: new Date() },
    })

    const availableMap = await getAvailableByProduct(tx, [productId])
    return mapProduct(updated, availableMap.get(productId) ?? 0)
}

// User-authorized extension: reactivate without changing inventory or order snapshots.
export async function activateProduct(tx,productId) {
 const updated=await tx.product.update({where:{id:productId},data:{isActive:true,discontinuedAt:null}})
 const available=await getAvailableByProduct(tx,[productId])
 return mapProduct(updated,available.get(productId)??0)
}
