import { apiRequest } from './apiClient.js'

function getAuthToken(token) {
    if (token) return token
    try {
        return sessionStorage.getItem('mw_access_token') || undefined
    } catch {
        return undefined
    }
}

export async function loadPublicFeaturedSlides({ signal } = {}) {
    return apiRequest('/api/featured-products', { signal })
}

export async function loadAdminFeaturedSlides({ signal, token } = {}) {
    return apiRequest('/api/admin/featured-products', {
        signal,
        token: getAuthToken(token),
    })
}

export async function saveAdminFeaturedSlides(payload, token) {
    return apiRequest('/api/admin/featured-products', {
        method: 'PUT',
        body: payload,
        token: getAuthToken(token),
    })
}

