import { apiRequest } from './apiClient.js'

const id = (productId) => encodeURIComponent(String(productId))

export function getWishlistApi(token, { signal } = {}) {
    return apiRequest('/api/wishlist', { token, signal })
}

export function addWishlistItemApi(token, productId) {
    return apiRequest(`/api/wishlist/${id(productId)}`, {
        method: 'POST',
        token,
    })
}

export function removeWishlistItemApi(token, productId) {
    return apiRequest(`/api/wishlist/${id(productId)}`, {
        method: 'DELETE',
        token,
    })
}
