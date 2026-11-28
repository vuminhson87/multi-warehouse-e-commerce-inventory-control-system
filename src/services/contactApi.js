import { apiRequest } from './apiClient.js'

export function submitContactApi(payload) {
  return apiRequest('/api/contact', {
    method: 'POST',
    body: payload,
  })
}
