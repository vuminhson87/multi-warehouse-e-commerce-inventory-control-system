// M3 - Nguyễn Anh Quân: Kiểm thử tầng lưu trữ tồn kho, transaction retry, Redis cache,
// idempotency, product/user repository và backup/restore.
// Bao phủ các kịch bản: T03, T04, T05, T06, T07, T08 (concurrency zero-oversell),
// T12, T14, T15, T17, T18, T19, T22.

import { describe, it, expect, vi } from 'vitest'
import {
    computeAvailable,
    isLowStock,
    isValidInventoryState,
    normalizeItems,
} from '../../src/modules/inventory/inventory.invariants.js'
import {
    consumeReservations,
    releaseReservations,
    reserveForExistingOrder,
    reserveForNewOrder,
    reserveStock,
    restockInventory,
    restoreConsumedStock,
    setLowStockThreshold,
} from '../../src/modules/inventory/inventory.repository.js'
import { isRetryableTransactionError, runInTransaction } from '../../src/db/transaction.js'
import {
    CacheKeys,
    createMemoryCacheStore,
    getOrSetCache,
    invalidateInventoryCache,
    invalidateProductCache,
} from '../../src/db/redis.js'
import {
    claimIdempotencyKey,
    completeIdempotencyKey,
} from '../../src/shared/idempotency.repository.js'
import {
    createProduct,
    discontinueProduct,
    findActiveProductsForCheckout,
    listActiveProducts,
} from '../../src/modules/product/product.repository.js'
import {
    hashPassword,
    verifyPassword,
    verifyUserCredentials,
} from '../../src/modules/auth/user.repository.js'
import {
    buildBackupFileName,
    buildDockerPgDumpArgs,
    buildDockerPsqlArgs,
} from '../../scripts/db-backup-restore.js'
import { ErrorCodes } from '../../src/shared/errors.js'

// ---------------------------------------------------------------------------
// Giả lập PostgreSQL transactional state trong bộ nhớ (mô phỏng khóa hàng & CHECK constraint)
// ---------------------------------------------------------------------------

function createStatefulMockDb(initialInventories = []) {
    let nextReservationId = 1
    let nextMovementId = 1
    let nextAlertId = 1
    let nextOrderId = 100
    let txQueue = Promise.resolve()

    const state = {
        inventories: initialInventories.map((row, idx) => ({
            id: idx + 1,
            warehouse_id: row.warehouseId,
            product_id: row.productId,
            on_hand: row.onHand,
            reserved: row.reserved ?? 0,
            low_stock_threshold: row.lowStockThreshold ?? 5,
            version: 0,
        })),
        reservations: [],
        movements: [],
        alerts: [],
    }

    function cloneState(s) {
        return JSON.parse(JSON.stringify(s))
    }

    function buildTx(working) {
        return {
            $queryRaw: async (strings, ...values) => {
                const sql = strings.join(' ')

                // lockInventoryRows
                if (sql.includes('FROM inventories') && sql.includes('FOR UPDATE')) {
                    const productIds = Array.isArray(values[0]) ? values[0] : []
                    const whFilter = typeof values[1] === 'number' ? values[1] : null
                    return working.inventories
                        .filter(
                            (r) =>
                                (productIds.length === 0 || productIds.includes(r.product_id)) &&
                                (whFilter === null || r.warehouse_id === whFilter)
                        )
                        .sort(
                            (a, b) =>
                                a.warehouse_id - b.warehouse_id || a.product_id - b.product_id
                        )
                        .map((r) => ({ ...r }))
                }

                // reserveStock UPDATE
                if (
                    sql.includes('UPDATE inventories') &&
                    sql.includes('SET reserved = reserved +')
                ) {
                    const [qty, warehouseId, productId, minAvail] = values
                    const row = working.inventories.find(
                        (r) =>
                            r.warehouse_id === warehouseId &&
                            r.product_id === productId &&
                            r.on_hand - r.reserved >= minAvail
                    )
                    if (!row) return []
                    row.reserved += qty
                    row.version += 1
                    return [{ ...row }]
                }

                // releaseReservations UPDATE
                if (
                    sql.includes('UPDATE inventories') &&
                    sql.includes('SET reserved = reserved -') &&
                    !sql.includes('on_hand = on_hand -')
                ) {
                    const [qty, warehouseId, productId, minReserved] = values
                    const row = working.inventories.find(
                        (r) =>
                            r.warehouse_id === warehouseId &&
                            r.product_id === productId &&
                            r.reserved >= minReserved
                    )
                    if (!row) return []
                    row.reserved -= qty
                    row.version += 1
                    return [{ ...row }]
                }

                // consumeReservations UPDATE
                if (
                    sql.includes('UPDATE inventories') &&
                    sql.includes('on_hand = on_hand -')
                ) {
                    const [qtyOnHand, qtyReserved, warehouseId, productId, minRes, minOh] = values
                    const row = working.inventories.find(
                        (r) =>
                            r.warehouse_id === warehouseId &&
                            r.product_id === productId &&
                            r.reserved >= minRes &&
                            r.on_hand >= minOh
                    )
                    if (!row) return []
                    row.on_hand -= qtyOnHand
                    row.reserved -= qtyReserved
                    row.version += 1
                    return [{ ...row }]
                }

                // restoreConsumedStock UPDATE
                if (
                    sql.includes('UPDATE inventories') &&
                    sql.includes('SET on_hand = on_hand +')
                ) {
                    const [qty, warehouseId, productId] = values
                    const row = working.inventories.find(
                        (r) => r.warehouse_id === warehouseId && r.product_id === productId
                    )
                    if (!row) return []
                    row.on_hand += qty
                    row.version += 1
                    return [{ ...row }]
                }

                // restockInventory UPSERT
                if (sql.includes('INSERT INTO inventories') && sql.includes('EXCLUDED.on_hand')) {
                    const [warehouseId, productId, quantity] = values
                    let row = working.inventories.find(
                        (r) => r.warehouse_id === warehouseId && r.product_id === productId
                    )
                    if (row) {
                        row.on_hand += quantity
                        row.version += 1
                    } else {
                        row = {
                            id: working.inventories.length + 1,
                            warehouse_id: warehouseId,
                            product_id: productId,
                            on_hand: quantity,
                            reserved: 0,
                            low_stock_threshold: 0,
                            version: 0,
                        }
                        working.inventories.push(row)
                    }
                    return [{ ...row }]
                }

                // setLowStockThreshold UPSERT
                if (
                    sql.includes('INSERT INTO inventories') &&
                    sql.includes('EXCLUDED.low_stock_threshold')
                ) {
                    const [warehouseId, productId, threshold] = values
                    let row = working.inventories.find(
                        (r) => r.warehouse_id === warehouseId && r.product_id === productId
                    )
                    if (row) {
                        row.low_stock_threshold = threshold
                        row.version += 1
                    } else {
                        row = {
                            id: working.inventories.length + 1,
                            warehouse_id: warehouseId,
                            product_id: productId,
                            on_hand: 0,
                            reserved: 0,
                            low_stock_threshold: threshold,
                            version: 0,
                        }
                        working.inventories.push(row)
                    }
                    return [{ ...row }]
                }

                // lockReservations
                if (sql.includes('FROM stock_reservations') && sql.includes('FOR UPDATE')) {
                    const [orderId, status] = values
                    return working.reservations
                        .filter((r) => r.orderId === orderId && r.status === status)
                        .map((r) => ({ ...r }))
                }

                return []
            },

            $executeRaw: async (strings, ...values) => {
                const sql = strings.join(' ')
                if (sql.includes('INSERT INTO low_stock_alerts')) {
                    const warehouseId = values[0]
                    for (const inv of working.inventories.filter(
                        (r) => r.warehouse_id === warehouseId
                    )) {
                        const avail = inv.on_hand - inv.reserved
                        const existingOpen = working.alerts.find(
                            (a) =>
                                a.warehouseId === warehouseId &&
                                a.productId === inv.product_id &&
                                a.status === 'OPEN'
                        )
                        if (avail <= inv.low_stock_threshold && !existingOpen) {
                            working.alerts.push({
                                id: nextAlertId++,
                                warehouseId,
                                productId: inv.product_id,
                                availableAtTrigger: avail,
                                threshold: inv.low_stock_threshold,
                                status: 'OPEN',
                            })
                        }
                    }
                    return 1
                }
                if (sql.includes('UPDATE low_stock_alerts')) {
                    const warehouseId = values[0]
                    for (const alert of working.alerts.filter(
                        (a) => a.warehouseId === warehouseId && a.status === 'OPEN'
                    )) {
                        const inv = working.inventories.find(
                            (r) =>
                                r.warehouse_id === warehouseId &&
                                r.product_id === alert.productId
                        )
                        if (inv && inv.on_hand - inv.reserved > inv.low_stock_threshold) {
                            alert.status = 'RESOLVED'
                        }
                    }
                    return 1
                }
                return 0
            },

            stockReservation: {
                createMany: async ({ data }) => {
                    for (const item of data) {
                        working.reservations.push({ id: nextReservationId++, ...item })
                    }
                    return { count: data.length }
                },
                updateMany: async ({ where, data }) => {
                    const ids = new Set(where.id.in)
                    let count = 0
                    for (const r of working.reservations) {
                        if (ids.has(r.id) && r.status === where.status) {
                            Object.assign(r, data)
                            count += 1
                        }
                    }
                    return { count }
                },
                count: async ({ where }) =>
                    working.reservations.filter(
                        (r) => r.orderId === where.orderId && r.status === where.status
                    ).length,
            },

            inventoryMovement: {
                createMany: async ({ data }) => {
                    for (const m of data) {
                        working.movements.push({ id: nextMovementId++, ...m })
                    }
                    return { count: data.length }
                },
                create: async ({ data }) => {
                    const entry = { id: nextMovementId++, ...data }
                    working.movements.push(entry)
                    return entry
                },
                count: async ({ where }) =>
                    working.movements.filter(
                        (m) => m.orderId === where.orderId && m.type === where.type
                    ).length,
            },
        }
    }

    // Tuần tự hóa các transaction như cách PostgreSQL giữ row lock trên cùng mặt hàng,
    // và rollback toàn bộ nếu bên trong ném lỗi.
    function $transaction(work) {
        const run = txQueue.then(async () => {
            const snapshot = cloneState(state)
            const tx = buildTx(snapshot)
            const result = await work(tx)
            Object.assign(state, snapshot)
            return result
        })
        txQueue = run.catch(() => {})
        return run
    }

    return {
        state,
        $transaction,
        nextOrderId: () => ++nextOrderId,
    }
}

// ---------------------------------------------------------------------------
// 1. Bất biến tồn kho thuần
// ---------------------------------------------------------------------------

describe('inventory.invariants', () => {
    it('computeAvailable và isLowStock (T12: available == threshold phải cảnh báo)', () => {
        expect(computeAvailable({ onHand: 10, reserved: 3 })).toBe(7)
        expect(isLowStock({ onHand: 10, reserved: 5, lowStockThreshold: 5 })).toBe(true)
        expect(isLowStock({ onHand: 10, reserved: 4, lowStockThreshold: 5 })).toBe(false)
        expect(isValidInventoryState({ onHand: 5, reserved: 5, lowStockThreshold: 0 })).toBe(true)
        expect(isValidInventoryState({ onHand: 4, reserved: 5, lowStockThreshold: 0 })).toBe(false)
    })

    it('normalizeItems gộp sản phẩm trùng và sắp xếp tăng dần để chống deadlock', () => {
        expect(
            normalizeItems([
                { productId: 5, quantity: 2 },
                { productId: 2, quantity: 1 },
                { productId: 5, quantity: 3 },
            ])
        ).toEqual([
            { productId: 2, quantity: 1 },
            { productId: 5, quantity: 5 },
        ])
    })
})

// ---------------------------------------------------------------------------
// 2. Luồng tồn kho nguyên tử: Reserve → Consume / Release / Restore / Retry / Concurrency
// ---------------------------------------------------------------------------

describe('inventory.repository – atomic operations', () => {
    it('T03 (BR-01): từ chối split fulfillment khi mỗi kho chỉ đủ 1 mặt hàng', async () => {
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 5, reserved: 0 },
            { warehouseId: 1, productId: 2, onHand: 0, reserved: 0 },
            { warehouseId: 2, productId: 1, onHand: 0, reserved: 0 },
            { warehouseId: 2, productId: 2, onHand: 5, reserved: 0 },
        ])

        await expect(
            runInTransaction(
                (tx) =>
                    reserveStock(tx, {
                        items: [
                            { productId: 1, quantity: 2 },
                            { productId: 2, quantity: 2 },
                        ],
                    }),
                { client: db }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.OUT_OF_STOCK })

        // Không có kho nào bị giữ hàng dở dang.
        expect(db.state.inventories.every((r) => r.reserved === 0)).toBe(true)
    })

    it('T04 + T05 + T15 + T19: Reserve → Consume (Paid) → Restore (Cancel Paid) và chống gọi lặp', async () => {
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 10, reserved: 2, lowStockThreshold: 5 },
        ])

        const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

        // 1) Reserve 3 (ví dụ trong mục 8 tài liệu: onHand=10, reserved=2 -> (10, 5, avail=5))
        const { order, warehouseId } = await runInTransaction(
            (tx) =>
                reserveForNewOrder(tx, {
                    items: [{ productId: 1, quantity: 3 }],
                    expiresAt,
                    createOrder: async () => ({ id: 101 }),
                }),
            { client: db }
        )

        expect(order.id).toBe(101)
        expect(warehouseId).toBe(1)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 10, reserved: 5 })
        // T12: available = 5 == threshold (5) -> tự động sinh cảnh báo OPEN
        expect(db.state.alerts).toHaveLength(1)
        expect(db.state.alerts[0]).toMatchObject({ status: 'OPEN', availableAtTrigger: 5 })

        // 2) Thanh toán thành công: (10, 5) -> (7, 2)
        const consumed1 = await runInTransaction(
            (tx) => consumeReservations(tx, { orderId: 101 }),
            { client: db }
        )
        expect(consumed1.count).toBe(1)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 7, reserved: 2 })

        // T19: Callback thanh toán lặp -> idempotent, không trừ lần 2
        const consumedDuplicate = await runInTransaction(
            (tx) => consumeReservations(tx, { orderId: 101 }),
            { client: db }
        )
        expect(consumedDuplicate.count).toBe(0)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 7, reserved: 2 })

        // 3) T15: Hủy đơn Paid -> hoàn trả on_hand về 10 tại đúng kho 1, đóng cảnh báo vì avail = 8 > 5
        const restored1 = await runInTransaction(
            (tx) => restoreConsumedStock(tx, { orderId: 101 }),
            { client: db }
        )
        expect(restored1.count).toBe(1)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 10, reserved: 2 })
        expect(db.state.alerts[0].status).toBe('RESOLVED')

        // Gọi hủy lặp không hoàn hàng 2 lần
        const restoredDuplicate = await runInTransaction(
            (tx) => restoreConsumedStock(tx, { orderId: 101 }),
            { client: db }
        )
        expect(restoredDuplicate.alreadyRestored).toBe(true)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 10, reserved: 2 })
    })

    it('T06 + T07: Payment fail → release → retry khi hết hàng bị từ chối, không oversell', async () => {
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 4, reserved: 0 },
        ])
        const expiresAt = new Date(Date.now() + 60000)

        await runInTransaction(
            (tx) =>
                reserveForNewOrder(tx, {
                    items: [{ productId: 1, quantity: 4 }],
                    expiresAt,
                    createOrder: async () => ({ id: 201 }),
                }),
            { client: db }
        )
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 4, reserved: 4 })

        // Payment fail -> release reservation
        const released = await runInTransaction(
            (tx) => releaseReservations(tx, { orderId: 201 }),
            { client: db }
        )
        expect(released.count).toBe(1)
        expect(db.state.inventories[0]).toMatchObject({ on_hand: 4, reserved: 0 })

        // Người khác mua mất 2 sản phẩm
        await runInTransaction(
            (tx) =>
                reserveForNewOrder(tx, {
                    items: [{ productId: 1, quantity: 2 }],
                    expiresAt,
                    createOrder: async () => ({ id: 202 }),
                }),
            { client: db }
        )

        // Đơn 201 retry đòi 4 sản phẩm -> bị từ chối vì chỉ còn 2
        await expect(
            runInTransaction(
                (tx) =>
                    reserveForExistingOrder(tx, {
                        orderId: 201,
                        warehouseId: 1,
                        items: [{ productId: 1, quantity: 4 }],
                        expiresAt,
                    }),
                { client: db }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.OUT_OF_STOCK })

        expect(db.state.inventories[0]).toMatchObject({ on_hand: 4, reserved: 2 })
    })

    it('T18 (NFR-REL-01): tạo đơn lỗi sau khi reserve thì rollback toàn bộ, không để hàng giữ mồ côi', async () => {
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 10, reserved: 0 },
        ])

        await expect(
            runInTransaction(
                (tx) =>
                    reserveForNewOrder(tx, {
                        items: [{ productId: 1, quantity: 5 }],
                        expiresAt: new Date(Date.now() + 60000),
                        createOrder: async () => {
                            throw new Error('DB lỗi khi ghi bảng orders')
                        },
                    }),
                { client: db }
            )
        ).rejects.toThrow('DB lỗi khi ghi bảng orders')

        expect(db.state.inventories[0].reserved).toBe(0)
        expect(db.state.reservations).toHaveLength(0)
    })

    it('T08 (NFR-PER-04/05): 30 người dùng đồng thời mua hàng giới hạn – tuyệt đối không oversell', async () => {
        // Tổng khả dụng 3 kho = 5 + 5 + 5 = 15, mỗi người mua 1 sản phẩm, 30 người đặt cùng lúc.
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 5, reserved: 0 },
            { warehouseId: 2, productId: 1, onHand: 5, reserved: 0 },
            { warehouseId: 3, productId: 1, onHand: 5, reserved: 0 },
        ])

        const expiresAt = new Date(Date.now() + 60000)
        const requests = Array.from({ length: 30 }, (_, index) =>
            runInTransaction(
                (tx) =>
                    reserveForNewOrder(tx, {
                        items: [{ productId: 1, quantity: 1 }],
                        expiresAt,
                        createOrder: async () => ({ id: 300 + index }),
                    }),
                { client: db }
            )
        )

        const results = await Promise.allSettled(requests)
        const succeeded = results.filter((r) => r.status === 'fulfilled')
        const failed = results.filter((r) => r.status === 'rejected')

        expect(succeeded).toHaveLength(15)
        expect(failed).toHaveLength(15)

        for (const inv of db.state.inventories) {
            expect(inv.on_hand).toBe(5)
            expect(inv.reserved).toBe(5)
            expect(inv.reserved).toBeLessThanOrEqual(inv.on_hand)
        }
    })

    it('UC08 & UC06: restockInventory và setLowStockThreshold cập nhật đúng kho', async () => {
        const db = createStatefulMockDb([
            { warehouseId: 1, productId: 1, onHand: 2, reserved: 0, lowStockThreshold: 5 },
        ])

        await runInTransaction(
            (tx) => setLowStockThreshold(tx, { warehouseId: 1, productId: 1, threshold: 4 }),
            { client: db }
        )
        expect(db.state.alerts).toHaveLength(1)

        const { inventory } = await runInTransaction(
            (tx) => restockInventory(tx, { warehouseId: 1, productId: 1, quantity: 10 }),
            { client: db }
        )
        expect(inventory.onHand).toBe(12)
        expect(db.state.alerts[0].status).toBe('RESOLVED')
    })
})

// ---------------------------------------------------------------------------
// 3. Transaction retry & Deadlock handling
// ---------------------------------------------------------------------------

describe('db/transaction – retry on conflict', () => {
    it('thử lại khi gặp lỗi deadlock 40P01 / P2034 và thành công ở lần sau', async () => {
        let attempts = 0
        const fakeClient = {
            $transaction: async (work) => {
                attempts += 1
                if (attempts < 3) {
                    const err = new Error('deadlock detected')
                    err.code = 'P2034'
                    throw err
                }
                return work({})
            },
        }

        const result = await runInTransaction(async () => 'OK', {
            client: fakeClient,
            maxRetries: 3,
        })

        expect(result).toBe('OK')
        expect(attempts).toBe(3)
        expect(isRetryableTransactionError({ code: 'P2034' })).toBe(true)
        expect(isRetryableTransactionError({ meta: { code: '40001' } })).toBe(true)
    })

    it('ném TEMPORARY_CONFLICT (503) khi vượt quá số lần thử lại tối đa', async () => {
        const fakeClient = {
            $transaction: async () => {
                const err = new Error('could not serialize access')
                err.meta = { code: '40001' }
                throw err
            },
        }

        await expect(
            runInTransaction(async () => 'never', { client: fakeClient, maxRetries: 1 })
        ).rejects.toMatchObject({ code: ErrorCodes.TEMPORARY_CONFLICT, httpStatus: 503 })
    })
})

// ---------------------------------------------------------------------------
// 4. Redis cache & invalidation
// ---------------------------------------------------------------------------

describe('db/redis – cache-aside & invalidation (NFR-PER-06)', () => {
    it('lưu cache khi đọc và xóa đúng các key khi tồn kho/sản phẩm thay đổi', async () => {
        const store = createMemoryCacheStore()
        const loader = vi.fn(async () => ({ items: [{ id: 1, inStock: true }] }))

        const listKey = CacheKeys.catalogList({ search: 'Dell', page: 1 })
        const first = await getOrSetCache(listKey, 60, loader, { store })
        const second = await getOrSetCache(listKey, 60, loader, { store })

        expect(first).toEqual(second)
        expect(loader).toHaveBeenCalledTimes(1)

        await invalidateInventoryCache({ warehouseIds: [1], productIds: [1] }, { store })
        await getOrSetCache(listKey, 60, loader, { store })
        expect(loader).toHaveBeenCalledTimes(2)

        await invalidateProductCache({ productIds: [1] }, { store })
        await getOrSetCache(listKey, 60, loader, { store })
        expect(loader).toHaveBeenCalledTimes(3)
    })
})

// ---------------------------------------------------------------------------
// 5. Idempotency, Product (T17), Auth bcrypt (NFR-SEC-01), Backup/Restore (T22)
// ---------------------------------------------------------------------------

describe('idempotency, product, auth & backup utilities', () => {
    it('T19: claimIdempotencyKey trả kết quả cũ nếu trùng key+payload và báo lỗi nếu khác payload', async () => {
        const records = new Map()
        const client = {
            idempotencyRecord: {
                findUnique: async ({ where }) => {
                    const k = `${where.userId_operation_key.userId}:${where.userId_operation_key.operation}:${where.userId_operation_key.key}`
                    return records.get(k) ?? null
                },
                create: async ({ data }) => {
                    const entry = { id: 1, ...data, completedAt: null, responseBody: null }
                    records.set(`${data.userId}:${data.operation}:${data.key}`, entry)
                    return entry
                },
                update: async ({ where, data }) => {
                    for (const entry of records.values()) {
                        if (entry.id === where.id) Object.assign(entry, data)
                    }
                },
            },
        }

        const key = '550e8400-e29b-41d4-a716-446655440000'
        const first = await claimIdempotencyKey(client, {
            userId: 1,
            operation: 'CREATE_ORDER',
            key,
            payload: { items: [{ productId: 1, quantity: 2 }] },
        })
        expect(first.status).toBe('STARTED')

        await completeIdempotencyKey(client, {
            id: first.record.id,
            orderId: 99,
            responseStatus: 201,
            responseBody: { orderId: 99 },
        })

        const replay = await claimIdempotencyKey(client, {
            userId: 1,
            operation: 'CREATE_ORDER',
            key,
            payload: { items: [{ productId: 1, quantity: 2 }] },
        })
        expect(replay.status).toBe('COMPLETED')
        expect(replay.responseBody).toEqual({ orderId: 99 })

        await expect(
            claimIdempotencyKey(client, {
                userId: 1,
                operation: 'CREATE_ORDER',
                key,
                payload: { items: [{ productId: 1, quantity: 99 }] },
            })
        ).rejects.toMatchObject({ code: ErrorCodes.IDEMPOTENCY_CONFLICT })
    })

    it('T17 (SR-PROD-03): ngừng kinh doanh ẩn sản phẩm khỏi catalog và chặn checkout nhưng không xóa bản ghi', async () => {
        const products = []
        const client = {
            product: {
                create: async ({ data }) => {
                    const p = { id: 1, ...data, createdAt: new Date(), updatedAt: new Date() }
                    products.push(p)
                    return p
                },
                update: async ({ where, data }) => {
                    const p = products.find((x) => x.id === where.id)
                    Object.assign(p, data)
                    return p
                },
                count: async ({ where }) =>
                    products.filter((p) => p.isActive === where.isActive).length,
                findMany: async ({ where }) =>
                    products.filter((p) =>
                        where.isActive !== undefined
                            ? p.isActive === where.isActive
                            : where.id.in.includes(p.id)
                    ),
            },
            warehouse: { findMany: async () => [{ id: 1 }, { id: 2 }, { id: 3 }] },
            inventory: { createMany: async () => ({ count: 3 }) },
            $queryRaw: async () => [{ productId: 1, available: 10 }],
        }

        await createProduct(client, {
            sku: 'SKU-TEST',
            name: 'Chuột Test',
            category: 'Phụ kiện',
            price: 500000,
        })

        expect((await listActiveProducts(client)).items).toHaveLength(1)

        await discontinueProduct(client, 1)

        // Ẩn khỏi catalog nhưng bản ghi vẫn còn trong mảng products để giữ lịch sử đơn
        expect((await listActiveProducts(client)).items).toHaveLength(0)
        expect(products).toHaveLength(1)

        await expect(findActiveProductsForCheckout(client, [1])).rejects.toMatchObject({
            code: ErrorCodes.PRODUCT_UNAVAILABLE,
        })
    })

    it('NFR-SEC-01: băm và kiểm tra mật khẩu bằng bcrypt, không lộ passwordHash', async () => {
        const hash = await hashPassword('123456')
        expect(hash).not.toBe('123456')
        expect(await verifyPassword('123456', hash)).toBe(true)
        expect(await verifyPassword('wrong', hash)).toBe(false)

        const client = {
            user: {
                findUnique: async () => ({
                    id: 2,
                    username: 'warehouse',
                    passwordHash: hash,
                    role: 'WAREHOUSE_MANAGER',
                    assignedWarehouseId: 1,
                    isActive: true,
                }),
            },
        }

        const user = await verifyUserCredentials(client, {
            username: 'warehouse',
            password: '123456',
        })
        expect(user).toEqual({
            id: 2,
            username: 'warehouse',
            fullName: null,
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        expect('passwordHash' in user).toBe(false)
    })

    it('T22 (NFR-REL-04): tạo tham số pg_dump / psql chuẩn cho backup và restore', () => {
        expect(buildBackupFileName(new Date('2026-10-20T00:00:00Z'))).toBe(
            'multi_warehouse_20261020_000000.sql'
        )
        expect(buildDockerPgDumpArgs()).toContain('pg_dump')
        expect(buildDockerPsqlArgs()).toContain('ON_ERROR_STOP=1')
    })
})
