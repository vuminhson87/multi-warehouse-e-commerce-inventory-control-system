
import { Prisma } from '@prisma/client'

import { runInTransaction } from '../../db/transaction.js'
import businessConfig from '../../config/business.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import {
  claimIdempotencyKey,
  completeIdempotencyKey,
} from '../../shared/idempotency.repository.js'
import {
  reserveForExistingOrder,
  consumeReservations,
  releaseReservations,
} from '../inventory/inventory.repository.js'
import {
  OrderStatus,
  PaymentAttemptStatus,
  IdempotencyOperation,
} from '../order/order.constants.js'
import {
  parsePositiveIntId,
  validatePaymentBody,
} from '../order/order.validator.js'
import { executeMockPayment } from './mockGateway.js'

function paymentResponse(orderId, attempt, orderStatus) {
  return {
    orderId,
    orderStatus,
    paymentAttemptId: attempt.id,
    paymentStatus: attempt.status,
    gatewayRef: attempt.gatewayRef,
    failureReason: attempt.failureReason,
    completedAt: attempt.completedAt?.toISOString() ?? null,
  }
}

async function lockOrder(tx, orderId, customerId) {
  const rows = await tx.$queryRaw`
    SELECT id FROM orders
    WHERE id = ${orderId}
      AND customer_id = ${customerId}
    FOR UPDATE
  `

  if (!rows.length) {
    throw new AppError(
      ErrorCodes.ORDER_NOT_FOUND,
      'Không tìm thấy đơn hàng.'
    )
  }

  return tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: {
      items: true,
      reservations: true,
      payments: true,
    },
  })
}

export async function payOrder(customerId, rawOrderId, body) {
  const orderId = parsePositiveIntId(rawOrderId, 'orderId')
  const input = validatePaymentBody(body)

  // TRANSACTION 1: chuẩn bị payment.
  const preparation = await runInTransaction(async (tx) => {
    const order = await lockOrder(tx, orderId, customerId)

    const claim = await claimIdempotencyKey(tx, {
      userId: customerId,
      operation: IdempotencyOperation.PAY_ORDER,
      key: input.idempotencyKey,
      orderId,
      payload: { orderId, simulate: input.simulate },
    })

    if (claim.status === 'COMPLETED') {
      return {
        kind: 'REPLAY',
        statusCode: claim.responseStatus ?? 200,
        body: claim.responseBody,
      }
    }

    if (claim.status === 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.PAYMENT_IN_PROGRESS,
        'Yêu cầu thanh toán đang xử lý hoặc cần đối soát.'
      )
    }

    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new AppError(
        ErrorCodes.INVALID_ORDER_STATE,
        'Đơn hàng không ở trạng thái chờ thanh toán.'
      )
    }

    if (order.payments.some(
      p => p.status === PaymentAttemptStatus.PENDING
    )) {
      throw new AppError(
        ErrorCodes.PAYMENT_IN_PROGRESS,
        'Đơn hàng đang có giao dịch thanh toán chưa hoàn tất.'
      )
    }

    const active = order.reservations.filter(
      r => r.status === 'ACTIVE'
    )

    // Reservation hết hạn: giải phóng trước khi giữ lại.
    if (active.some(r => r.expiresAt <= new Date())) {
      await releaseReservations(tx, {
        orderId,
        reason: 'EXPIRED',
        expiredBefore: new Date(),
        actorUserId: customerId,
      })
    }

    const remaining = await tx.stockReservation.count({
      where: { orderId, status: 'ACTIVE' },
    })

    if (remaining === 0) {
      await reserveForExistingOrder(tx, {
        orderId,
        warehouseId: order.fulfillmentWarehouseId,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        expiresAt: new Date(
          Date.now() + businessConfig.reservationTtlMinutes * 60000
        ),
        actorUserId: customerId,
      })
    }

    const attempt = await tx.paymentAttempt.create({
      data: {
        orderId,
        status: PaymentAttemptStatus.PENDING,
        amount: order.totalAmount,
      },
    })

    return {
      kind: 'NEW',
      claimId: claim.record.id,
      attemptId: attempt.id,
      amount: order.totalAmount.toFixed(2),
    }
  })

  if (preparation.kind === 'REPLAY') {
    return {
      statusCode: preparation.statusCode,
      body: preparation.body,
    }
  }

  // Gateway chạy NGOÀI transaction.
  // Nếu gặp lỗi không xác định, không được tự gọi lại gateway.
  let gateway

  try {
    gateway = await executeMockPayment({
      orderId,
      paymentAttemptId: preparation.attemptId,
      amount: preparation.amount,
      simulate: input.simulate,
    })
  } catch (error) {
    console.error('Gateway chưa xác định kết quả:', error)

    throw new AppError(
      ErrorCodes.REQUEST_OUTCOME_UNKNOWN,
      'Chưa xác định được kết quả thanh toán. Cần đối soát.'
    )
  }

  // TRANSACTION 2: chốt kết quả vào DB.
  return runInTransaction(async (tx) => {
    const order = await lockOrder(tx, orderId, customerId)

    const attempt = await tx.paymentAttempt.findUniqueOrThrow({
      where: { id: preparation.attemptId },
    })

    if (attempt.status !== PaymentAttemptStatus.PENDING) {
      throw new AppError(
        ErrorCodes.PAYMENT_IN_PROGRESS,
        'Giao dịch đã được xử lý bởi một tiến trình khác.'
      )
    }

    let paymentStatus
    let failureReason = gateway.failureReason

    if (gateway.result === 'SUCCESS') {
      const active = order.reservations.filter(
        r => r.status === 'ACTIVE' &&
          r.expiresAt > new Date()
      )

      const expected = order.items.length

      if (
        order.status !== OrderStatus.PENDING_PAYMENT ||
        active.length !== expected
      ) {
        // Gateway báo thành công nhưng reservation không còn hợp lệ.
        // Không được tự chuyển đơn sang Paid.
        throw new AppError(
          ErrorCodes.REQUEST_OUTCOME_UNKNOWN,
          'Thanh toán cần đối soát do reservation không hợp lệ.'
        )
      }

      const consumed = await consumeReservations(tx, {
        orderId,
        actorUserId: customerId,
      })

      if (consumed.count !== expected) {
        throw new Error('Không tiêu thụ đủ reservation.')
      }

      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.PAID,
          paidAt: new Date(),
          version: { increment: 1 },
        },
      })

      paymentStatus = PaymentAttemptStatus.SUCCEEDED
    } else if (
      gateway.result === 'FAILED' ||
      gateway.result === 'INCOMPLETE'
    ) {
      await releaseReservations(tx, {
        orderId,
        reason: 'RELEASED',
        actorUserId: customerId,
      })

      paymentStatus = gateway.result === 'FAILED'
        ? PaymentAttemptStatus.FAILED
        : PaymentAttemptStatus.INCOMPLETE
    } else {
      throw new Error('Gateway trả kết quả không hợp lệ.')
    }

    const updatedAttempt = await tx.paymentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: paymentStatus,
        gatewayRef: gateway.gatewayRef,
        failureReason,
        completedAt: new Date(),
      },
    })

    const nextStatus = paymentStatus === PaymentAttemptStatus.SUCCEEDED
      ? OrderStatus.PAID
      : OrderStatus.PENDING_PAYMENT

    const responseBody = {
      success: true,
      data: paymentResponse(orderId, updatedAttempt, nextStatus),
    }

    await completeIdempotencyKey(tx, {
      id: preparation.claimId,
      orderId,
      responseStatus: 200,
      responseBody,
    })

    return {
      statusCode: 200,
      body: responseBody,
    }
  })
}
