import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        $executeRaw: vi.fn(),
        user: {
            findUnique: vi.fn(),
        },
        lowStockAlert: {
            findMany: vi.fn(),
        },
        inventory: {
            findMany: vi.fn(),
        },
    },
}))

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction: vi.fn() }))

import inventoryRoutes from '../../src/modules/inventory/inventory.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { listOpenAlerts, syncAllLowStockAlerts } from '../../src/modules/inventory/inventory.repository.js'
import { buildProductFallback, mergeInventoryProducts } from '../../../src/utils/stockThresholds.js'

const JWT_SECRET = 'test-low-stock-alert-sync-secret'
const app = express()
app.use(express.json())
app.use('/api/inventory', inventoryRoutes)
app.use(errorHandler)

const server = createServer(app)
let apiUrl
let originalJwtSecret

function signToken(userId) {
    return jwt.sign({}, JWT_SECRET, {
        algorithm: 'HS256',
        subject: String(userId),
    })
}

beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = JWT_SECRET
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterEach(() => {
    vi.clearAllMocks()
})

afterAll(async () => {
    process.env.JWT_SECRET = originalJwtSecret
    await new Promise(resolve => server.close(resolve))
})

describe('low-stock alert synchronization', () => {
    it('runs idempotent insert and resolve SQL across all warehouses when warehouseId is omitted', async () => {
        prismaMock.$executeRaw.mockResolvedValue(0)

        await syncAllLowStockAlerts(prismaMock)

        expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2)
        const [insertStrings, ...insertValues] = prismaMock.$executeRaw.mock.calls[0]
        const [updateStrings, ...updateValues] = prismaMock.$executeRaw.mock.calls[1]

        expect(insertStrings.join(' ')).toContain('INSERT INTO low_stock_alerts')
        expect(insertStrings.join(' ')).toContain("ON CONFLICT (warehouse_id, product_id) WHERE status = 'OPEN' DO NOTHING")
        expect(insertValues[0]).toBeNull()
        expect(updateStrings.join(' ')).toContain('UPDATE low_stock_alerts')
        expect(updateStrings.join(' ')).toContain("SET status = 'RESOLVED'")
        expect(updateValues[0]).toBeNull()
    })

    it('rejects invalid warehouseId and skips empty productIds in syncAllLowStockAlerts', async () => {
        await expect(syncAllLowStockAlerts(prismaMock, { warehouseId: 0 })).rejects.toMatchObject({
            httpStatus: 400,
        })

        await syncAllLowStockAlerts(prismaMock, { warehouseId: 2, productIds: [] })
        expect(prismaMock.$executeRaw).not.toHaveBeenCalled()
    })

    it('syncs alerts before reading on GET /api/inventory/alerts for ADMIN and scoped WAREHOUSE_MANAGER', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 3,
            username: 'admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        prismaMock.$executeRaw.mockResolvedValue(2)
        prismaMock.lowStockAlert.findMany.mockResolvedValueOnce([
            {
                id: 11,
                warehouseId: 1,
                productId: 40,
                availableAtTrigger: 0,
                threshold: 5,
                createdAt: new Date('2026-11-26T10:00:00Z'),
                product: {
                    id: 40,
                    sku: 'SKU-0040',
                    name: 'Sản phẩm ngừng kinh doanh',
                    category: 'Laptop',
                    imageUrl: '/uploads/products/sample.png',
                    isActive: false,
                },
            },
        ])
        prismaMock.inventory.findMany.mockResolvedValueOnce([
            {
                warehouseId: 1,
                productId: 40,
                onHand: 0,
                reserved: 0,
                lowStockThreshold: 5,
            },
        ])

        const adminRes = await fetch(`${apiUrl}/api/inventory/alerts`, {
            headers: { Authorization: `Bearer ${signToken(3)}` },
        })
        expect(adminRes.status).toBe(200)
        const adminBody = await adminRes.json()
        expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(2)
        expect(prismaMock.$executeRaw.mock.calls[0][1]).toBeNull()
        expect(adminBody.data).toEqual([
            expect.objectContaining({
                id: 11,
                warehouseId: 1,
                productId: 40,
                productName: 'Sản phẩm ngừng kinh doanh',
                imageUrl: '/uploads/products/sample.png',
                isActive: false,
                currentAvailable: 0,
                threshold: 5,
            }),
        ])

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 5,
            username: 'warehouse2',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 2,
            isActive: true,
        })
        prismaMock.lowStockAlert.findMany.mockResolvedValueOnce([])

        const managerRes = await fetch(`${apiUrl}/api/inventory/alerts`, {
            headers: { Authorization: `Bearer ${signToken(5)}` },
        })
        expect(managerRes.status).toBe(200)
        const managerBody = await managerRes.json()
        expect(managerBody.data).toEqual([])
        expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(4)
        expect(prismaMock.$executeRaw.mock.calls[2][1]).toBe(2)
        expect(prismaMock.inventory.findMany).toHaveBeenCalledTimes(1)
    })

    it('listOpenAlerts avoids extra inventory lookup when there are no open alerts', async () => {
        prismaMock.lowStockAlert.findMany.mockResolvedValueOnce([])

        const alerts = await listOpenAlerts(prismaMock, { warehouseId: 3 })

        expect(alerts).toEqual([])
        expect(prismaMock.inventory.findMany).not.toHaveBeenCalled()
    })

    it('merges inventory and alert products without losing discontinued items for warehouse managers', () => {
        const activeProducts = [
            { id: 1, name: 'Laptop A', category: 'Laptop', status: 'ACTIVE' },
        ]
        const inventoryRows = [
            { productId: 1, productName: 'Laptop A', category: 'Laptop', isActive: true },
            {
                productId: 40,
                sku: 'SKU-0040',
                productName: 'Laptop ngừng bán',
                category: 'Laptop',
                imageUrl: '/images/products/p40.jpg',
                isActive: false,
            },
        ]

        const merged = mergeInventoryProducts(activeProducts, inventoryRows)

        expect(merged).toHaveLength(2)
        expect(merged[1]).toEqual({
            id: 40,
            sku: 'SKU-0040',
            name: 'Laptop ngừng bán',
            category: 'Laptop',
            imageUrl: '/images/products/p40.jpg',
            status: 'DISCONTINUED',
        })
        expect(buildProductFallback(null)).toBeNull()
    })
})
