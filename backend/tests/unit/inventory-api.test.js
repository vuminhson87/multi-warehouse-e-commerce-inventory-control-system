import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../src/services/apiClient.js'
import {
    loadWarehouseInventory,
    restockWarehouseProduct,
} from '../../../src/services/inventoryApi.js'

afterEach(() => vi.clearAllMocks())

describe('inventory API client', () => {
    it('loads every inventory page for the selected warehouse', async () => {
        const signal = new AbortController().signal
        const firstPage = Array.from({ length: 100 }, (_, index) => ({ productId: index + 1 }))
        const secondPage = Array.from({ length: 100 }, (_, index) => ({ productId: index + 101 }))
        const finalPage = [{ productId: 201 }]
        apiRequest
            .mockResolvedValueOnce({ items: firstPage, total: 201, limit: 100 })
            .mockResolvedValueOnce({ items: secondPage })
            .mockResolvedValueOnce({ items: finalPage })

        const inventory = await loadWarehouseInventory('manager-token', 3, signal)

        expect(inventory).toHaveLength(201)
        expect(inventory[0]).toEqual({ productId: 1 })
        expect(inventory.at(-1)).toEqual({ productId: 201 })
        expect(apiRequest).toHaveBeenCalledTimes(3)
        expect(apiRequest).toHaveBeenNthCalledWith(1, '/api/inventory?warehouseId=3&page=1&limit=100', {
            token: 'manager-token',
            signal,
        })
        expect(apiRequest).toHaveBeenNthCalledWith(2, '/api/inventory?warehouseId=3&page=2&limit=100', {
            token: 'manager-token',
            signal,
        })
        expect(apiRequest).toHaveBeenNthCalledWith(3, '/api/inventory?warehouseId=3&page=3&limit=100', {
            token: 'manager-token',
            signal,
        })
    })

    it('posts a restock to the selected warehouse with the authenticated token', async () => {
        const result = { warehouseId: 3, productId: 27, onHand: 15 }
        apiRequest.mockResolvedValue(result)

        await expect(restockWarehouseProduct('manager-token', 3, 27, 5)).resolves.toBe(result)

        expect(apiRequest).toHaveBeenCalledWith('/api/inventory/3/restock', {
            token: 'manager-token',
            method: 'POST',
            body: { productId: 27, quantity: 5 },
        })
    })
})
