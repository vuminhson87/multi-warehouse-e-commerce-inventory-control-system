import prisma from '../../db/prisma.js'
import businessConfig from '../../config/business.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { parsePositiveIntId, validateListQuery } from './order.validator.js'
import { OrderStatus, PaymentAttemptStatus } from './order.constants.js'

const orderInclude = {
  fulfillmentWarehouse: { select: { id: true, name: true } },
  customer: { select: { username: true } },
  items: { orderBy: { productId: 'asc' } },
  reservations: { orderBy: { createdAt: 'desc' } },
  payments: { orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] },
}

function formatOrder(order, { detail = false } = {}) {
  const now = Date.now()
  const activeReservations = order.reservations.filter(
    r => r.status === 'ACTIVE' && new Date(r.expiresAt).getTime() > now
  )
  const pendingPayment = order.payments.some(
    p => p.status === PaymentAttemptStatus.PENDING
  )
  const isPending = order.status === OrderStatus.PENDING_PAYMENT
  const cancellable = [OrderStatus.PENDING_PAYMENT, OrderStatus.PAID]
    .includes(order.status) && !pendingPayment

  const paymentHistory = order.payments.map(p => ({
    id: p.id,
    status: p.status,
    amount: p.amount.toFixed(2),
    gatewayRef: p.gatewayRef,
    failureReason: p.failureReason,
    createdAt: p.createdAt.toISOString(),
    completedAt: p.completedAt?.toISOString() ?? null,
  }))

  const result = {
    orderId: order.id,
    status: order.status,
    totalAmount: order.totalAmount.toFixed(2),
    currency: 'VND',
    warehouseId: order.fulfillmentWarehouseId,
    fulfillmentWarehouseName: order.fulfillmentWarehouse.name,
    customerUsername: order.customer.username,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
    items: order.items.map(i => ({
      productId: i.productId,
      productName: i.productNameSnapshot,
      unitPrice: i.unitPriceSnapshot.toFixed(2),
      quantity: i.quantity,
      lineTotal: i.lineTotal.toFixed(2),
    })),
    hasActiveReservation: activeReservations.length > 0,
    reservationExpiresAt: activeReservations.length
      ? new Date(Math.min(...activeReservations.map(r => r.expiresAt.getTime()))).toISOString()
      : null,
    paymentInProgress: pendingPayment,
    canPay: isPending && !pendingPayment,
    canCancel: cancellable,
    paymentCount: order.payments.length,
    payments: detail
      ? paymentHistory.slice(0, businessConfig.maxPaymentsInOrderDetail)
      : paymentHistory,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
    paidAt: order.paidAt?.toISOString() ?? null,
    cancelledAt: order.cancelledAt?.toISOString() ?? null,
  }
  return result
}

export async function listCustomerOrders(customerId, query) {
  const { page, limit, status } = validateListQuery(query)
  const where = { customerId, ...(status ? { status } : {}) }
  const [orders, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: (page - 1) * limit,
      take: limit,
      include: orderInclude,
    }),
    prisma.order.count({ where }),
  ])
  return {
    orders: orders.map(order => formatOrder(order)),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  }
}

export async function getCustomerOrderDetail(customerId, rawOrderId) {
  const orderId = parsePositiveIntId(rawOrderId, 'orderId')
  const order = await prisma.order.findFirst({
    where: { id: orderId, customerId },
    include: orderInclude,
  })
  if (!order) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy đơn hàng.')
  }
  return formatOrder(order, { detail: true })
}
