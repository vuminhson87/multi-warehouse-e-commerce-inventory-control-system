import { apiRequest } from './apiClient.js'

const id = (orderId) => encodeURIComponent(String(orderId))

export function createOrderApi(token, items, idempotencyKey) {
  return apiRequest('/api/orders', {
    method: 'POST', token,
    body: {
      idempotencyKey,
      items: items.map(i => ({
        productId: Number(i.productId ?? i.id),
        quantity: Number(i.quantity),
      })),
    },
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
