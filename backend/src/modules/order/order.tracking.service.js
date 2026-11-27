import { runInTransaction } from '../../db/transaction.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { AuditAction, AuditTargetType, writeAdminAuditLog } from '../audit/audit.repository.js'
import {
    canAdvanceDeliveryStage,
    OrderStatus,
} from './order.constants.js'
import { parsePositiveIntId, validateAdminTrackingBody } from './order.validator.js'

/**
 * Thêm mốc tiến độ giao/nhận hàng chi tiết cho đơn đang Processing
 * và ghi nhật ký thao tác quản trị trong cùng transaction.
 */
export async function addAdminOrderTrackingEvent(
    rawOrderId,
    body,
    { warehouseId, actor } = {}
) {
    const orderId = parsePositiveIntId(rawOrderId, 'orderId')
    const input = validateAdminTrackingBody(body)

    return runInTransaction(async (tx) => {
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
                fulfillmentWarehouseId: true,
                trackingEvents: {
                    select: { id: true, stage: true },
                    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                },
            },
        })

        if (
            warehouseId !== undefined &&
            warehouseId !== null &&
            order.fulfillmentWarehouseId !== warehouseId
        ) {
            throw new AppError(
                ErrorCodes.FORBIDDEN,
                'Chỉ được cập nhật tiến độ cho đơn hàng thuộc kho được phân công.'
            )
        }

        if (order.status !== OrderStatus.PROCESSING) {
            throw new AppError(
                ErrorCodes.INVALID_ORDER_STATE,
                'Chỉ có thể cập nhật tiến độ giao hàng khi đơn đang được xử lý.'
            )
        }

        const existingStages = (order.trackingEvents ?? []).map((event) => event.stage)
        if (!canAdvanceDeliveryStage(existingStages, input.stage)) {
            throw new AppError(
                ErrorCodes.INVALID_ORDER_STATE,
                'Không thể cập nhật lùi về mốc vận chuyển trước đó.'
            )
        }

        const created = await tx.orderTrackingEvent.create({
            data: {
                orderId: order.id,
                stage: input.stage,
                note: input.note,
                location: input.location,
                trackingCode: input.trackingCode,
                actorUserId: actor?.id ?? null,
            },
        })

        await writeAdminAuditLog(tx, {
            actor,
            action: AuditAction.ORDER_ADD_TRACKING_EVENT,
            targetType: AuditTargetType.ORDER,
            targetId: order.id,
            warehouseId: order.fulfillmentWarehouseId,
            summary: `Cập nhật tiến độ đơn #${order.id} (${input.stage}): ${input.note}`,
            metadata: {
                stage: input.stage,
                location: input.location,
                trackingCode: input.trackingCode,
            },
        })

        return {
            id: created.id,
            orderId: created.orderId,
            stage: created.stage,
            note: created.note,
            location: created.location ?? null,
            trackingCode: created.trackingCode ?? null,
            actorUsername: actor?.username ?? null,
            createdAt: created.createdAt.toISOString(),
        }
    })
}
