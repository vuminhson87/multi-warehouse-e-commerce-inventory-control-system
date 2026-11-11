
import { apiRequest } from './apiClient.js'

export function loginApi(username, password) {
    return apiRequest('/api/auth/login', {
        method: 'POST',
        body: { username, password },
    })
}

export function registerApi({ username, password, fullName }) {
    return apiRequest('/api/auth/register', {
        method: 'POST',
        body: { username, password, ...(fullName ? { fullName } : {}) },
    })
}

export function getCurrentUserApi(token) {
    return apiRequest('/api/auth/me', {
        token,
    })
}
