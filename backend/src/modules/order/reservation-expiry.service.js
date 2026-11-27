import prisma from '../../db/prisma.js'
import { runInTransaction } from '../../db/transaction.js'
import { invalidateInventoryCache } from '../../db/redis.js'
import businessConfig from '../../config/business.js'
import {
    findOrdersWithExpiredReservations,
    releaseReservations,
} from '../inventory/inventory.repository.js'
import { OrderStatus, PaymentAttemptStatus } from './order.constants.js'

/**
 * Thu hồi reservation hết hạn cho tối đa `limit` đơn trong 1 lượt quét.
 * Mỗi đơn chạy trong transaction ngắn riêng biệt, khóa `orders` trước bằng
 * FOR UPDATE SKIP LOCKED để cùng thứ tự khóa với payOrder / cancelCustomerOrder
 * và bỏ qua các đơn đang có giao dịch thanh toán PENDING.
 */
export async function releaseExpiredReservationsOnce({
    now = new Date(),
    limit = 50,
    logger = console,
} = {}) {
    const orderIds = await findOrdersWithExpiredReservations(prisma, { now, limit })
    const summary = {
        scanned: orderIds.length,
        releasedOrders: 0,
        releasedItems: 0,
        skipped: 0,
        errors: 0,
    }

    for (const orderId of orderIds) {
        try {
            const outcome = await runInTransaction(async (tx) => {
                const lockedOrders = await tx.$queryRaw`
                    SELECT id
                    FROM orders
                    WHERE id = ${orderId}
                    FOR UPDATE SKIP LOCKED
                `

                if (lockedOrders.length === 0) {
                    return { status: 'SKIPPED_LOCKED' }
                }

                const order = await tx.order.findUnique({
                    where: { id: orderId },
                    select: {
                        id: true,
                        status: true,
                        payments: {
                            where: { status: PaymentAttemptStatus.PENDING },
                            select: { id: true },
                            take: 1,
                        },
                    },
                })

                if (!order || order.status !== OrderStatus.PENDING_PAYMENT) {
                    return { status: 'SKIPPED_STATUS' }
                }

                if (order.payments.length > 0) {
                    return { status: 'SKIPPED_PENDING_PAYMENT' }
                }

                const released = await releaseReservations(tx, {
                    orderId,
                    reason: 'EXPIRED',
                    expiredBefore: now,
                    actorUserId: null,
                })

                return {
                    status: released.count > 0 ? 'RELEASED' : 'NOOP',
                    count: released.count,
                    affected: released.affected ?? null,
                }
            })

            if (outcome.status === 'RELEASED') {
                summary.releasedOrders += 1
                summary.releasedItems += outcome.count
                if (outcome.affected?.warehouseIds?.length || outcome.affected?.productIds?.length) {
                    await invalidateInventoryCache(outcome.affected)
                }
            } else {
                summary.skipped += 1
            }
        } catch (error) {
            summary.errors += 1
            logger?.error?.(`Lỗi thu hồi giữ hàng hết hạn cho đơn #${orderId}:`, error)
        }
    }

    return summary
}

/**
 * Khởi chạy job định kỳ thu hồi hàng giữ chỗ hết hạn bằng setTimeout nối tiếp
 * (chỉ đặt lịch lượt tiếp theo sau khi lượt hiện tại kết thúc để tránh chồng lượt).
 */
export function startReservationExpiryJob({
    intervalMs = businessConfig.expiryJobIntervalSeconds * 1000,
    runOnce = releaseExpiredReservationsOnce,
    logger = console,
} = {}) {
    let stopped = false
    let timer = null
    let inFlight = null

    const scheduleNext = () => {
        if (stopped) return
        timer = setTimeout(tick, intervalMs)
        timer.unref?.()
    }

    const tick = async () => {
        if (stopped) return
        timer = null
        inFlight = Promise.resolve()
            .then(() => runOnce({ now: new Date(), logger }))
            .catch((error) => {
                logger?.error?.('Lỗi job thu hồi giữ hàng hết hạn:', error)
            })
            .finally(() => {
                inFlight = null
                scheduleNext()
            })
        await inFlight
    }

    scheduleNext()

    return {
        async stop() {
            stopped = true
            if (timer !== null) {
                clearTimeout(timer)
                timer = null
            }
            if (inFlight) {
                await inFlight
            }
        },
    }
}
