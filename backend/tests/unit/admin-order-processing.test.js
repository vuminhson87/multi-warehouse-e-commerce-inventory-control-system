import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { tx, runInTransaction } = vi.hoisted(() => ({
    tx: {
        $queryRaw: vi.fn(),
        order: {
            findUniqueOrThrow: vi.fn(),
            update: vi.fn(),
        },
    },
    runInTransaction: vi.fn(),
}))

vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))

import { transitionAdminOrderToProcessing } from '../../src/modules/order/order.admin.service.js'
import { validateAdminOrderStatusBody } from '../../src/modules/order/order.validator.js'
import { AppError, ErrorCodes } from '../../src/shared/errors.js'

const paidOrder = {
    id: 42,
    status: 'Paid',
    version: 3,
    updatedAt: new Date('2026-11-12T10:00:00.000Z'),
}

afterEach(() => {
    vi.clearAllMocks()
})

beforeEach(() => {
    runInTransaction.mockImplementation(work => work(tx))
})

describe('Admin Paid → Processing', () => {
    it('accepts only the Processing target status', () => {
        expect(validateAdminOrderStatusBody({ status: 'Processing' })).toEqual({ status: 'Processing' })
        for (const body of [{ status: 'Paid' }, { status: 'Completed' }, { status: 'Cancelled' }, {}]) {
            expect(() => validateAdminOrderStatusBody(body)).toThrow(AppError)
        }
    })

    it('transitions a paid order once and increments its version', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 42 }])
        tx.order.findUniqueOrThrow.mockResolvedValue(paidOrder)
        tx.order.update.mockResolvedValue({
            id: 42,
            status: 'Processing',
            version: 4,
            updatedAt: new Date('2026-11-12T10:01:00.000Z'),
        })

        await expect(transitionAdminOrderToProcessing('42')).resolves.toEqual({
            orderId: 42,
            status: 'Processing',
            version: 4,
            updatedAt: '2026-11-12T10:01:00.000Z',
        })
        expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 42 },
            data: { status: 'Processing', version: { increment: 1 } },
        }))
    })

    it('returns an existing Processing order idempotently without updating again', async () => {
        const processingOrder = { ...paidOrder, status: 'Processing' }
        tx.$queryRaw.mockResolvedValue([{ id: 42 }])
        tx.order.findUniqueOrThrow.mockResolvedValue(processingOrder)

        await expect(transitionAdminOrderToProcessing(42)).resolves.toMatchObject({
            orderId: 42,
            status: 'Processing',
            version: 3,
        })
        expect(tx.order.update).not.toHaveBeenCalled()
    })

    it('rejects a non-paid order and a missing order', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 42 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({ ...paidOrder, status: 'PendingPayment' })
        await expect(transitionAdminOrderToProcessing(42)).rejects.toMatchObject({
            code: ErrorCodes.INVALID_ORDER_STATE,
        })

        tx.$queryRaw.mockResolvedValueOnce([])
        await expect(transitionAdminOrderToProcessing(404)).rejects.toMatchObject({
            code: ErrorCodes.ORDER_NOT_FOUND,
        })
    })
})
