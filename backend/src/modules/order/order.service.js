
import { Prisma } from '@prisma/client'


import { runInTransaction } from '../../db/transaction.js'
import { invalidateInventoryCache } from '../../db/redis.js'
import businessConfig from '../../config/business.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'

import {
  claimIdempotencyKey,
  completeIdempotencyKey,
} from '../../shared/idempotency.repository.js'

import { reserveForNewOrder } from '../inventory/inventory.repository.js'
import { validateCheckoutBody } from './order.validator.js'

function formatOrder(order) {
  const activeReservation = order.reservations?.find(
    (reservation) =>
      reservation.status === 'ACTIVE' &&
      reservation.expiresAt > new Date()
  )

  return {
    orderId: order.id,
    status: order.status,
    voucherCode: order.voucherCode ?? null,
    discountAmount: order.discountAmount ? order.discountAmount.toFixed(2) : '0.00',
    totalAmount: order.totalAmount.toFixed(2),
    shippingAddress:
      order.shippingFullName || order.shippingAddressLine
        ? {
            fullName: order.shippingFullName ?? null,
            phone: order.shippingPhone ?? null,
            province: order.shippingProvince ?? null,
            addressLine: order.shippingAddressLine ?? null,
            note: order.shippingNote ?? null,
          }
        : null,
    currency: 'VND',
    hasActiveReservation: Boolean(activeReservation),
    reservationExpiresAt:
      order.reservations?.[0]?.expiresAt?.toISOString() ?? null,
    paymentInProgress: order.payments?.some(
      (payment) => payment.status === 'PENDING'
    ) ?? false,
    canPay:
      order.status === 'PendingPayment' &&
      !order.payments?.some(
        (payment) => payment.status === 'PENDING'
      ),
    canCancel: ['PendingPayment', 'Paid'].includes(order.status),
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productNameSnapshot,
      unitPrice: item.unitPriceSnapshot.toFixed(2),
      quantity: item.quantity,
      lineTotal: item.lineTotal.toFixed(2),
    })),
    payments: [],
    paymentCount: order.payments?.length ?? 0,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
  }
}

async function getOrderDetail(client, orderId, customerId) {
  const order = await client.order.findFirst({
    where: {
      id: orderId,
      customerId,
    },
    include: {
      items: {
        orderBy: { productId: 'asc' },
      },
      reservations: {
        orderBy: { createdAt: 'desc' },
      },
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!order) {
    throw new AppError(
      ErrorCodes.ORDER_NOT_FOUND,
      'Không tìm thấy đơn hàng.'
    )
  }

  return formatOrder(order)
}

export async function createCheckoutOrder(customerId, body) {
  const input = validateCheckoutBody(body)

  const result = await runInTransaction(async (tx) => {
    const claimed = await claimIdempotencyKey(tx, {
      userId: customerId,
      operation: 'CREATE_ORDER',
      key: input.idempotencyKey,
      payload: {
        items: input.items,
        ...(input.voucherCode ? { voucherCode: input.voucherCode } : {}),
        ...(input.shippingAddress ? { shippingAddress: input.shippingAddress } : {}),
      },
    })

    // Request đã xử lý: trả về đơn cũ, không giữ hàng lần nữa.
    if (claimed.status === 'COMPLETED') {
      if (!claimed.record.orderId) {
        throw new Error('Idempotency record thiếu orderId.')
      }

      const data = await getOrderDetail(
        tx,
        claimed.record.orderId,
        customerId
      )

      return {
        statusCode: 200,
        data: {
          ...data,
          replayed: true,
        },
      }
    }

    if (claimed.status === 'IN_PROGRESS') {
      throw new AppError(
        ErrorCodes.TEMPORARY_CONFLICT,
        'Yêu cầu đang được xử lý, vui lòng thử lại cùng key.'
      )
    }

    const productIds = input.items.map(
      (item) => item.productId
    )

    const products = await tx.product.findMany({
      where: {
        id: { in: productIds },
        isActive: true,
      },
    })

    if (products.length !== input.items.length) {
      throw new AppError(
        ErrorCodes.PRODUCT_UNAVAILABLE,
        'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'
      )
    }

    const productMap = new Map(
      products.map((product) => [product.id, product])
    )

    let subtotalAmount = new Prisma.Decimal(0)

    const snapshotItems = input.items.map((item) => {
      const product = productMap.get(item.productId)

      const lineTotal = product.price.mul(item.quantity)

      subtotalAmount = subtotalAmount.add(lineTotal)

      return {
        productId: product.id,
        productNameSnapshot: product.name,
        unitPriceSnapshot: product.price,
        quantity: item.quantity,
        lineTotal,
      }
    })

    let discountAmount = new Prisma.Decimal(0)
    let appliedVoucher = null

    if (input.voucherCode) {
      const lockedVouchers = await tx.$queryRaw`
        SELECT
          id,
          code,
          user_id AS "userId",
          discount_percent AS "discountPercent",
          expires_at AS "expiresAt",
          used_at AS "usedAt"
        FROM vouchers
        WHERE code = ${input.voucherCode}
        FOR UPDATE
      `
      const voucher = lockedVouchers?.[0]
      if (!voucher || voucher.userId !== customerId) {
        throw new AppError(
          ErrorCodes.INVALID_ORDER_STATE,
          'Mã giảm giá không tồn tại hoặc không thuộc tài khoản của bạn.'
        )
      }
      if (voucher.usedAt) {
        throw new AppError(
          ErrorCodes.INVALID_ORDER_STATE,
          'Mã giảm giá này đã được sử dụng.'
        )
      }
      if (new Date(voucher.expiresAt).getTime() <= Date.now()) {
        throw new AppError(
          ErrorCodes.INVALID_ORDER_STATE,
          'Mã giảm giá đã hết hạn sử dụng.'
        )
      }

      appliedVoucher = voucher
      discountAmount = subtotalAmount
        .mul(voucher.discountPercent)
        .div(100)
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)

      if (discountAmount.gt(subtotalAmount)) {
        discountAmount = subtotalAmount
      }
    }

    const totalAmount = subtotalAmount.sub(discountAmount)

    const expiresAt = new Date(
      Date.now() +
        businessConfig.reservationTtlMinutes * 60 * 1000
    )

    // Repository Member 3 xử lý khóa tồn kho,
    // lựa chọn kho và ghi reservation.
    const reservationResult = await reserveForNewOrder(tx, {
      items: input.items,
      expiresAt,
      actorUserId: customerId,

      createOrder: async (client, { warehouseId }) => {
        return client.order.create({
          data: {
            customerId,
            fulfillmentWarehouseId: warehouseId,
            status: 'PendingPayment',
            voucherCode: appliedVoucher ? appliedVoucher.code : null,
            discountAmount,
            totalAmount,
            ...(input.shippingAddress
              ? {
                  shippingFullName: input.shippingAddress.fullName,
                  shippingPhone: input.shippingAddress.phone,
                  shippingProvince: input.shippingAddress.province,
                  shippingAddressLine: input.shippingAddress.addressLine,
                  shippingNote: input.shippingAddress.note,
                }
              : {}),
            items: {
              create: snapshotItems,
            },
          },
        })
      },
    })

    if (appliedVoucher) {
      await tx.voucher.update({
        where: { id: appliedVoucher.id },
        data: {
          usedAt: new Date(),
          usedOrderId: reservationResult.order.id,
        },
      })
    }

    const data = await getOrderDetail(
      tx,
      reservationResult.order.id,
      customerId
    )

    const responseBody = {
      success: true,
      data: {
        ...data,
        replayed: false,
      },
    }

    await completeIdempotencyKey(tx, {
      id: claimed.record.id,
      orderId: reservationResult.order.id,
      responseStatus: 201,
      responseBody,
    })

    return {
      statusCode: 201,
      data: responseBody.data,
      affected: reservationResult.affected,
    }
  })

  if (result.affected?.warehouseIds?.length || result.affected?.productIds?.length) {
    await invalidateInventoryCache(result.affected)
  }

  return {
    statusCode: result.statusCode,
    data: result.data,
  }
}
