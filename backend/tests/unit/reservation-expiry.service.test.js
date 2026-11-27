import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const {
    prismaMock,
    tx,
    runInTransaction,
    findOrdersWithExpiredReservations,
    releaseReservations,
} = vi.hoisted(() => ({
    prismaMock: {},
    tx: {
        $queryRaw: vi.fn(),
        order: {
            findUnique: vi.fn(),
        },
    },
    runInTransaction: vi.fn(),
    findOrdersWithExpiredReservations: vi.fn(),
    releaseReservations: vi.fn(),
}))

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))
vi.mock('../../src/modules/inventory/inventory.repository.js', () => ({
    findOrdersWithExpiredReservations,
    releaseReservations,
}))

import {
    releaseExpiredReservationsOnce,
    startReservationExpiryJob,
} from '../../src/modules/order/reservation-expiry.service.js'

beforeEach(() => {
    vi.clearAllMocks()
    runInTransaction.mockImplementation((work) => work(tx))
})

afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
})

describe('Reservation TTL expiry job service', () => {
    it('releases expired PendingPayment orders and leaves order status untouched', async () => {
        const now = new Date('2026-11-26T10:00:00.000Z')
        findOrdersWithExpiredReservations.mockResolvedValue([101, 102])
        tx.$queryRaw.mockResolvedValue([{ id: 101 }])
        tx.order.findUnique
            .mockResolvedValueOnce({ id: 101, status: 'PendingPayment', payments: [] })
            .mockResolvedValueOnce({ id: 102, status: 'PendingPayment', payments: [] })
        releaseReservations
            .mockResolvedValueOnce({ count: 2 })
            .mockResolvedValueOnce({ count: 1 })

        const summary = await releaseExpiredReservationsOnce({ now, limit: 20 })

        expect(findOrdersWithExpiredReservations).toHaveBeenCalledWith(prismaMock, { now, limit: 20 })
        expect(releaseReservations).toHaveBeenNthCalledWith(1, tx, {
            orderId: 101,
            reason: 'EXPIRED',
            expiredBefore: now,
            actorUserId: null,
        })
        expect(releaseReservations).toHaveBeenNthCalledWith(2, tx, {
            orderId: 102,
            reason: 'EXPIRED',
            expiredBefore: now,
            actorUserId: null,
        })
        expect(summary).toEqual({
            scanned: 2,
            releasedOrders: 2,
            releasedItems: 3,
            skipped: 0,
            errors: 0,
        })
    })

    it('skips locked orders, non-PendingPayment orders, and orders with pending payment attempts', async () => {
        const now = new Date('2026-11-26T10:00:00.000Z')
        findOrdersWithExpiredReservations.mockResolvedValue([201, 202, 203])
        tx.$queryRaw
            .mockResolvedValueOnce([]) // đang bị khóa bởi transaction khác
            .mockResolvedValueOnce([{ id: 202 }])
            .mockResolvedValueOnce([{ id: 203 }])
        tx.order.findUnique
            .mockResolvedValueOnce({ id: 202, status: 'Paid', payments: [] })
            .mockResolvedValueOnce({ id: 203, status: 'PendingPayment', payments: [{ id: 99 }] })

        const summary = await releaseExpiredReservationsOnce({ now })

        expect(releaseReservations).not.toHaveBeenCalled()
        expect(summary).toEqual({
            scanned: 3,
            releasedOrders: 0,
            releasedItems: 0,
            skipped: 3,
            errors: 0,
        })
    })

    it('isolates per-order errors so remaining orders continue to be processed', async () => {
        const now = new Date('2026-11-26T10:00:00.000Z')
        const logger = { error: vi.fn() }
        findOrdersWithExpiredReservations.mockResolvedValue([301, 302])
        runInTransaction
            .mockRejectedValueOnce(new Error('DB transient error'))
            .mockImplementationOnce((work) => work(tx))
        tx.$queryRaw.mockResolvedValue([{ id: 302 }])
        tx.order.findUnique.mockResolvedValue({ id: 302, status: 'PendingPayment', payments: [] })
        releaseReservations.mockResolvedValue({ count: 1 })

        const summary = await releaseExpiredReservationsOnce({ now, logger })

        expect(logger.error).toHaveBeenCalledTimes(1)
        expect(summary).toEqual({
            scanned: 2,
            releasedOrders: 1,
            releasedItems: 1,
            skipped: 0,
            errors: 1,
        })
    })

    it('schedules non-overlapping runs and stops cleanly', async () => {
        vi.useFakeTimers()
        let resolveFirstRun
        const runOnce = vi
            .fn()
            .mockImplementationOnce(
                () => new Promise((resolve) => {
                    resolveFirstRun = resolve
                })
            )
            .mockResolvedValue({ scanned: 0, releasedOrders: 0, releasedItems: 0, skipped: 0, errors: 0 })

        const job = startReservationExpiryJob({ intervalMs: 1000, runOnce })

        await vi.advanceTimersByTimeAsync(1000)
        expect(runOnce).toHaveBeenCalledTimes(1)

        // Khi lượt 1 chưa xong, tiến thêm 3 giây cũng không chạy chồng lượt 2.
        await vi.advanceTimersByTimeAsync(3000)
        expect(runOnce).toHaveBeenCalledTimes(1)

        resolveFirstRun()
        await Promise.resolve()
        await Promise.resolve()

        await vi.advanceTimersByTimeAsync(1000)
        expect(runOnce).toHaveBeenCalledTimes(2)

        await job.stop()
        await vi.advanceTimersByTimeAsync(5000)
        expect(runOnce).toHaveBeenCalledTimes(2)
    })
})
