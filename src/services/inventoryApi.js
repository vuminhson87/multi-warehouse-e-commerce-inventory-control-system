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
