import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, prismaMock, runInTransaction } = vi.hoisted(() => {
    const tx = {
        $queryRaw: vi.fn(),
        user: {
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        warehouse: {
            findUnique: vi.fn(),
        },
    }

    const prismaMock = {
        user: {
            findUnique: vi.fn(),
            findMany: vi.fn(),
        },
        warehouse: {
            findMany: vi.fn(),
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

import adminUserRoutes from '../../src/modules/auth/admin-users.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import {
    assignWarehouseToManager,
    listWarehouseManagerAssignments,
    validateAssignWarehouseBody,
} from '../../src/modules/auth/admin-users.service.js'
import { ErrorCodes } from '../../src/shared/errors.js'

const JWT_SECRET = 'test-admin-warehouse-assignment-secret'
const app = express()
app.use(express.json())
app.use('/api/admin/warehouse-managers', adminUserRoutes)
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
    if (originalJwtSecret === undefined) {
        delete process.env.JWT_SECRET
    } else {
        process.env.JWT_SECRET = originalJwtSecret
    }
    await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    )
})

beforeEach(() => {
    runInTransaction.mockImplementation((work) => work(tx))
})

afterEach(() => {
    vi.clearAllMocks()
})

describe('Admin warehouse manager assignment service', () => {
    it('validates body fields strictly', () => {
        expect(validateAssignWarehouseBody({ warehouseId: 2 })).toEqual({ warehouseId: 2 })
        expect(validateAssignWarehouseBody({ warehouseId: '3' })).toEqual({ warehouseId: 3 })

        for (const invalid of [
            null,
            [],
            {},
            { warehouseId: null },
            { warehouseId: 0 },
            { warehouseId: -1 },
            { warehouseId: 1.5 },
            { warehouseId: '2abc' },
            { warehouseId: 2, role: 'ADMIN' },
        ]) {
            expect(() => validateAssignWarehouseBody(invalid)).toThrow()
        }
    })

    it('lists warehouse managers and warehouses without password hashes', async () => {
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: 2,
                username: 'warehouse',
                fullName: 'Quản lý kho HCM',
                role: 'WAREHOUSE_MANAGER',
                assignedWarehouseId: 1,
                isActive: true,
                assignedWarehouse: { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh' },
            },
        ])
        prismaMock.warehouse.findMany.mockResolvedValue([
            { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh', address: 'TP.HCM' },
            { id: 2, code: 'HN', name: 'Kho Hà Nội', address: 'Hà Nội' },
        ])

        const result = await listWarehouseManagerAssignments()

        expect(result.managers).toHaveLength(1)
        expect(result.managers[0]).not.toHaveProperty('passwordHash')
        expect(result.managers[0].assignedWarehouse).toEqual({
            id: 1,
            code: 'HCM',
            name: 'Kho TP. Hồ Chí Minh',
        })
        expect(result.warehouses).toHaveLength(2)
    })

    it('reassigns an active warehouse manager atomically', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 2 }])
        tx.user.findUniqueOrThrow.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            fullName: 'Quản lý kho HCM',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
            assignedWarehouse: { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh' },
        })
        tx.warehouse.findUnique.mockResolvedValue({
            id: 2,
            code: 'HN',
            name: 'Kho Hà Nội',
        })
        tx.user.update.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            fullName: 'Quản lý kho HCM',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 2,
            isActive: true,
            assignedWarehouse: { id: 2, code: 'HN', name: 'Kho Hà Nội' },
        })

        const result = await assignWarehouseToManager('2', { warehouseId: 2 })

        expect(result).toEqual({
            changed: true,
            manager: {
                id: 2,
                username: 'warehouse',
                fullName: 'Quản lý kho HCM',
                role: 'WAREHOUSE_MANAGER',
                assignedWarehouseId: 2,
                isActive: true,
                assignedWarehouse: { id: 2, code: 'HN', name: 'Kho Hà Nội' },
            },
        })
        expect(tx.user.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 2 },
                data: { assignedWarehouseId: 2 },
            })
        )
    })

    it('returns unchanged manager idempotently without writing when already assigned to target warehouse', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 2 }])
        tx.user.findUniqueOrThrow.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            fullName: 'Quản lý kho HCM',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 2,
            isActive: true,
            assignedWarehouse: { id: 2, code: 'HN', name: 'Kho Hà Nội' },
        })
        tx.warehouse.findUnique.mockResolvedValue({
            id: 2,
            code: 'HN',
            name: 'Kho Hà Nội',
        })

        const result = await assignWarehouseToManager(2, { warehouseId: 2 })

        expect(result.changed).toBe(false)
        expect(result.manager.assignedWarehouseId).toBe(2)
        expect(tx.user.update).not.toHaveBeenCalled()
    })

    it('rejects missing user, non-manager role, inactive manager, and missing warehouse', async () => {
        tx.$queryRaw.mockResolvedValueOnce([])
        await expect(assignWarehouseToManager(999, { warehouseId: 1 })).rejects.toMatchObject({
            code: ErrorCodes.USER_NOT_FOUND,
        })

        tx.$queryRaw.mockResolvedValue([{ id: 3 }])
        tx.user.findUniqueOrThrow.mockResolvedValueOnce({
            id: 3,
            username: 'admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        await expect(assignWarehouseToManager(3, { warehouseId: 1 })).rejects.toMatchObject({
            code: ErrorCodes.INVALID_USER_ROLE,
        })

        tx.user.findUniqueOrThrow.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: false,
        })
        await expect(assignWarehouseToManager(2, { warehouseId: 2 })).rejects.toMatchObject({
            code: ErrorCodes.INVALID_USER_ROLE,
        })

        tx.user.findUniqueOrThrow.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        tx.warehouse.findUnique.mockResolvedValueOnce(null)
        await expect(assignWarehouseToManager(2, { warehouseId: 999 })).rejects.toMatchObject({
            code: ErrorCodes.WAREHOUSE_NOT_FOUND,
        })
    })
})

describe('Admin warehouse manager assignment HTTP routes & RBAC', () => {
    it('rejects unauthenticated requests and non-ADMIN roles', async () => {
        const unauth = await fetch(`${apiUrl}/api/admin/warehouse-managers`)
        expect(unauth.status).toBe(401)

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 1,
            username: 'customer',
            role: 'CUSTOMER',
            assignedWarehouseId: null,
            isActive: true,
        })
        const customerRes = await fetch(`${apiUrl}/api/admin/warehouse-managers`, {
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(customerRes.status).toBe(403)

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })
        const managerRes = await fetch(`${apiUrl}/api/admin/warehouse-managers/2/warehouse`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(2)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ warehouseId: 2 }),
        })
        expect(managerRes.status).toBe(403)
    })

    it('allows ADMIN to list and reassign warehouse managers', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 3,
            username: 'admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        prismaMock.user.findMany.mockResolvedValue([
            {
                id: 2,
                username: 'warehouse',
                fullName: 'Quản lý kho HCM',
                role: 'WAREHOUSE_MANAGER',
                assignedWarehouseId: 1,
                isActive: true,
                assignedWarehouse: { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh' },
            },
        ])
        prismaMock.warehouse.findMany.mockResolvedValue([
            { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh', address: 'TP.HCM' },
            { id: 2, code: 'HN', name: 'Kho Hà Nội', address: 'Hà Nội' },
        ])

        const listRes = await fetch(`${apiUrl}/api/admin/warehouse-managers`, {
            headers: { Authorization: `Bearer ${signToken(3)}` },
        })
        const listBody = await listRes.json()
        expect(listRes.status).toBe(200)
        expect(listBody.success).toBe(true)
        expect(listBody.data.managers).toHaveLength(1)
        expect(listBody.data.warehouses).toHaveLength(2)

        tx.$queryRaw.mockResolvedValue([{ id: 2 }])
        tx.user.findUniqueOrThrow.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            fullName: 'Quản lý kho HCM',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
            assignedWarehouse: { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh' },
        })
        tx.warehouse.findUnique.mockResolvedValue({
            id: 2,
            code: 'HN',
            name: 'Kho Hà Nội',
        })
        tx.user.update.mockResolvedValue({
            id: 2,
            username: 'warehouse',
            fullName: 'Quản lý kho HCM',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 2,
            isActive: true,
            assignedWarehouse: { id: 2, code: 'HN', name: 'Kho Hà Nội' },
        })

        const patchRes = await fetch(`${apiUrl}/api/admin/warehouse-managers/2/warehouse`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(3)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ warehouseId: 2 }),
        })
        const patchBody = await patchRes.json()
        expect(patchRes.status).toBe(200)
        expect(patchBody.success).toBe(true)
        expect(patchBody.data.changed).toBe(true)
        expect(patchBody.data.manager.assignedWarehouseId).toBe(2)
    })
})
