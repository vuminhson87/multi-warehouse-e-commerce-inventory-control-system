import { apiRequest } from './apiClient.js'

export function getWheelStatusApi(token, { signal } = {}) {
  return apiRequest('/api/wheel/status', { token, signal })
}

export function spinWheelApi(token) {
  return apiRequest('/api/wheel/spin', {
    method: 'POST',
    token,
  })
}

export function spinDemoWheelApi() {
  return apiRequest('/api/wheel/demo-spin', {
    method: 'POST',
  })
}

export function getWheelVouchersApi(token, { signal } = {}) {
  return apiRequest('/api/wheel/vouchers', { token, signal })
}
