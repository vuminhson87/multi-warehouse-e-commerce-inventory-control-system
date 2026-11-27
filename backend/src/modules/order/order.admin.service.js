import { runInTransaction } from '../../db/transaction.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { AuditAction, AuditTargetType, writeAdminAuditLog } from '../audit/audit.repository.js'
import {
    canAdminTransition,
    DELIVERY_STAGE_DEFAULT_NOTES,
    DeliveryStage,
    OrderStatus,
} from './order.constants.js'
import { parsePositiveIntId } from './order.validator.js'

export async function transitionAdminOrderToProcessing(rawOrderId, { warehouseId, actor } = {}) {
    const orderId = parsePositiveIntId(rawOrderId, 'orderId')

    return runInTransaction(async tx => {
        const lockedOrders = await tx.$queryRaw`
            SELECT id
            FROM orders
            WHERE id = ${orderId}
            FOR UPDATE
        `

        if (lockedOrders.length === 0) {
            throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy đơn hàng.')
        }

        const order = await tx.order.findUniqueOrThrow({
            where: { id: orderId },
            select: {
                id: true,
                status: true,
                version: true,
                updatedAt: true,
                fulfillmentWarehouseId: true,
            },
        })

        if (
            warehouseId !== undefined &&
            warehouseId !== null &&
            order.fulfillmentWarehouseId !== warehouseId
        ) {
            throw new AppError(
                ErrorCodes.FORBIDDEN,
                'Chỉ được xử lý đơn hàng thuộc kho được phân công.'
            )
        }

        // Repeating a successful request returns current state without another version update.
        if (order.status === OrderStatus.PROCESSING) {
            return {
                orderId: order.id,
                status: order.status,
                version: order.version,
                updatedAt: order.updatedAt.toISOString(),
            }
        }

        if (!canAdminTransition(order.status, OrderStatus.PROCESSING)) {
            throw new AppError(
                ErrorCodes.INVALID_ORDER_STATE,
                'Chỉ đơn đã thanh toán mới được chuyển sang đang xử lý.'
            )
        }

        const updated = await tx.order.update({
            where: { id: orderId },
            data: {
                status: OrderStatus.PROCESSING,
                version: { increment: 1 },
            },
            select: { id: true, status: true, version: true, updatedAt: true },
        })

        if (tx.orderTrackingEvent?.create) {
            await tx.orderTrackingEvent.create({
                data: {
                    orderId: updated.id,
                    stage: DeliveryStage.PROCESSING_STARTED,
                    note: DELIVERY_STAGE_DEFAULT_NOTES[DeliveryStage.PROCESSING_STARTED],
                    actorUserId: actor?.id ?? null,
                },
            })
        }

        await writeAdminAuditLog(tx, {
            actor,
            action: AuditAction.ORDER_START_PROCESSING,
            targetType: AuditTargetType.ORDER,
            targetId: updated.id,
            warehouseId: order.fulfillmentWarehouseId,
            summary: `Bắt đầu xử lý đơn hàng #${updated.id}`,
            metadata: {
                fromStatus: OrderStatus.PAID,
                toStatus: OrderStatus.PROCESSING,
                version: updated.version,
            },
        })

        return {
            orderId: updated.id,
            status: updated.status,
            version: updated.version,
            updatedAt: updated.updatedAt.toISOString(),
        }
    })
}
