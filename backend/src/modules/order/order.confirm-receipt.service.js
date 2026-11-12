import { runInTransaction } from '../../db/transaction.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { canCustomerConfirmReceipt, OrderStatus } from './order.constants.js'
import { parsePositiveIntId } from './order.validator.js'

export async function confirmCustomerOrderReceived(customerId, rawOrderId) {
    const orderId = parsePositiveIntId(rawOrderId, 'orderId')

    return runInTransaction(async tx => {
        const lockedOrders = await tx.$queryRaw`
            SELECT id
            FROM orders
            WHERE id = ${orderId}
              AND customer_id = ${customerId}
            FOR UPDATE
        `

        if (lockedOrders.length === 0) {
            throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy đơn hàng.')
        }

        const order = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: { id: true, status: true, version: true, updatedAt: true },
        })

        // A retried confirmation must not increment the version a second time.
        if (order.status === OrderStatus.COMPLETED) {
            return {
                orderId: order.id,
                status: order.status,
                version: order.version,
                updatedAt: order.updatedAt.toISOString(),
            }
        }

        if (!canCustomerConfirmReceipt(order.status)) {
            throw new AppError(
                ErrorCodes.INVALID_ORDER_STATE,
                'Chỉ có thể xác nhận đã nhận hàng khi đơn đang được xử lý.'
            )
        }

        const updated = await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.COMPLETED,
                version: { increment: 1 },
            },
            select: { id: true, status: true, version: true, updatedAt: true },
        })

        return {
            orderId: updated.id,
            status: updated.status,
            version: updated.version,
            updatedAt: updated.updatedAt.toISOString(),
        }
    })
}
