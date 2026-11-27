import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, prismaMock, runInTransaction } = vi.hoisted(() => {
    const tx = {
        $queryRaw: vi.fn(),
        order: {
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        inventoryMovement: {
            create: vi.fn(),
        },
    }

    const prismaMock = {
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
        },
        order: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
        inventoryMovement: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    }

    return {
        tx,
        prismaMock,
        runInTransaction: vi.fn(),
    }
})

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))

import adminOrderRoutes from '../../src/modules/order/order.admin.routes.js'
import inventoryRoutes from '../../src/modules/inventory/inventory.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { listAdminOrders } from '../../src/modules/order/order.query.service.js'
import { transitionAdminOrderToProcessing } from '../../src/modules/order/order.admin.service.js'
import { adjustInventory, listInventoryMovements } from '../../src/modules/inventory/inventory.repository.js'
import { ErrorCodes } from '../../src/shared/errors.js'

const JWT_SECRET = 'test-warehouse-operations-secret'
const app = express()
app.use(express.json())
app.use('/api/admin/orders', adminOrderRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use(errorHandler)

const server = createServer(app)
let apiUrl
let originalJwtSecret

function signToken(userId) {
    return jwt.sign({}, JWT_SECRET, {
        algorithm: 'HS256',
        subject: String(userId),
        expiresIn: '1h',
    })
}

beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = JWT_SECRET
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
    await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    )
})

beforeEach(() => {
    prismaMock.$transaction.mockImplementation((ops) => Promise.all(ops))
    runInTransaction.mockImplementation((work) => work(tx))
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('Step 1: Warehouse Manager order processing & warehouse scope', () => {
    it('filters listAdminOrders by fulfillmentWarehouseId when warehouseId is provided', async () => {
        prismaMock.order.findMany.mockResolvedValue([])
        prismaMock.order.count.mockResolvedValue(0)

        await listAdminOrders({ status: 'Paid' }, { warehouseId: 2 })

        expect(prismaMock.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: 'Paid', fulfillmentWarehouseId: 2 },
            })
        )
    })

    it('rejects processing an order outside the manager assigned warehouse', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 42 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 42,
            status: 'Paid',
            version: 1,
            fulfillmentWarehouseId: 1,
            updatedAt: new Date('2026-11-20T10:00:00.000Z'),
        })

        await expect(
            transitionAdminOrderToProcessing(42, { warehouseId: 2 })
        ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN })
        expect(tx.order.update).not.toHaveBeenCalled()
    })

    it('allows manager to list and process orders in assigned warehouse, blocks cross-warehouse and customer', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        prismaMock.order.findMany.mockResolvedValue([])
        prismaMock.order.count.mockResolvedValue(0)

        const listRes = await fetch(`${apiUrl}/api/admin/orders?status=Paid`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(listRes.status).toBe(200)
        expect(prismaMock.order.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { status: 'Paid', fulfillmentWarehouseId: 1 },
            })
        )

        tx.$queryRaw.mockResolvedValue([{ id: 55 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 55,
            status: 'Paid',
            version: 1,
            fulfillmentWarehouseId: 1,
            updatedAt: new Date('2026-11-20T10:00:00.000Z'),
        })
        tx.order.update.mockResolvedValue({
            id: 55,
            status: 'Processing',
            version: 2,
            updatedAt: new Date('2026-11-20T10:01:00.000Z'),
        })

        const patchOk = await fetch(`${apiUrl}/api/admin/orders/55/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'Processing' }),
        })
        expect(patchOk.status).toBe(200)

        tx.$queryRaw.mockResolvedValue([{ id: 56 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 56,
            status: 'Paid',
            version: 1,
            fulfillmentWarehouseId: 3,
            updatedAt: new Date('2026-11-20T10:00:00.000Z'),
        })

        const patchForbidden = await fetch(`${apiUrl}/api/admin/orders/56/status`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'Processing' }),
        })
        expect(patchForbidden.status).toBe(403)

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 1,
            username: 'customer',
            role: 'CUSTOMER',
            assignedWarehouseId: null,
            isActive: true,
        })
        const customerRes = await fetch(`${apiUrl}/api/admin/orders`, {
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(customerRes.status).toBe(403)
    })
})

describe('Step 2: Inventory movement history API & repository', () => {
    it('formats movement rows with availableAfter and filters cleanly', async () => {
        prismaMock.inventoryMovement.count.mockResolvedValue(1)
        prismaMock.inventoryMovement.findMany.mockResolvedValue([
            {
                id: 9,
                warehouseId: 1,
                productId: 2,
                type: 'ADJUST',
                quantity: 3,
                onHandAfter: 17,
                reservedAfter: 2,
                orderId: null,
                note: '20 → 17: Hàng hỏng',
                createdAt: new Date('2026-11-26T09:00:00.000Z'),
                warehouse: { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh' },
                product: { id: 2, sku: 'SKU-0002', name: 'Logitech G304' },
                actor: { id: 2, username: 'warehouse', fullName: 'Quản lý kho HCM' },
            },
        ])

        const res = await listInventoryMovements(prismaMock, {
            warehouseId: 1,
            type: 'ADJUST',
            search: 'Logitech',
            page: 1,
            limit: 20,
        })

        expect(res.total).toBe(1)
        expect(res.items[0]).toEqual({
            id: 9,
            warehouseId: 1,
            warehouseCode: 'HCM',
            warehouseName: 'Kho TP. Hồ Chí Minh',
            productId: 2,
            sku: 'SKU-0002',
            productName: 'Logitech G304',
            type: 'ADJUST',
            quantity: 3,
            onHandAfter: 17,
            reservedAfter: 2,
            availableAfter: 15,
            orderId: null,
            actorUsername: 'warehouse',
            note: '20 → 17: Hàng hỏng',
            createdAt: '2026-11-26T09:00:00.000Z',
        })
    })

    it('scopes GET /api/inventory/movements to manager warehouse and rejects invalid query', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 2,
            isActive: true,
        })
        prismaMock.inventoryMovement.count.mockResolvedValue(0)
        prismaMock.inventoryMovement.findMany.mockResolvedValue([])

        const okRes = await fetch(`${apiUrl}/api/inventory/movements?type=RESTOCK`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(okRes.status).toBe(200)
        expect(prismaMock.inventoryMovement.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ warehouseId: 2, type: 'RESTOCK' }),
            })
        )

        const crossWarehouse = await fetch(`${apiUrl}/api/inventory/movements?warehouseId=1`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(crossWarehouse.status).toBe(403)

        const badType = await fetch(`${apiUrl}/api/inventory/movements?type=UNKNOWN`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(badType.status).toBe(400)
    })
})

describe('Step 3: Stocktaking / inventory adjustment (ADJUST)', () => {
    it('validates non-negative onHand, non-empty note, and onHand >= reserved', async () => {
        await expect(
            adjustInventory(tx, { warehouseId: 1, productId: 2, newOnHand: -1, note: 'Test' })
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })

        await expect(
            adjustInventory(tx, { warehouseId: 1, productId: 2, newOnHand: 5, note: '   ' })
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })

        tx.$queryRaw
            .mockResolvedValueOnce([]) // INSERT ON CONFLICT DO NOTHING
            .mockResolvedValueOnce([
                {
                    id: 10,
                    warehouse_id: 1,
                    product_id: 2,
                    on_hand: 10,
                    reserved: 6,
                    low_stock_threshold: 2,
                },
            ])

        await expect(
            adjustInventory(tx, { warehouseId: 1, productId: 2, newOnHand: 4, note: 'Kiểm kê' })
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })
    })

    it('returns changed: false without writing movement when onHand is unchanged', async () => {
        tx.$queryRaw
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([
                {
                    id: 10,
                    warehouse_id: 1,
                    product_id: 2,
                    on_hand: 10,
                    reserved: 2,
                    low_stock_threshold: 2,
                },
            ])

        const res = await adjustInventory(tx, {
            warehouseId: 1,
            productId: 2,
            newOnHand: 10,
            actorUserId: 2,
            note: 'Kiểm kê khớp',
        })

        expect(res.changed).toBe(false)
        expect(tx.inventoryMovement.create).not.toHaveBeenCalled()
    })

    it('updates onHand, logs unsigned ADJUST movement, and syncs low-stock alerts', async () => {
        tx.$queryRaw
            .mockResolvedValueOnce([]) // INSERT ON CONFLICT DO NOTHING
            .mockResolvedValueOnce([
                {
                    id: 10,
                    warehouse_id: 1,
                    product_id: 2,
                    on_hand: 20,
                    reserved: 3,
                    low_stock_threshold: 5,
                },
            ])
            .mockResolvedValueOnce([
                {
                    id: 10,
                    warehouse_id: 1,
                    product_id: 2,
                    on_hand: 14,
                    reserved: 3,
                    low_stock_threshold: 5,
                },
            ])
            .mockResolvedValueOnce(1) // syncLowStockAlerts INSERT
            .mockResolvedValueOnce(0) // syncLowStockAlerts UPDATE

        // Ensure $executeRaw is defined for syncLowStockAlerts
        tx.$executeRaw = vi.fn().mockResolvedValue(0)
        tx.inventoryMovement.create.mockResolvedValue({ id: 99 })

        const res = await adjustInventory(tx, {
            warehouseId: 1,
            productId: 2,
            newOnHand: 14,
            actorUserId: 2,
            note: 'Hàng hư hỏng',
        })

        expect(res.changed).toBe(true)
        expect(res.inventory.onHand).toBe(14)
        expect(res.inventory.available).toBe(11)
        expect(tx.inventoryMovement.create).toHaveBeenCalledWith({
            data: {
                warehouseId: 1,
                productId: 2,
                type: 'ADJUST',
                quantity: 6,
                onHandAfter: 14,
                reservedAfter: 3,
                actorUserId: 2,
                note: '20 → 14: Hàng hư hỏng',
            },
        })
        expect(tx.$executeRaw).toHaveBeenCalledTimes(2)
    })

    it('enforces WAREHOUSE_MANAGER role and assigned warehouse on PATCH /api/inventory/:warehouseId/adjust', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 3,
            username: 'admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        const adminRes = await fetch(`${apiUrl}/api/inventory/1/adjust`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(3)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 2, onHand: 10, note: 'Test' }),
        })
        expect(adminRes.status).toBe(403)

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        const crossRes = await fetch(`${apiUrl}/api/inventory/2/adjust`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 2, onHand: 10, note: 'Test' }),
        })
        expect(crossRes.status).toBe(403)
    })
})
