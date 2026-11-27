import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { cacheStoreRef, prismaMock, txMock, runInTransaction } = vi.hoisted(() => {
    const cacheStoreRef = { current: null }
    const txMock = {
        $queryRaw: vi.fn(),
        $executeRaw: vi.fn(),
        product: {
            create: vi.fn(),
            update: vi.fn(),
            findUnique: vi.fn(),
        },
        warehouse: {
            findMany: vi.fn(),
        },
        inventory: {
            createMany: vi.fn(),
            findMany: vi.fn(),
        },
        inventoryMovement: {
            create: vi.fn(),
        },
        adminAuditLog: {
            create: vi.fn(),
        },
    }

    const prismaMock = {
        user: {
            findUnique: vi.fn(),
        },
        warehouse: {
            findMany: vi.fn(),
        },
        product: {
            count: vi.fn(),
            findMany: vi.fn(),
            findUnique: vi.fn(),
        },
        inventory: {
            count: vi.fn(),
            findMany: vi.fn(),
        },
        lowStockAlert: {
            findMany: vi.fn(),
        },
        $queryRaw: vi.fn(),
        $executeRaw: vi.fn(),
        $transaction: vi.fn((ops) => Promise.all(ops)),
    }

    return {
        cacheStoreRef,
        prismaMock,
        txMock,
        runInTransaction: vi.fn(),
    }
})

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))
vi.mock('../../src/db/redis.js', async () => {
    const actual = await vi.importActual('../../src/db/redis.js')
    cacheStoreRef.current = actual.createMemoryCacheStore()
    return {
        ...actual,
        getOrSetCache(key, ttlSeconds, loader, options = {}) {
            return actual.getOrSetCache(key, ttlSeconds, loader, {
                store: options.store ?? cacheStoreRef.current,
            })
        },
        invalidateInventoryCache(affected, options = {}) {
            return actual.invalidateInventoryCache(affected, {
                store: options.store ?? cacheStoreRef.current,
            })
        },
        invalidateProductCache(affected, options = {}) {
            return actual.invalidateProductCache(affected, {
                store: options.store ?? cacheStoreRef.current,
            })
        },
    }
})

import {
    CacheKeys,
    createMemoryCacheStore,
} from '../../src/db/redis.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import inventoryRoutes from '../../src/modules/inventory/inventory.routes.js'
import { adminProductRoutes, catalogRoutes } from '../../src/modules/product/product.routes.js'

const JWT_SECRET = 'test-redis-cache-and-warehouse-read-secret'
const app = express()
app.use(express.json())
app.use('/api/products', catalogRoutes)
app.use('/api/admin/products', adminProductRoutes)
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
    vi.clearAllMocks()
    cacheStoreRef.current = createMemoryCacheStore()
    runInTransaction.mockImplementation((work) => work(txMock))
})

afterEach(() => vi.clearAllMocks())

describe('Nghiệp vụ 4: Redis cache cho Product & Inventory summary', () => {
    it('tạo key summary riêng biệt theo bộ lọc kho / sản phẩm và tương thích key mặc định', () => {
        expect(CacheKeys.inventorySummary()).toBe('mw:inv:summary')
        expect(CacheKeys.inventorySummary({ warehouseId: 2 })).toBe('mw:inv:summary:wh=2:p=all')
        expect(CacheKeys.inventorySummary({ warehouseId: 2, productId: 9 })).toBe(
            'mw:inv:summary:wh=2:p=9'
        )
    })

    it('cache-aside danh sách và chi tiết sản phẩm rồi xóa cache sau khi Admin cập nhật', async () => {
        const dbProduct = {
            id: 7,
            sku: 'SKU-0007',
            name: 'MacBook Air M3',
            category: 'Laptop',
            price: 27990000,
            description: 'Mỏng nhẹ',
            imageUrl: '/images/mba.png',
            isActive: true,
            discontinuedAt: null,
            createdAt: new Date('2026-11-01T00:00:00.000Z'),
            updatedAt: new Date('2026-11-01T00:00:00.000Z'),
        }
        prismaMock.product.count.mockResolvedValue(1)
        prismaMock.product.findMany.mockResolvedValue([dbProduct])
        prismaMock.product.findUnique.mockResolvedValue(dbProduct)
        prismaMock.$queryRaw.mockResolvedValue([{ productId: 7, available: 5 }])
        prismaMock.inventory.findMany.mockResolvedValue([{ productId: 7, onHand: 5, reserved: 0 }])

        const firstList = await fetch(`${apiUrl}/api/products?page=1&limit=12`)
        const secondList = await fetch(`${apiUrl}/api/products?page=1&limit=12`)
        expect(firstList.status).toBe(200)
        expect(secondList.status).toBe(200)
        expect(prismaMock.product.findMany).toHaveBeenCalledTimes(1)

        const firstDetail = await fetch(`${apiUrl}/api/products/7`)
        const secondDetail = await fetch(`${apiUrl}/api/products/7`)
        expect(firstDetail.status).toBe(200)
        expect(secondDetail.status).toBe(200)
        expect(prismaMock.product.findUnique).toHaveBeenCalledTimes(1)

        // Admin cập nhật sản phẩm -> xóa cache list + detail
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 99,
            username: 'admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        txMock.product.findUnique.mockResolvedValueOnce(dbProduct)
        txMock.product.update.mockResolvedValueOnce({ ...dbProduct, price: 26990000 })
        txMock.$queryRaw.mockResolvedValueOnce([{ productId: 7, available: 5 }])

        const patchRes = await fetch(`${apiUrl}/api/admin/products/7`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(99)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ price: 26990000 }),
        })
        expect(patchRes.status).toBe(200)

        await fetch(`${apiUrl}/api/products?page=1&limit=12`)
        await fetch(`${apiUrl}/api/products/7`)
        expect(prismaMock.product.findMany).toHaveBeenCalledTimes(2)
        expect(prismaMock.product.findUnique).toHaveBeenCalledTimes(2)
    })

    it('cache inventory summary theo đúng kho lọc và xóa cache khi restock', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        prismaMock.$queryRaw
            .mockResolvedValueOnce([{ warehouseId: 1, onHand: 10, reserved: 2 }])
            .mockResolvedValueOnce([{ warehouseId: 2, onHand: 5, reserved: 0 }])

        const wh1Res1 = await fetch(`${apiUrl}/api/inventory/summary?warehouseId=1`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        const wh1Res2 = await fetch(`${apiUrl}/api/inventory/summary?warehouseId=1`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        const wh2Res = await fetch(`${apiUrl}/api/inventory/summary?warehouseId=2`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })

        expect(wh1Res1.status).toBe(200)
        expect(wh1Res2.status).toBe(200)
        expect(wh2Res.status).toBe(200)
        await expect(wh1Res2.json()).resolves.toEqual({
            success: true,
            data: [{ warehouseId: 1, onHand: 10, reserved: 2, available: 8 }],
        })
        await expect(wh2Res.json()).resolves.toEqual({
            success: true,
            data: [{ warehouseId: 2, onHand: 5, reserved: 0, available: 5 }],
        })
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(2)

        // Restock kho 1 -> invalidate tất cả key summary
        txMock.$queryRaw.mockResolvedValueOnce([
            {
                id: 10,
                warehouse_id: 1,
                product_id: 7,
                on_hand: 15,
                reserved: 2,
                low_stock_threshold: 5,
            },
        ])
        txMock.inventoryMovement.create.mockResolvedValueOnce({ id: 50 })
        txMock.$executeRaw.mockResolvedValue(0)

        const restockRes = await fetch(`${apiUrl}/api/inventory/1/restock`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 7, quantity: 5 }),
        })
        expect(restockRes.status).toBe(200)

        prismaMock.$queryRaw.mockResolvedValueOnce([{ warehouseId: 1, onHand: 15, reserved: 2 }])
        const wh1After = await fetch(`${apiUrl}/api/inventory/summary?warehouseId=1`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        await expect(wh1After.json()).resolves.toEqual({
            success: true,
            data: [{ warehouseId: 1, onHand: 15, reserved: 2, available: 13 }],
        })
        expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(3)
    })
})

describe('Nghiệp vụ 5A: Phân quyền đọc toàn kho cho Quản lý kho & khóa thao tác ngoài kho', () => {
    it('cho phép Quản lý kho xem danh sách kho, summary và tồn kho của kho khác', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        prismaMock.warehouse.findMany.mockResolvedValue([
            { id: 1, name: 'Kho TP. Hồ Chí Minh', code: 'HCM' },
            { id: 2, name: 'Kho Hà Nội', code: 'HN' },
            { id: 3, name: 'Kho Đà Nẵng', code: 'DN' },
        ])
        prismaMock.inventory.count.mockResolvedValue(1)
        prismaMock.inventory.findMany.mockResolvedValue([
            {
                warehouseId: 2,
                productId: 7,
                onHand: 12,
                reserved: 3,
                lowStockThreshold: 5,
                updatedAt: new Date('2026-11-27T00:00:00.000Z'),
                warehouse: { id: 2, name: 'Kho Hà Nội', code: 'HN' },
                product: { id: 7, sku: 'SKU-0007', name: 'MacBook Air M3', category: 'Laptop', isActive: true },
            },
        ])

        const whRes = await fetch(`${apiUrl}/api/inventory/warehouses`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(whRes.status).toBe(200)
        expect(prismaMock.warehouse.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { id: undefined } })
        )

        const invRes = await fetch(`${apiUrl}/api/inventory?warehouseId=2`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(invRes.status).toBe(200)
        expect(prismaMock.inventory.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ where: { warehouseId: 2 } })
        )
    })

    it('vẫn chặn 403 khi Quản lý kho truy cập cảnh báo, nhập hàng hoặc đặt ngưỡng cho kho khác', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })

        const alertRes = await fetch(`${apiUrl}/api/inventory/alerts?warehouseId=2`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(alertRes.status).toBe(403)

        const restockRes = await fetch(`${apiUrl}/api/inventory/2/restock`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 7, quantity: 3 }),
        })
        expect(restockRes.status).toBe(403)

        const thresholdRes = await fetch(`${apiUrl}/api/inventory/2/threshold`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ productId: 7, threshold: 5 }),
        })
        expect(thresholdRes.status).toBe(403)
    })
})
