import { apiRequest } from './apiClient.js'

export async function loadProducts(token, signal) {
    const path = token ? '/api/admin/products' : '/api/products'
    const getPage = (page) => apiRequest(`${path}?page=${page}&limit=100`, { token, signal })
    const first = await getPage(1)
    const pages = await Promise.all(
        Array.from({ length: Math.max(0, Math.ceil(first.total / first.limit) - 1) },
            (_, index) => getPage(index + 2))
    )
    return [...first.items, ...pages.flatMap(page => page.items)]
}

export function loadProduct(id, signal) {
    return apiRequest(`/api/products/${encodeURIComponent(id)}`, { signal })
}

export function loadProductAvailability(productIds, signal) {
    const ids = [...new Set(productIds.map(Number).filter(id => Number.isSafeInteger(id) && id > 0))]
    if (!ids.length) return Promise.resolve({ warehouses: [], items: [] })
    return apiRequest(`/api/products/availability?productIds=${ids.join(',')}`, { signal })
}

export function saveProduct(token, id, form) {
    const body = {
        name: form.name.trim(),
        category: form.category.trim(),
        price: form.price.trim(),
        description: form.description.trim(),
    }
    const path = id == null ? '/api/admin/products' : `/api/admin/products/${encodeURIComponent(id)}`
    return apiRequest(path, { token, method: id == null ? 'POST' : 'PATCH', body })
}

export function setProductStatus(token, id, status) {
    const action = status === 'ACTIVE' ? 'activate' : 'discontinue'
    return apiRequest(`/api/admin/products/${encodeURIComponent(id)}/${action}`, {
        token, method: 'POST', body: {},
    })
}
