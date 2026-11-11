import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import { apiRequest } from '../../../src/services/apiClient.js'
import {
    confirmOrderReceivedApi,
    getAdminOrdersApi,
    transitionAdminOrderToProcessingApi,
} from '../../../src/services/orderApi.js'

afterEach(() => vi.clearAllMocks())

describe('Admin order API client', () => {
    it('requests a paged status-filtered Admin order list and forwards the abort signal', async () => {
        const signal = new AbortController().signal
        const response = { orders: [], pagination: { page: 2, limit: 10, total: 0, totalPages: 0 } }
        apiRequest.mockResolvedValue(response)

        await expect(getAdminOrdersApi('admin-token', {
            page: 2,
            limit: 10,
            status: 'Processing',
            signal,
        })).resolves.toBe(response)

        expect(apiRequest).toHaveBeenCalledWith(
            '/api/admin/orders?page=2&limit=10&status=Processing',
            { token: 'admin-token', signal }
        )
    })

    it('PATCHes the order status to Processing with an encoded order ID', async () => {
        const response = { orderId: 42, status: 'Processing' }
        apiRequest.mockResolvedValue(response)

        await expect(transitionAdminOrderToProcessingApi('admin-token', '42/other')).resolves.toBe(response)

        expect(apiRequest).toHaveBeenCalledWith('/api/admin/orders/42%2Fother/status', {
            method: 'PATCH',
            token: 'admin-token',
            body: { status: 'Processing' },
        })
    })
})

describe('Customer order confirmation API client', () => {
    it('POSTs the authenticated customer receipt confirmation', async () => {
        const response = { orderId: 31, status: 'Completed' }
        apiRequest.mockResolvedValue(response)

        await expect(confirmOrderReceivedApi('customer-token', 31)).resolves.toBe(response)

        expect(apiRequest).toHaveBeenCalledWith('/api/orders/31/confirm-received', {
            method: 'POST',
            token: 'customer-token',
        })
    })
})
