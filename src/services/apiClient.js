const API_URL = (
    import.meta.env.VITE_API_URL ||
    'http://127.0.0.1:3001'
).replace(/\/$/, '')

export async function apiRequest(
    path,
    { token, method = 'GET', body, ...options } = {}
) {
    const headers = {
        ...options.headers,
    }

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json'
    }

    if (token) {
        headers.Authorization = `Bearer ${token}`
    }

    let response

    try {
        response = await fetch(`${API_URL}${path}`, {
            ...options,
            method,
            headers,
            ...(body !== undefined
                ? { body: JSON.stringify(body) }
                : {}),
            cache: 'no-store',
        })
    } catch {
        const error = new Error(
            'Không thể kết nối Backend. Hãy kiểm tra Express Server.'
        )
        error.code = 'NETWORK_ERROR'
        error.isNetworkError = true
        throw error
    }

    const result = await response.json().catch(() => null)

    if (!response.ok || result?.success === false) {
        const error = new Error(
            result?.error?.message ||
            `Yêu cầu thất bại (HTTP ${response.status}).`
        )
        error.status = response.status
        error.code = result?.error?.code
        error.details = result?.error?.details
        error.isNetworkError = false
        throw error
    }

    return result?.data
}
