import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../src/services/apiClient.js'
import {
    assignManagerWarehouseApi,
    loadWarehouseManagersApi,
} from '../../../src/services/adminUserApi.js'

afterEach(() => vi.clearAllMocks())

describe('Admin user warehouse assignment API client', () => {
    it('loads warehouse managers and warehouses with abort signal', async () => {
        const signal = new AbortController().signal
        const response = { managers: [], warehouses: [] }
        apiRequest.mockResolvedValue(response)

        await expect(loadWarehouseManagersApi('admin-token', signal)).resolves.toBe(response)
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/warehouse-managers', {
            token: 'admin-token',
            signal,
        })
    })

    it('PATCHes assigned warehouseId with encoded userId', async () => {
        const response = { manager: { id: 2, assignedWarehouseId: 3 }, changed: true }
        apiRequest.mockResolvedValue(response)

        await expect(assignManagerWarehouseApi('admin-token', '2/other', '3')).resolves.toBe(response)
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/warehouse-managers/2%2Fother/warehouse', {
            method: 'PATCH',
            token: 'admin-token',
            body: { warehouseId: 3 },
        })
    })
})
