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

export function requestRegisterOtpApi({ email, username, password, fullName }) {
    return apiRequest('/api/auth/register/request-otp', {
        method: 'POST',
        body: {
            email,
            username,
            password,
            ...(fullName ? { fullName } : {}),
        },
    })
}

export function verifyRegisterOtpApi({ email, username, password, fullName, otp }) {
    return apiRequest('/api/auth/register/verify-otp', {
        method: 'POST',
        body: {
            email,
            username,
            password,
            otp,
            ...(fullName ? { fullName } : {}),
        },
    })
}

export function getCurrentUserApi(token) {
    return apiRequest('/api/auth/me', {
        token,
    })
}

export function updateProfileApi(token, { fullName }) {
    return apiRequest('/api/auth/profile', {
        method: 'PATCH',
        token,
        body: { fullName },
    })
}

export function changePasswordApi(token, { currentPassword, newPassword }) {
    return apiRequest('/api/auth/password', {
        method: 'PATCH',
        token,
        body: { currentPassword, newPassword },
    })
}
