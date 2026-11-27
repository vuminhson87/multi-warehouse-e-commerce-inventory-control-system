import { apiRequest } from './apiClient.js'

const id = (orderId) => encodeURIComponent(String(orderId))

export function createOrderApi(
  token,
  items,
  idempotencyKey,
  voucherCode = null,
  shippingAddress = null
) {
  const body = {
    idempotencyKey,
    items: items.map(i => ({
      productId: Number(i.productId ?? i.id),
      quantity: Number(i.quantity),
    })),
  }
  if (voucherCode) {
    body.voucherCode = voucherCode
  }
  if (shippingAddress) {
    body.shippingAddress = shippingAddress
  }
  return apiRequest('/api/orders', {
    method: 'POST',
    token,
    body,
  })
}

export function payOrderApi(token, orderId, simulate, idempotencyKey) {
  return apiRequest(`/api/orders/${id(orderId)}/payments`, {
    method: 'POST', token,
    body: { idempotencyKey, simulate },
  })
}

export function getOrdersApi(token, { page = 1, limit = 20, status } = {}) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit) })
  if (status && status !== 'ALL') q.set('status', status)
  return apiRequest(`/api/orders?${q}`, { token })
}

export function getOrderDetailApi(token, orderId) {
  return apiRequest(`/api/orders/${id(orderId)}`, { token })
}

export function cancelOrderApi(token, orderId, idempotencyKey) {
  return apiRequest(`/api/orders/${id(orderId)}/cancel`, {
    method: 'POST', token, body: { idempotencyKey },
  })
}

export function confirmOrderReceivedApi(token, orderId) {
  return apiRequest(`/api/orders/${id(orderId)}/confirm-received`, {
    method: 'POST',
    token,
  })
}

export function getAdminOrdersApi(token, { page = 1, limit = 20, status = 'Paid', signal } = {}) {
  const q = new URLSearchParams({ page: String(page), limit: String(limit), status })
  return apiRequest(`/api/admin/orders?${q}`, { token, signal })
}

export function transitionAdminOrderToProcessingApi(token, orderId) {
  return apiRequest(`/api/admin/orders/${id(orderId)}/status`, {
    method: 'PATCH',
    token,
    body: { status: 'Processing' },
  })
}

export function addAdminOrderTrackingApi(token, orderId, { stage, note, location, trackingCode }) {
  const payload = { stage }
  if (note !== undefined && String(note).trim()) payload.note = String(note).trim()
  if (location !== undefined && String(location).trim()) payload.location = String(location).trim()
  if (trackingCode !== undefined && String(trackingCode).trim()) {
    payload.trackingCode = String(trackingCode).trim()
  }
  return apiRequest(`/api/admin/orders/${id(orderId)}/tracking`, {
    method: 'POST',
    token,
    body: payload,
  })
}
