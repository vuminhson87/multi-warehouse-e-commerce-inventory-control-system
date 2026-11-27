import { apiRequest } from './apiClient.js'

export function loadWarehouseManagersApi(token, signal) {
    return apiRequest('/api/admin/warehouse-managers', { token, signal })
}

export function assignManagerWarehouseApi(token, userId, warehouseId) {
    return apiRequest(
        `/api/admin/warehouse-managers/${encodeURIComponent(String(userId))}/warehouse`,
        {
            method: 'PATCH',
            token,
            body: { warehouseId: Number(warehouseId) },
        }
    )
}

const enc = (id) => encodeURIComponent(String(id))

export function getAdminUsersApi(token, { page = 1, limit = 20, role, status, search, signal } = {}) {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    })
    if (role && role !== 'ALL') params.set('role', role)
    if (status && status !== 'ALL') params.set('status', status)
    if (search && String(search).trim()) params.set('search', String(search).trim())
    return apiRequest(`/api/admin/users?${params.toString()}`, { token, signal })
}

export function getAdminUserDetailApi(token, userId, { signal } = {}) {
    return apiRequest(`/api/admin/users/${enc(userId)}`, { token, signal })
}

export function createWarehouseManagerApi(token, { username, password, fullName, email, warehouseId }) {
    const body = {
        username: String(username).trim(),
        password,
        warehouseId: Number(warehouseId),
    }
    if (fullName !== undefined && String(fullName).trim()) body.fullName = String(fullName).trim()
    if (email !== undefined && String(email).trim()) body.email = String(email).trim()
    return apiRequest('/api/admin/users/warehouse-managers', {
        method: 'POST',
        token,
        body,
    })
}

export function updateAdminUserApi(token, userId, payload) {
    return apiRequest(`/api/admin/users/${enc(userId)}`, {
        method: 'PATCH',
        token,
        body: payload,
    })
}

export function setAdminUserStatusApi(token, userId, { isActive, reason }) {
    const body = { isActive: Boolean(isActive) }
    if (reason !== undefined && String(reason).trim()) body.reason = String(reason).trim()
    return apiRequest(`/api/admin/users/${enc(userId)}/status`, {
        method: 'PATCH',
        token,
        body,
    })
}

export function resetAdminUserPasswordApi(token, userId, newPassword) {
    return apiRequest(`/api/admin/users/${enc(userId)}/reset-password`, {
        method: 'POST',
        token,
        body: { newPassword },
    })
}

export function deleteAdminUserApi(token, userId, { mode = 'delete' } = {}) {
    const suffix = mode === 'anonymize' ? '?mode=anonymize' : ''
    return apiRequest(`/api/admin/users/${enc(userId)}${suffix}`, {
        method: 'DELETE',
        token,
    })
}
