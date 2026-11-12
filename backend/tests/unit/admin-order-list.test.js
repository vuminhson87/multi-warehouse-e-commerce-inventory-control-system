import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { prisma } = vi.hoisted(() => ({
    prisma: {
        $transaction: vi.fn(),
        order: {
            findMany: vi.fn(),
            count: vi.fn(),
        },
    },
}))

vi.mock('../../src/db/prisma.js', () => ({ default: prisma }))

import { listAdminOrders } from '../../src/modules/order/order.query.service.js'
import { AppError, ErrorCodes } from '../../src/shared/errors.js'

const makeOrder = (status = 'Paid') => ({
    id: 17,
    status,
    totalAmount: 790000,
    fulfillmentWarehouseId: 1,
    fulfillmentWarehouse: { id: 1, name: 'Kho TP. Hồ Chí Minh' },
    customer: { username: 'customer' },
    items: [{ quantity: 2, productId: 3, productNameSnapshot: 'Bàn phím', unitPriceSnapshot: 395000, lineTotal: 790000 }],
    reservations: [],
    payments: [],
    createdAt: new Date('2026-11-12T10:00:00.000Z'),
    updatedAt: new Date('2026-11-12T10:01:00.000Z'),
    paidAt: new Date('2026-11-12T10:01:00.000Z'),
    cancelledAt: null,
})

beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation(operations => Promise.all(operations))
    prisma.order.findMany.mockResolvedValue([makeOrder()])
    prisma.order.count.mockResolvedValue(1)
})

afterEach(() => vi.clearAllMocks())

describe('listAdminOrders', () => {
    it('defaults to Paid orders and formats the row for the Admin page', async () => {
        const result = await listAdminOrders()

        expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'Paid' },
            skip: 0,
            take: 10,
        }))
        expect(result).toMatchObject({
            orders: [{
                orderId: 17,
                status: 'Paid',
                fulfillmentWarehouseName: 'Kho TP. Hồ Chí Minh',
                customerUsername: 'customer',
                itemCount: 2,
            }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        })
    })

    it('filters Processing and applies requested page and page size', async () => {
        prisma.order.findMany.mockResolvedValue([makeOrder('Processing')])
        const result = await listAdminOrders({ status: 'Processing', page: '2', limit: '5' })

        expect(prisma.order.findMany).toHaveBeenCalledWith(expect.objectContaining({
            where: { status: 'Processing' },
            skip: 5,
            take: 5,
        }))
        expect(result.pagination).toEqual({ page: 2, limit: 5, total: 1, totalPages: 1 })
    })

    it('rejects other valid order statuses from the Admin processing list', async () => {
        await expect(listAdminOrders({ status: 'PendingPayment' })).rejects.toMatchObject({
            code: ErrorCodes.VALIDATION_ERROR,
        })
        expect(prisma.order.findMany).not.toHaveBeenCalled()
    })

    it('keeps shared query validation for malformed pagination', async () => {
        await expect(listAdminOrders({ page: '0' })).rejects.toBeInstanceOf(AppError)
        expect(prisma.order.findMany).not.toHaveBeenCalled()
    })
})
