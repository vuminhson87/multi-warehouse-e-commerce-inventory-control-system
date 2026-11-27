const mapResult = (status) => {
  if (status === 'SUCCEEDED') return 'SUCCESS'
  if (status === 'FAILED') return 'FAILED'
  if (status === 'INCOMPLETE') return 'INCOMPLETE'
  return 'PENDING'
}

export function adaptOrder(dto) {
  if (!dto) return null
  const payments = Array.isArray(dto.payments) ? dto.payments : []

  return {
    ...dto,
    id: Number(dto.orderId),
    fulfillmentWarehouseId: Number(dto.warehouseId),
    fulfillmentWarehouseName:
      dto.fulfillmentWarehouseName ?? `Kho #${dto.warehouseId ?? '?'}`,
    customerUsername: dto.customerUsername ?? '',
    reservationActive: Boolean(dto.hasActiveReservation),
    voucherCode: dto.voucherCode ?? null,
    discountAmount: Number(dto.discountAmount ?? 0),
    shippingAddress: dto.shippingAddress ?? null,
    paymentQr: dto.paymentQr ?? null,
    totalAmount: Number(dto.totalAmount),
    canPay: Boolean(dto.canPay),
    canCancel: Boolean(dto.canCancel),
    paymentInProgress: Boolean(dto.paymentInProgress),
    items: (dto.items ?? []).map(i => ({
      ...i,
      productNameSnapshot: i.productName ?? i.productNameSnapshot ?? '',
      unitPriceSnapshot: Number(i.unitPrice ?? i.unitPriceSnapshot ?? 0),
      lineTotal: Number(i.lineTotal),
      quantity: Number(i.quantity),
    })),
    trackingEvents: (dto.trackingEvents ?? []).map(event => ({
      id: event.id,
      stage: event.stage,
      note: event.note || '',
      location: event.location ?? null,
      trackingCode: event.trackingCode ?? null,
      actorUsername: event.actorUsername ?? null,
      createdAt: event.createdAt,
    })),
    paymentAttempts: payments.map((p, index) => ({
      ...p,
      attemptNumber: payments.length - index, // API sắp xếp mới nhất trước
      result: mapResult(p.status),
      createdAt: p.createdAt,
      note: p.failureReason ||
        (p.status === 'SUCCEEDED' ? 'Thanh toán thành công' :
          p.status === 'PENDING' ? 'Đang chờ kết quả/đối soát' :
          p.status === 'INCOMPLETE' ? 'Chưa hoàn tất' : 'Thanh toán thất bại'),
    })),
  }
}
