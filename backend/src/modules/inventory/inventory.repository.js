// M3 - Nguyễn Anh Quân: Tầng lưu trữ tồn kho – thao tác nguyên tử trên PostgreSQL.
// Truy vết: SR-INV-01..06, SR-ORD-01..03, SR-PAY-03/04, SR-CAN-03, SR-ALERT-01..03,
//           BR-01..04, BR-06, BR-07, BR-12, NFR-PER-05, NFR-REL-01/03.
//
// Quy ước:
// - Hàm GHI nhận `tx` (Prisma interactive transaction client) – service (M2) mở transaction bằng
//   runInTransaction() và gọi các hàm này bên trong, nên order + inventory luôn commit/rollback cùng nhau.
// - Hàm ĐỌC nhận `client` (prisma hoặc tx).
// - Chống oversell 3 lớp: (1) khóa hàng SELECT ... FOR UPDATE theo thứ tự cố định,
//   (2) UPDATE có điều kiện `on_hand - reserved >= q`, (3) CHECK constraint ở DB.
// - Các hàm release/consume/restore idempotent: gọi lặp không trừ/hoàn hàng hai lần (T19).
// - Hàm ghi trả về `affected = { warehouseIds, productIds }` để gọi invalidateInventoryCache() SAU commit.

import { Prisma } from '@prisma/client'
import { selectFulfillmentWarehouse } from './inventory.policy.js'
import {
    assertPositiveQuantity,
    assertThreshold,
    computeAvailable,
    normalizeItems,
} from './inventory.invariants.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'

export const MovementType = Object.freeze({
    RESERVE: 'RESERVE',
    RELEASE: 'RELEASE',
    CONSUME: 'CONSUME',
    RESTORE: 'RESTORE',
    RESTOCK: 'RESTOCK',
    ADJUST: 'ADJUST',
})

// ---------------------------------------------------------------------------
// Tiện ích nội bộ
// ---------------------------------------------------------------------------

function mapInventoryRow(row) {
    return {
        id: row.id,
        warehouseId: row.warehouse_id,
        productId: row.product_id,
        onHand: row.on_hand,
        reserved: row.reserved,
        lowStockThreshold: row.low_stock_threshold,
        available: row.on_hand - row.reserved,
    }
}

function assertId(value, field) {
    if (!Number.isInteger(value) || value < 1) {
        throw validationError([{ field, reason: 'Phải là số nguyên dương.' }])
    }

    return value
}

function invariantBroken(detail) {
    // Không bao giờ được xảy ra nếu dữ liệu nhất quán; ném lỗi thường để transaction rollback
    // và trả INTERNAL_ERROR (không lộ chi tiết ra client).
    return new Error(`Vi phạm bất biến tồn kho: ${detail}`)
}

function isForeignKeyViolation(error) {
    return error?.code === 'P2003' || error?.meta?.code === '23503' || /23503|foreign key/i.test(String(error?.message))
}

function buildAffected(rows) {
    return {
        warehouseIds: [...new Set(rows.map((r) => r.warehouseId))],
        productIds: [...new Set(rows.map((r) => r.productId))],
    }
}

/**
 * Khóa các dòng tồn kho liên quan theo thứ tự (warehouse_id, product_id) để mọi transaction
 * khóa cùng thứ tự → tránh deadlock khi nhiều người checkout đồng thời.
 */
export async function lockInventoryRows(tx, { productIds, warehouseId } = {}) {
    if (!Array.isArray(productIds) || productIds.length === 0) {
        return []
    }

    const warehouseFilter =
        warehouseId === undefined || warehouseId === null
            ? Prisma.empty
            : Prisma.sql`AND warehouse_id = ${warehouseId}`

    const rows = await tx.$queryRaw`
        SELECT id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold
        FROM inventories
        WHERE product_id IN (${Prisma.join(productIds)}) ${warehouseFilter}
        ORDER BY warehouse_id, product_id
        FOR UPDATE`

    return rows.map(mapInventoryRow)
}

// ---------------------------------------------------------------------------
// Cảnh báo tồn kho thấp (SR-ALERT-02, BR-07)
// ---------------------------------------------------------------------------

/**
 * Đồng bộ cảnh báo sau mỗi lần available thay đổi:
 * - available <= threshold và chưa có cảnh báo OPEN → tạo mới (partial unique index chống trùng).
 * - available > threshold → đóng cảnh báo OPEN (RESOLVED).
 */
export async function syncLowStockAlerts(tx, warehouseId, productIds) {
    if (!productIds?.length) {
        return
    }

    await tx.$executeRaw`
        INSERT INTO low_stock_alerts (warehouse_id, product_id, available_at_trigger, threshold, status, created_at)
        SELECT warehouse_id, product_id, on_hand - reserved, low_stock_threshold, 'OPEN', NOW()
        FROM inventories
        WHERE warehouse_id = ${warehouseId}
          AND product_id IN (${Prisma.join(productIds)})
          AND on_hand - reserved <= low_stock_threshold
        ON CONFLICT (warehouse_id, product_id) WHERE status = 'OPEN' DO NOTHING`

    await tx.$executeRaw`
        UPDATE low_stock_alerts AS a
        SET status = 'RESOLVED', resolved_at = NOW()
        FROM inventories AS i
        WHERE a.warehouse_id = i.warehouse_id
          AND a.product_id = i.product_id
          AND a.status = 'OPEN'
          AND a.warehouse_id = ${warehouseId}
          AND a.product_id IN (${Prisma.join(productIds)})
          AND i.on_hand - i.reserved > i.low_stock_threshold`
}

async function syncAlertsForRows(tx, rows) {
    const byWarehouse = new Map()

    for (const row of rows) {
        if (!byWarehouse.has(row.warehouseId)) {
            byWarehouse.set(row.warehouseId, new Set())
        }

        byWarehouse.get(row.warehouseId).add(row.productId)
    }

    for (const [warehouseId, productIds] of byWarehouse) {
        await syncLowStockAlerts(tx, warehouseId, [...productIds])
    }
}

// ---------------------------------------------------------------------------
// Giữ hàng (SR-ORD-01..03, BR-01, BR-02)
// ---------------------------------------------------------------------------

/**
 * Kiểm tra và giữ hàng ALL-OR-NOTHING tại MỘT kho đủ toàn bộ items.
 * Không trừ on_hand ở bước này (chỉ tăng reserved).
 * Ném AppError OUT_OF_STOCK nếu không kho nào đủ → transaction rollback, không giữ dở.
 *
 * @param preferredWarehouseId  Nếu truyền (ví dụ khi retry giữ kho cũ) thì chỉ xét kho này.
 */
export async function reserveStock(tx, { items, preferredWarehouseId } = {}) {
    const normalized = normalizeItems(items)
    const productIds = normalized.map((item) => item.productId)

    const lockedRows = await lockInventoryRows(tx, {
        productIds,
        warehouseId: preferredWarehouseId ?? undefined,
    })

    // Dùng quy tắc chọn kho của M2 (inventory.policy.js) trên dữ liệu đã khóa.
    const warehouseId = selectFulfillmentWarehouse(lockedRows, normalized)

    if (warehouseId === null) {
        throw new AppError(
            ErrorCodes.OUT_OF_STOCK,
            preferredWarehouseId
                ? 'Kho thực hiện đơn không còn đủ hàng cho toàn bộ sản phẩm.'
                : 'Không có kho nào đủ hàng cho toàn bộ sản phẩm trong đơn.',
            normalized.map((item) => ({ field: `product:${item.productId}`, reason: 'Không đủ hàng tại một kho.' }))
        )
    }

    const updatedRows = []

    for (const item of normalized) {
        const result = await tx.$queryRaw`
            UPDATE inventories
            SET reserved = reserved + ${item.quantity}, version = version + 1, updated_at = NOW()
            WHERE warehouse_id = ${warehouseId}
              AND product_id = ${item.productId}
              AND on_hand - reserved >= ${item.quantity}
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`

        if (result.length !== 1) {
            // Lớp phòng thủ thứ hai: điều kiện không thỏa → hủy toàn bộ transaction.
            throw new AppError(ErrorCodes.OUT_OF_STOCK, 'Sản phẩm vừa hết hàng, vui lòng thử lại.')
        }

        updatedRows.push(mapInventoryRow(result[0]))
    }

    return { warehouseId, items: normalized, inventories: updatedRows }
}

/**
 * Ghi stock_reservations + nhật ký RESERVE cho đơn đã có id, rồi đồng bộ cảnh báo.
 * Phải gọi trong CÙNG transaction với reserveStock().
 */
export async function recordReservations(tx, { orderId, reservation, expiresAt, actorUserId = null }) {
    assertId(orderId, 'orderId')

    if (!(expiresAt instanceof Date) || Number.isNaN(expiresAt.getTime())) {
        throw validationError([{ field: 'expiresAt', reason: 'Phải là thời điểm hợp lệ.' }])
    }

    const { warehouseId, items, inventories } = reservation
    const afterByProduct = new Map(inventories.map((row) => [row.productId, row]))

    await tx.stockReservation.createMany({
        data: items.map((item) => ({
            orderId,
            warehouseId,
            productId: item.productId,
            quantity: item.quantity,
            status: 'ACTIVE',
            expiresAt,
        })),
    })

    await tx.inventoryMovement.createMany({
        data: items.map((item) => ({
            warehouseId,
            productId: item.productId,
            type: MovementType.RESERVE,
            quantity: item.quantity,
            onHandAfter: afterByProduct.get(item.productId).onHand,
            reservedAfter: afterByProduct.get(item.productId).reserved,
            orderId,
            actorUserId,
        })),
    })

    await syncAlertsForRows(tx, inventories)

    return buildAffected(inventories)
}

/**
 * Tiện ích cho checkout (UC04): giữ hàng → tạo đơn → ghi reservation trong cùng transaction,
 * bảo đảm không có hàng giữ "mồ côi" nếu tạo đơn lỗi.
 *
 * @param createOrder async (tx, { warehouseId, items }) => order  (M2 tạo Order + OrderItem, trả về có `id`)
 */
export async function reserveForNewOrder(tx, { items, expiresAt, actorUserId = null, createOrder }) {
    if (typeof createOrder !== 'function') {
        throw new TypeError('createOrder phải là hàm tạo đơn hàng.')
    }

    const reservation = await reserveStock(tx, { items })
    const order = await createOrder(tx, { warehouseId: reservation.warehouseId, items: reservation.items })

    const affected = await recordReservations(tx, {
        orderId: order.id,
        reservation,
        expiresAt,
        actorUserId,
    })

    return { order, warehouseId: reservation.warehouseId, items: reservation.items, affected }
}

/**
 * Giữ lại hàng cho đơn PendingPayment đã bị release (retry thanh toán – UC04 E3/E4, test T07).
 * - Nếu đơn đã có reservation ACTIVE → trả về luôn, không giữ thêm (idempotent).
 * - Mặc định chỉ xét kho cũ (`warehouseId`); việc cho phép chọn kho khác là quyết định của nhóm.
 */
export async function reserveForExistingOrder(tx, { orderId, items, warehouseId, expiresAt, actorUserId = null }) {
    assertId(orderId, 'orderId')

    const active = await tx.stockReservation.count({ where: { orderId, status: 'ACTIVE' } })

    if (active > 0) {
        return { alreadyReserved: true, warehouseId, affected: { warehouseIds: [], productIds: [] } }
    }

    const reservation = await reserveStock(tx, { items, preferredWarehouseId: warehouseId })
    const affected = await recordReservations(tx, { orderId, reservation, expiresAt, actorUserId })

    return { alreadyReserved: false, warehouseId: reservation.warehouseId, affected }
}

// ---------------------------------------------------------------------------
// Release / Consume / Restore (SR-PAY-03/04, SR-INV-03, SR-CAN-03, BR-03/04/06)
// ---------------------------------------------------------------------------

async function lockReservations(tx, orderId, status, expiredBefore) {
    const expiryFilter = expiredBefore ? Prisma.sql`AND expires_at <= ${expiredBefore}` : Prisma.empty

    return tx.$queryRaw`
        SELECT id, warehouse_id AS "warehouseId", product_id AS "productId", quantity
        FROM stock_reservations
        WHERE order_id = ${orderId}
          AND status = ${status}::"ReservationStatus"
          ${expiryFilter}
        ORDER BY warehouse_id, product_id
        FOR UPDATE`
}

async function writeMovements(tx, { orderId, type, reservations, afterRows, actorUserId, note }) {
    const after = new Map(afterRows.map((row) => [`${row.warehouseId}:${row.productId}`, row]))

    await tx.inventoryMovement.createMany({
        data: reservations.map((r) => {
            const row = after.get(`${r.warehouseId}:${r.productId}`)

            return {
                warehouseId: r.warehouseId,
                productId: r.productId,
                type,
                quantity: r.quantity,
                onHandAfter: row.onHand,
                reservedAfter: row.reserved,
                orderId,
                actorUserId,
                note,
            }
        }),
    })
}

/**
 * Giải phóng hàng đang giữ của đơn: reserved -= q (on_hand giữ nguyên).
 * Dùng khi: thanh toán thất bại/không hoàn tất (BR-04), hủy PendingPayment (BR-06), hết hạn giữ hàng.
 * Idempotent: không còn reservation ACTIVE → trả count = 0, không đổi tồn kho.
 *
 * @param reason 'RELEASED' (mặc định) hoặc 'EXPIRED'
 * @param expiredBefore chỉ release các reservation có expires_at <= mốc này (dùng cho job hết hạn)
 */
export async function releaseReservations(tx, { orderId, reason = 'RELEASED', expiredBefore, actorUserId = null }) {
    assertId(orderId, 'orderId')

    if (reason !== 'RELEASED' && reason !== 'EXPIRED') {
        throw new TypeError('reason phải là RELEASED hoặc EXPIRED.')
    }

    const reservations = await lockReservations(tx, orderId, 'ACTIVE', expiredBefore)

    if (reservations.length === 0) {
        return { count: 0, items: [], affected: { warehouseIds: [], productIds: [] } }
    }

    const afterRows = []

    for (const r of reservations) {
        const result = await tx.$queryRaw`
            UPDATE inventories
            SET reserved = reserved - ${r.quantity}, version = version + 1, updated_at = NOW()
            WHERE warehouse_id = ${r.warehouseId}
              AND product_id = ${r.productId}
              AND reserved >= ${r.quantity}
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`

        if (result.length !== 1) {
            throw invariantBroken(`release đơn ${orderId}, kho ${r.warehouseId}, sản phẩm ${r.productId}`)
        }

        afterRows.push(mapInventoryRow(result[0]))
    }

    await tx.stockReservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) }, status: 'ACTIVE' },
        data: { status: reason, releasedAt: new Date() },
    })

    await writeMovements(tx, {
        orderId,
        type: MovementType.RELEASE,
        reservations,
        afterRows,
        actorUserId,
        note: reason === 'EXPIRED' ? 'Hết hạn giữ hàng' : null,
    })

    await syncAlertsForRows(tx, afterRows)

    return {
        count: reservations.length,
        items: reservations.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        affected: buildAffected(afterRows),
    }
}

/**
 * Thanh toán thành công (BR-03, SR-INV-03): chuyển hàng giữ thành hàng bán
 * → on_hand -= q, reserved -= q tại kho thực hiện đơn.
 * Idempotent: gọi lặp (callback lặp) trả count = 0, không trừ hai lần.
 * Nếu count = 0 với đơn chưa Paid nghĩa là hàng giữ đã bị release/hết hạn → M2 KHÔNG được chuyển Paid.
 */
export async function consumeReservations(tx, { orderId, actorUserId = null }) {
    assertId(orderId, 'orderId')

    const reservations = await lockReservations(tx, orderId, 'ACTIVE')

    if (reservations.length === 0) {
        return { count: 0, items: [], affected: { warehouseIds: [], productIds: [] } }
    }

    const afterRows = []

    for (const r of reservations) {
        const result = await tx.$queryRaw`
            UPDATE inventories
            SET on_hand = on_hand - ${r.quantity},
                reserved = reserved - ${r.quantity},
                version = version + 1,
                updated_at = NOW()
            WHERE warehouse_id = ${r.warehouseId}
              AND product_id = ${r.productId}
              AND reserved >= ${r.quantity}
              AND on_hand >= ${r.quantity}
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`

        if (result.length !== 1) {
            throw invariantBroken(`consume đơn ${orderId}, kho ${r.warehouseId}, sản phẩm ${r.productId}`)
        }

        afterRows.push(mapInventoryRow(result[0]))
    }

    await tx.stockReservation.updateMany({
        where: { id: { in: reservations.map((r) => r.id) }, status: 'ACTIVE' },
        data: { status: 'CONSUMED', consumedAt: new Date() },
    })

    await writeMovements(tx, { orderId, type: MovementType.CONSUME, reservations, afterRows, actorUserId })
    // available không đổi khi consume, nhưng vẫn đồng bộ để chắc chắn đúng trạng thái cảnh báo.
    await syncAlertsForRows(tx, afterRows)

    return {
        count: reservations.length,
        items: reservations.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        affected: buildAffected(afterRows),
    }
}

/**
 * Hủy đơn Paid (BR-06, SR-CAN-03): hoàn on_hand += q tại ĐÚNG kho đã trừ (lấy từ reservation CONSUMED).
 * Idempotent: nếu đơn đã có nhật ký RESTORE thì không hoàn lần hai.
 * M2 phải đổi trạng thái đơn sang Cancelled trong CÙNG transaction (NFR-REL-03).
 */
export async function restoreConsumedStock(tx, { orderId, actorUserId = null }) {
    assertId(orderId, 'orderId')

    const consumed = await lockReservations(tx, orderId, 'CONSUMED')

    if (consumed.length === 0) {
        return { count: 0, alreadyRestored: false, items: [], affected: { warehouseIds: [], productIds: [] } }
    }

    const restored = await tx.inventoryMovement.count({
        where: { orderId, type: MovementType.RESTORE },
    })

    if (restored > 0) {
        return { count: 0, alreadyRestored: true, items: [], affected: { warehouseIds: [], productIds: [] } }
    }

    const afterRows = []

    for (const r of consumed) {
        const result = await tx.$queryRaw`
            UPDATE inventories
            SET on_hand = on_hand + ${r.quantity}, version = version + 1, updated_at = NOW()
            WHERE warehouse_id = ${r.warehouseId} AND product_id = ${r.productId}
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`

        if (result.length !== 1) {
            throw invariantBroken(`restore đơn ${orderId}, kho ${r.warehouseId}, sản phẩm ${r.productId}`)
        }

        afterRows.push(mapInventoryRow(result[0]))
    }

    await writeMovements(tx, {
        orderId,
        type: MovementType.RESTORE,
        reservations: consumed,
        afterRows,
        actorUserId,
        note: 'Hủy đơn đã thanh toán',
    })

    await syncAlertsForRows(tx, afterRows)

    return {
        count: consumed.length,
        alreadyRestored: false,
        items: consumed.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        affected: buildAffected(afterRows),
    }
}

/**
 * Danh sách đơn có reservation ACTIVE đã quá hạn – để job thu hồi (M2) gọi
 * releaseReservations(tx, { orderId, reason: 'EXPIRED', expiredBefore: now }) cho từng đơn.
 */
export async function findOrdersWithExpiredReservations(client, { now = new Date(), limit = 100 } = {}) {
    const rows = await client.stockReservation.findMany({
        where: { status: 'ACTIVE', expiresAt: { lte: now } },
        select: { orderId: true },
        distinct: ['orderId'],
        orderBy: { orderId: 'asc' },
        take: limit,
    })

    return rows.map((row) => row.orderId)
}

// ---------------------------------------------------------------------------
// Nhập hàng & ngưỡng (UC08, UC06 – SR-INV-05/06, SR-ALERT-01)
// Phân quyền kho (Manager chỉ thao tác kho mình) do service kiểm tra trước khi gọi;
// repository chỉ nhận warehouseId đã được xác thực từ server, không lấy từ frontend.
// ---------------------------------------------------------------------------

export async function restockInventory(tx, { warehouseId, productId, quantity, actorUserId = null, note = null }) {
    assertId(warehouseId, 'warehouseId')
    assertId(productId, 'productId')
    assertPositiveQuantity(quantity, 'quantity')

    let result

    try {
        result = await tx.$queryRaw`
            INSERT INTO inventories (warehouse_id, product_id, on_hand, reserved, low_stock_threshold, version, updated_at)
            VALUES (${warehouseId}, ${productId}, ${quantity}, 0, 0, 0, NOW())
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET on_hand = inventories.on_hand + EXCLUDED.on_hand,
                version = inventories.version + 1,
                updated_at = NOW()
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`
    } catch (error) {
        if (isForeignKeyViolation(error)) {
            throw validationError([{ field: 'productId', reason: 'Kho hoặc sản phẩm không tồn tại.' }])
        }

        throw error
    }

    const row = mapInventoryRow(result[0])

    await tx.inventoryMovement.create({
        data: {
            warehouseId,
            productId,
            type: MovementType.RESTOCK,
            quantity,
            onHandAfter: row.onHand,
            reservedAfter: row.reserved,
            actorUserId,
            note,
        },
    })

    await syncLowStockAlerts(tx, warehouseId, [productId])

    return { inventory: row, affected: buildAffected([row]) }
}

export async function setLowStockThreshold(tx, { warehouseId, productId, threshold }) {
    assertId(warehouseId, 'warehouseId')
    assertId(productId, 'productId')
    assertThreshold(threshold)

    let result

    try {
        result = await tx.$queryRaw`
            INSERT INTO inventories (warehouse_id, product_id, on_hand, reserved, low_stock_threshold, version, updated_at)
            VALUES (${warehouseId}, ${productId}, 0, 0, ${threshold}, 0, NOW())
            ON CONFLICT (warehouse_id, product_id) DO UPDATE
            SET low_stock_threshold = EXCLUDED.low_stock_threshold,
                version = inventories.version + 1,
                updated_at = NOW()
            RETURNING id, warehouse_id, product_id, on_hand, reserved, low_stock_threshold`
    } catch (error) {
        if (isForeignKeyViolation(error)) {
            throw validationError([{ field: 'productId', reason: 'Kho hoặc sản phẩm không tồn tại.' }])
        }

        throw error
    }

    const row = mapInventoryRow(result[0])
    await syncLowStockAlerts(tx, warehouseId, [productId])

    return { inventory: row, affected: buildAffected([row]) }
}

// ---------------------------------------------------------------------------
// Đọc dữ liệu (UC05 – SR-INV-04; UC06 – SR-ALERT-03; SR-CAT-03)
// ---------------------------------------------------------------------------

/** Tồn kho chi tiết theo (kho, sản phẩm). Manager được xem MỌI kho (BR-08). */
export async function listInventory(client, { warehouseId, productId, search, page = 1, limit = 50 } = {}) {
    const where = {
        ...(warehouseId ? { warehouseId } : {}),
        ...(productId ? { productId } : {}),
        ...(search
            ? {
                  product: {
                      OR: [
                          { name: { contains: search, mode: 'insensitive' } },
                          { sku: { contains: search, mode: 'insensitive' } },
                      ],
                  },
              }
            : {}),
    }

    const [total, rows] = await Promise.all([
        client.inventory.count({ where }),
        client.inventory.findMany({
            where,
            include: {
                product: { select: { id: true, sku: true, name: true, category: true, isActive: true } },
                warehouse: { select: { id: true, code: true, name: true } },
            },
            orderBy: [{ warehouseId: 'asc' }, { productId: 'asc' }],
            skip: (page - 1) * limit,
            take: limit,
        }),
    ])

    return {
        total,
        page,
        limit,
        items: rows.map((row) => ({
            warehouseId: row.warehouseId,
            warehouseName: row.warehouse.name,
            productId: row.productId,
            sku: row.product.sku,
            productName: row.product.name,
            category: row.product.category,
            isActive: row.product.isActive,
            onHand: row.onHand,
            reserved: row.reserved,
            available: computeAvailable(row),
            lowStockThreshold: row.lowStockThreshold,
            updatedAt: row.updatedAt,
        })),
    }
}

/** Tổng hợp toàn hệ thống theo sản phẩm (SR-INV-04 – chế độ aggregate). */
export async function getInventorySummary(client, { productId } = {}) {
    const productFilter = productId ? Prisma.sql`WHERE p.id = ${productId}` : Prisma.empty

    const rows = await client.$queryRaw`
        SELECT p.id AS "productId", p.sku, p.name AS "productName", p.category, p.is_active AS "isActive",
               COALESCE(SUM(i.on_hand), 0)::int AS "onHand",
               COALESCE(SUM(i.reserved), 0)::int AS reserved,
               COUNT(i.id)::int AS "warehouseCount"
        FROM products p
        LEFT JOIN inventories i ON i.product_id = p.id
        ${productFilter}
        GROUP BY p.id
        ORDER BY p.id`

    return rows.map((row) => ({ ...row, available: row.onHand - row.reserved }))
}

/** Cảnh báo OPEN của MỘT kho – service phải truyền kho được phân công của Manager (BR-10). */
export async function listOpenAlerts(client, { warehouseId }) {
    assertId(warehouseId, 'warehouseId')

    const alerts = await client.lowStockAlert.findMany({
        where: { warehouseId, status: 'OPEN' },
        include: { product: { select: { id: true, sku: true, name: true } } },
        orderBy: { createdAt: 'desc' },
    })

    const inventories = await client.inventory.findMany({
        where: { warehouseId, productId: { in: alerts.map((a) => a.productId) } },
    })
    const current = new Map(inventories.map((row) => [row.productId, row]))

    return alerts.map((alert) => {
        const row = current.get(alert.productId)

        return {
            id: alert.id,
            warehouseId: alert.warehouseId,
            productId: alert.productId,
            sku: alert.product.sku,
            productName: alert.product.name,
            availableAtTrigger: alert.availableAtTrigger,
            currentAvailable: row ? computeAvailable(row) : 0,
            threshold: row?.lowStockThreshold ?? alert.threshold,
            createdAt: alert.createdAt,
        }
    })
}

/** Tổng available theo sản phẩm (cho trạng thái "còn hàng/hết hàng" ở catalog – SR-CAT-03). */
export async function getAvailableByProduct(client, productIds) {
    if (!productIds?.length) {
        return new Map()
    }

    const rows = await client.$queryRaw`
        SELECT product_id AS "productId", COALESCE(SUM(on_hand - reserved), 0)::int AS available
        FROM inventories
        WHERE product_id IN (${Prisma.join(productIds)})
        GROUP BY product_id`

    return new Map(rows.map((row) => [row.productId, row.available]))
}

/**
 * Đối soát bất biến (cho M4 sau load test – T08, NFR-PER-05):
 * trả về các dòng tồn kho vi phạm, hoặc reserved ≠ tổng reservation ACTIVE. Mảng rỗng = nhất quán.
 */
export async function findInventoryInvariantViolations(client) {
    return client.$queryRaw`
        SELECT i.warehouse_id AS "warehouseId", i.product_id AS "productId",
               i.on_hand AS "onHand", i.reserved,
               COALESCE(r.active_quantity, 0)::int AS "activeReservedQuantity"
        FROM inventories i
        LEFT JOIN (
            SELECT warehouse_id, product_id, SUM(quantity) AS active_quantity
            FROM stock_reservations
            WHERE status = 'ACTIVE'
            GROUP BY warehouse_id, product_id
        ) r ON r.warehouse_id = i.warehouse_id AND r.product_id = i.product_id
        WHERE i.on_hand < 0
           OR i.reserved < 0
           OR i.reserved > i.on_hand
           OR i.reserved <> COALESCE(r.active_quantity, 0)
        ORDER BY i.warehouse_id, i.product_id`
}
