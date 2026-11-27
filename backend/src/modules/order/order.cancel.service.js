
import { runInTransaction } from '../../db/transaction.js'
import { invalidateInventoryCache } from '../../db/redis.js'

import { AppError, ErrorCodes } from '../../shared/errors.js'

import {
  claimIdempotencyKey,
  completeIdempotencyKey,
} from '../../shared/idempotency.repository.js'

import {
  releaseReservations,
  restoreConsumedStock,
} from '../inventory/inventory.repository.js'

import {
  OrderStatus,
  PaymentAttemptStatus,
  IdempotencyOperation,
  InventoryAction,
  canCustomerCancel,
} from './order.constants.js'

import {
  parsePositiveIntId,
  validateCancelBody,
} from './order.validator.js'

export async function cancelCustomerOrder(
  customerId,
  rawOrderId,
  body
) {
  const orderId = parsePositiveIntId(rawOrderId, 'orderId')
  const input = validateCancelBody(body)

  const cancelResult = await runInTransaction(async (tx) => {

    // Khóa đơn hàng trước khi thay đổi trạng thái.
    const rows = await tx.$queryRaw`
      SELECT id
      FROM orders
      WHERE id = ${orderId}
        AND customer_id = ${customerId}
      FOR UPDATE
    `

    if (rows.length === 0) {
      throw new AppError(
        ErrorCodes.ORDER_NOT_FOUND,
        'Không tìm thấy đơn hàng.'
      )
    }

    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: {
        items: true,
        payments: true,
      },
    })

    // Chống hủy trùng.
    const claim = await claimIdempotencyKey(tx, {
      userId: customerId,
      operation: IdempotencyOperation.CANCEL_ORDER,
      key: input.idempotencyKey,
      orderId,
      payload: { orderId },
    })

    if (claim.status === 'COMPLETED') {
      return {
        statusCode: claim.responseStatus ?? 200,
        body: claim.responseBody,
      }
    }

    if (claim.status === 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.TEMPORARY_CONFLICT,
        'Yêu cầu hủy đang được xử lý.'
      )
    }

    // Không cho hủy khi có thanh toán đang chờ kết quả.
    const paymentInProgress = order.payments.some(
      payment =>
        payment.status === PaymentAttemptStatus.PENDING
    )

    if (paymentInProgress) {
      throw new AppError(
        ErrorCodes.PAYMENT_IN_PROGRESS,
        'Đơn hàng đang có giao dịch cần hoàn tất hoặc đối soát.'
      )
    }

    if (!canCustomerCancel(order.status)) {
      throw new AppError(
        ErrorCodes.INVALID_ORDER_STATE,
        'Trạng thái đơn hàng không cho phép hủy.'
      )
    }

    let inventoryAction = InventoryAction.NONE
    let affected = null

    if (order.status === OrderStatus.PENDING_PAYMENT) {
      // Hàng chưa bán: giải phóng reservation.
      const released = await releaseReservations(tx, {
        orderId,
        reason: 'RELEASED',
        actorUserId: customerId,
      })

      affected = released?.affected ?? null
      inventoryAction = InventoryAction.RELEASED
    }

    if (order.status === OrderStatus.PAID) {
      // Hàng đã bán: hoàn vào đúng kho đã trừ.
      const restored = await restoreConsumedStock(tx, {
        orderId,
        actorUserId: customerId,
      })

      if (restored.alreadyRestored || 
          restored.count !== order.items.length) {
        throw new Error(
          'Không thể hoàn đầy đủ tồn kho cho đơn đã thanh toán.'
        )
      }

      affected = restored?.affected ?? null
      inventoryAction = InventoryAction.RESTORED
    }

    const updated = await tx.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        version: { increment: 1 },
      },
    })

    if (order.voucherCode && typeof tx.voucher?.findUnique === 'function') {
      const linkedVoucher = await tx.voucher.findUnique({
        where: { usedOrderId: orderId },
      })
      if (linkedVoucher && new Date(linkedVoucher.expiresAt).getTime() > Date.now()) {
        await tx.voucher.update({
          where: { id: linkedVoucher.id },
          data: {
            usedAt: null,
            usedOrderId: null,
          },
        })
      }
    }

    const responseBody = {
      success: true,
      data: {
        orderId: updated.id,
        status: updated.status,
        inventoryAction,
        cancelledAt: updated.cancelledAt.toISOString(),
      },
    }

    await completeIdempotencyKey(tx, {
      id: claim.record.id,
      orderId,
      responseStatus: 200,
      responseBody,
    })

    return {
      statusCode: 200,
      body: responseBody,
      affected,
    }
  })

  if (cancelResult.affected?.warehouseIds?.length || cancelResult.affected?.productIds?.length) {
    await invalidateInventoryCache(cancelResult.affected)
  }

  return {
    statusCode: cancelResult.statusCode,
    body: cancelResult.body,
  }
}
