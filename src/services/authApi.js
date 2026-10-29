
import { apiRequest } from './apiClient.js'

export function loginApi(username, password) {
    return apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username, password },
    })
}

export function getCurrentUserApi(token) {
    return apiRequest('/api/auth/me', {
        token,
    })
}
