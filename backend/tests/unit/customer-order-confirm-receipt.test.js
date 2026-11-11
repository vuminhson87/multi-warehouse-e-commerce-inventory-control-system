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

import { confirmCustomerOrderReceived } from '../../src/modules/order/order.confirm-receipt.service.js'
import { ErrorCodes } from '../../src/shared/errors.js'

const processingOrder = {
    id: 31,
    status: 'Processing',
    version: 5,
    updatedAt: new Date('2026-11-12T10:00:00.000Z'),
}

beforeEach(() => {
    vi.clearAllMocks()
    runInTransaction.mockImplementation(work => work(tx))
})

afterEach(() => vi.clearAllMocks())

describe('customer confirms receipt', () => {
    it('moves an owned Processing order to Completed and increments version', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 31 }])
        tx.order.findUniqueOrThrow.mockResolvedValue(processingOrder)
        tx.order.update.mockResolvedValue({
            id: 31,
            status: 'Completed',
            version: 6,
            updatedAt: new Date('2026-11-12T10:05:00.000Z'),
        })

        await expect(confirmCustomerOrderReceived(7, '31')).resolves.toEqual({
            orderId: 31,
            status: 'Completed',
            version: 6,
            updatedAt: '2026-11-12T10:05:00.000Z',
        })
        expect(tx.$queryRaw.mock.calls[0][1]).toBe(31)
        expect(tx.$queryRaw.mock.calls[0][2]).toBe(7)
        expect(tx.order.update).toHaveBeenCalledWith(expect.objectContaining({
            where: { id: 31 },
            data: { status: 'Completed', version: { increment: 1 } },
        }))
    })

    it('is idempotent when the customer repeats confirmation', async () => {
        tx.$queryRaw.mockResolvedValue([{ id: 31 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({ ...processingOrder, status: 'Completed' })

        await expect(confirmCustomerOrderReceived(7, 31)).resolves.toMatchObject({
            orderId: 31,
            status: 'Completed',
            version: 5,
        })
        expect(tx.order.update).not.toHaveBeenCalled()
    })

    it('returns not found for another customer order', async () => {
        tx.$queryRaw.mockResolvedValue([])

        await expect(confirmCustomerOrderReceived(7, 31)).rejects.toMatchObject({
            code: ErrorCodes.ORDER_NOT_FOUND,
        })
        expect(tx.order.findUniqueOrThrow).not.toHaveBeenCalled()
    })

    it.each(['PendingPayment', 'Paid', 'Cancelled'])('rejects confirmation from %s', async status => {
        tx.$queryRaw.mockResolvedValue([{ id: 31 }])
        tx.order.findUniqueOrThrow.mockResolvedValue({ ...processingOrder, status })

        await expect(confirmCustomerOrderReceived(7, 31)).rejects.toMatchObject({
            code: ErrorCodes.INVALID_ORDER_STATE,
        })
        expect(tx.order.update).not.toHaveBeenCalled()
    })

    it('rejects malformed order IDs', async () => {
        await expect(confirmCustomerOrderReceived(7, '31abc')).rejects.toMatchObject({
            code: ErrorCodes.VALIDATION_ERROR,
        })
        expect(tx.$queryRaw).not.toHaveBeenCalled()
    })
})
