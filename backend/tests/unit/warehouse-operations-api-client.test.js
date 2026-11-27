import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../src/services/apiClient.js'
import {
    adjustWarehouseStock,
    loadInventoryMovements,
} from '../../../src/services/inventoryApi.js'

afterEach(() => vi.clearAllMocks())

describe('Warehouse movement & stocktaking API client', () => {
    it('loads paginated inventory movements with optional filters', async () => {
        const signal = new AbortController().signal
        const response = { total: 1, page: 1, limit: 20, totalPages: 1, items: [] }
        apiRequest.mockResolvedValue(response)

        await expect(
            loadInventoryMovements(
                'manager-token',
                { warehouseId: 'all', type: 'ADJUST', search: 'Dell', page: 2, limit: 20 },
                signal
            )
        ).resolves.toBe(response)

        expect(apiRequest).toHaveBeenCalledWith(
            '/api/inventory/movements?page=2&limit=20&type=ADJUST&search=Dell',
            { token: 'manager-token', signal }
        )
    })

    it('PATCHes stocktaking adjustment payload to warehouse adjust endpoint', async () => {
        const response = { inventory: { warehouseId: 1, productId: 5, onHand: 12 }, changed: true }
        apiRequest.mockResolvedValue(response)

        await expect(
            adjustWarehouseStock('manager-token', 1, 5, 12, 'Kiểm kê cuối ngày')
        ).resolves.toBe(response)

        expect(apiRequest).toHaveBeenCalledWith('/api/inventory/1/adjust', {
            token: 'manager-token',
            method: 'PATCH',
            body: { productId: 5, onHand: 12, note: 'Kiểm kê cuối ngày' },
        })
    })
})
