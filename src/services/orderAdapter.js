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
