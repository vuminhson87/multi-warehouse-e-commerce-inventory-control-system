import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, prismaMock, runInTransaction } = vi.hoisted(() => ({
    tx: {
        $queryRaw: vi.fn(),
        order: {
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
        orderTrackingEvent: {
            create: vi.fn(),
        },
        adminAuditLog: {
            create: vi.fn(),
        },
    },
    prismaMock: {
        $transaction: vi.fn(),
        user: {
            findUnique: vi.fn(),
        },
        adminAuditLog: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
    runInTransaction: vi.fn(),
}))

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))

import adminAuditRoutes, { validateAuditLogQuery } from '../../src/modules/audit/audit.routes.js'
import { AuditAction, AuditTargetType } from '../../src/modules/audit/audit.repository.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { transitionAdminOrderToProcessing } from '../../src/modules/order/order.admin.service.js'
import { confirmCustomerOrderReceived } from '../../src/modules/order/order.confirm-receipt.service.js'
import {
    canAdvanceDeliveryStage,
    DeliveryStage,
} from '../../src/modules/order/order.constants.js'
import { addAdminOrderTrackingEvent } from '../../src/modules/order/order.tracking.service.js'
import { validateAdminTrackingBody } from '../../src/modules/order/order.validator.js'
import { AppError, ErrorCodes } from '../../src/shared/errors.js'

const JWT_SECRET = 'test-tracking-and-audit-secret'
const app = express()
app.use(express.json())
app.use('/api/admin/audit-logs', adminAuditRoutes)
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
    runInTransaction.mockImplementation((work) => work(tx))
    prismaMock.$transaction.mockImplementation((ops) => Promise.all(ops))
})

afterEach(() => vi.clearAllMocks())

describe('Order delivery tracking progress', () => {
    it('validates tracking body and prevents backward delivery stage transitions', () => {
        expect(
            validateAdminTrackingBody({
                stage: DeliveryStage.IN_TRANSIT,
                location: '  Kho HCM  ',
                trackingCode: 'GHN-123',
            })
        ).toEqual({
            stage: DeliveryStage.IN_TRANSIT,
            note: 'Đơn hàng đang được vận chuyển.',
            location: 'Kho HCM',
            trackingCode: 'GHN-123',
        })

        expect(() => validateAdminTrackingBody({ stage: DeliveryStage.DELIVERED })).toThrow(AppError)
        expect(() => validateAdminTrackingBody({ stage: DeliveryStage.PACKED, extra: 1 })).toThrow(
            AppError
        )

        expect(
            canAdvanceDeliveryStage(
                [DeliveryStage.PROCESSING_STARTED, DeliveryStage.IN_TRANSIT],
                DeliveryStage.OUT_FOR_DELIVERY
            )
        ).toBe(true)
        expect(
            canAdvanceDeliveryStage(
                [DeliveryStage.PROCESSING_STARTED, DeliveryStage.IN_TRANSIT],
                DeliveryStage.PACKED
            )
        ).toBe(false)
    })

    it('records initial tracking event and audit log when transitioning Paid -> Processing', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 42 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 42,
            status: 'Paid',
            version: 3,
            fulfillmentWarehouseId: 1,
            updatedAt: new Date('2026-11-26T10:00:00.000Z'),
        })
        tx.order.update.mockResolvedValue({
            id: 42,
            status: 'Processing',
            version: 4,
            updatedAt: new Date('2026-11-26T10:01:00.000Z'),
        })

        await transitionAdminOrderToProcessing(42, {
            actor: { id: 9, role: 'ADMIN', username: 'admin' },
        })

        expect(tx.orderTrackingEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                orderId: 42,
                stage: DeliveryStage.PROCESSING_STARTED,
                actorUserId: 9,
            }),
        })
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorUserId: 9,
                actorRole: 'ADMIN',
                action: AuditAction.ORDER_START_PROCESSING,
                targetType: AuditTargetType.ORDER,
                targetId: 42,
                warehouseId: 1,
            }),
        })
    })

    it('adds a tracking event and audit log inside the same transaction with warehouse scope enforcement', async () => {
        const actor = { id: 5, role: 'WAREHOUSE_MANAGER', username: 'warehouse' }
        tx.$queryRaw.mockResolvedValue([{ id: 77 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 77,
            status: 'Processing',
            fulfillmentWarehouseId: 2,
            trackingEvents: [{ id: 1, stage: DeliveryStage.PROCESSING_STARTED }],
        })
        tx.orderTrackingEvent.create.mockResolvedValue({
            id: 10,
            orderId: 77,
            stage: DeliveryStage.PACKED,
            note: 'Đã đóng gói xong tại kho.',
            location: 'Kho Hà Nội',
            trackingCode: 'VTP-001',
            createdAt: new Date('2026-11-26T11:00:00.000Z'),
        })

        await expect(
            addAdminOrderTrackingEvent(
                77,
                { stage: DeliveryStage.PACKED, location: 'Kho Hà Nội', trackingCode: 'VTP-001' },
                { warehouseId: 1, actor }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN })

        const created = await addAdminOrderTrackingEvent(
            77,
            { stage: DeliveryStage.PACKED, location: 'Kho Hà Nội', trackingCode: 'VTP-001' },
            { warehouseId: 2, actor }
        )

        expect(created).toEqual({
            id: 10,
            orderId: 77,
            stage: DeliveryStage.PACKED,
            note: 'Đã đóng gói xong tại kho.',
            location: 'Kho Hà Nội',
            trackingCode: 'VTP-001',
            actorUsername: 'warehouse',
            createdAt: '2026-11-26T11:00:00.000Z',
        })
        expect(tx.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                actorUserId: 5,
                actorRole: 'WAREHOUSE_MANAGER',
                action: AuditAction.ORDER_ADD_TRACKING_EVENT,
                targetType: AuditTargetType.ORDER,
                targetId: 77,
                warehouseId: 2,
            }),
        })
    })

    it('records DELIVERED tracking event when customer confirms order receipt', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 31 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({
            id: 31,
            status: 'Processing',
            version: 5,
            updatedAt: new Date('2026-11-26T10:00:00.000Z'),
        })
        tx.order.update.mockResolvedValue({
            id: 31,
            status: 'Completed',
            version: 6,
            updatedAt: new Date('2026-11-26T10:05:00.000Z'),
        })

        await confirmCustomerOrderReceived(7, 31)

        expect(tx.orderTrackingEvent.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                orderId: 31,
                stage: DeliveryStage.DELIVERED,
                actorUserId: 7,
            }),
        })
    })
})

describe('Admin audit logs API & query validation', () => {
    it('validates audit log query parameters strictly', () => {
        expect(
            validateAuditLogQuery({ page: '2', limit: '15', targetType: 'ORDER', search: ' #42 ' })
        ).toEqual({
            page: 2,
            limit: 15,
            targetType: 'ORDER',
            action: undefined,
            search: '#42',
        })

        expect(() => validateAuditLogQuery({ targetType: 'UNKNOWN' })).toThrow(AppError)
        expect(() => validateAuditLogQuery({ limit: '200' })).toThrow(AppError)
        expect(() => validateAuditLogQuery({ unexpected: 'x' })).toThrow(AppError)
    })

    it('enforces ADMIN-only access and returns formatted audit logs', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            fullName: 'Kho 1',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })

        const forbiddenRes = await fetch(`${apiUrl}/api/admin/audit-logs`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(forbiddenRes.status).toBe(403)

        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 1,
            username: 'admin',
            fullName: 'Admin',
            role: 'ADMIN',
            assignedWarehouseId: null,
            isActive: true,
        })
        prismaMock.adminAuditLog.findMany.mockResolvedValue([
            {
                id: 88,
                action: AuditAction.ORDER_START_PROCESSING,
                targetType: AuditTargetType.ORDER,
                targetId: 42,
                warehouseId: 1,
                warehouse: { id: 1, name: 'Kho TP. Hồ Chí Minh', code: 'HCM' },
                summary: 'Bắt đầu xử lý đơn hàng #42',
                metadata: { toStatus: 'Processing' },
                actorRole: 'ADMIN',
                actor: { id: 1, username: 'admin', fullName: 'Admin', role: 'ADMIN' },
                createdAt: new Date('2026-11-26T10:01:00.000Z'),
            },
        ])
        prismaMock.adminAuditLog.count.mockResolvedValue(1)

        const okRes = await fetch(`${apiUrl}/api/admin/audit-logs?targetType=ORDER`, {
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(okRes.status).toBe(200)
        const payload = await okRes.json()
        expect(payload).toEqual({
            success: true,
            data: {
                logs: [
                    {
                        id: 88,
                        action: AuditAction.ORDER_START_PROCESSING,
                        targetType: AuditTargetType.ORDER,
                        targetId: 42,
                        warehouseId: 1,
                        warehouseName: 'Kho TP. Hồ Chí Minh',
                        summary: 'Bắt đầu xử lý đơn hàng #42',
                        metadata: { toStatus: 'Processing' },
                        actor: { id: 1, username: 'admin', fullName: 'Admin', role: 'ADMIN' },
                        createdAt: '2026-11-26T10:01:00.000Z',
                    },
                ],
                pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
            },
        })
    })
})
