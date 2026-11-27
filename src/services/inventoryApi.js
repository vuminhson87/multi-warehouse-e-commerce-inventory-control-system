import { apiRequest } from './apiClient.js'

export function loadWarehouses(token, signal) {
    return apiRequest('/api/inventory/warehouses', { token, signal })
}

export async function loadWarehouseInventory(token, warehouseId, signal) {
    const getPage = (page) => {
        const query = new URLSearchParams({
            warehouseId: String(warehouseId),
            page: String(page),
            limit: '100',
        })
        return apiRequest(`/api/inventory?${query}`, { token, signal })
    }
    const first = await getPage(1)
    const pages = await Promise.all(
        Array.from({ length: Math.max(0, Math.ceil(first.total / first.limit) - 1) },
            (_, index) => getPage(index + 2))
    )
    return [...first.items, ...pages.flatMap(page => page.items)]
}

export function restockWarehouseProduct(token, warehouseId, productId, quantity) {
    return apiRequest(`/api/inventory/${warehouseId}/restock`, {
        token,
        method: 'POST',
        body: { productId, quantity },
    })
}

export function loadWarehouseAlerts(token, warehouseId, signal) {
    const query = warehouseId === undefined
        ? ''
        : `?warehouseId=${encodeURIComponent(warehouseId)}`
    return apiRequest(`/api/inventory/alerts${query}`, { token, signal })
}

export function saveWarehouseThreshold(token, warehouseId, productId, threshold) {
    return apiRequest(`/api/inventory/${warehouseId}/threshold`, {
        token,
        method: 'PATCH',
        body: { productId, threshold },
    })
}

export function adjustWarehouseStock(token, warehouseId, productId, onHand, note) {
    return apiRequest(`/api/inventory/${warehouseId}/adjust`, {
        token,
        method: 'PATCH',
        body: { productId, onHand, note },
    })
}

export function loadInventoryMovements(
    token,
    { warehouseId, productId, type, search, page = 1, limit = 20 } = {},
    signal
) {
    const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    })
    if (warehouseId !== undefined && warehouseId !== '' && warehouseId !== 'all') {
        query.set('warehouseId', String(warehouseId))
    }
    if (productId !== undefined && productId !== '') {
        query.set('productId', String(productId))
    }
    if (type && type !== 'ALL') {
        query.set('type', type)
    }
    if (search && String(search).trim()) {
        query.set('search', String(search).trim())
    }
    return apiRequest(`/api/inventory/movements?${query}`, { token, signal })
}
