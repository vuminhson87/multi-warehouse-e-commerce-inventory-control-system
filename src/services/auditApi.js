import { apiRequest } from './apiClient.js'

export function getAdminAuditLogsApi(
    token,
    { page = 1, limit = 20, targetType, action, search, signal } = {}
) {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    })
    if (targetType && targetType !== 'ALL') params.set('targetType', targetType)
    if (action && action !== 'ALL') params.set('action', action)
    if (search && String(search).trim()) params.set('search', String(search).trim())

    return apiRequest(`/api/admin/audit-logs?${params.toString()}`, { token, signal })
}
