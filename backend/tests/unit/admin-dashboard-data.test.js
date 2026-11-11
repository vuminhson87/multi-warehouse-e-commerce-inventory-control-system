import { describe, expect, it } from 'vitest'
import {
    buildWarehouseDistribution,
    summarizeDashboardInventory,
} from '../../../src/utils/adminDashboardData.js'

describe('admin dashboard inventory data', () => {
    it('aggregates on-hand and reserved stock from API inventory rows', () => {
        const summary = summarizeDashboardInventory([
            { warehouseId: 1, productId: 10, onHand: 12, reserved: 3 },
            { warehouseId: 2, productId: 10, onHand: 8, reserved: 2 },
        ])

        expect(summary).toEqual({
            totalOnHand: 20,
            totalReserved: 5,
            totalAvailable: 15,
        })
    })

    it('calculates warehouse distribution from on-hand quantities and keeps empty warehouses', () => {
        const distribution = buildWarehouseDistribution(
            [{ id: 1, name: 'Kho Bắc' }, { id: 2, name: 'Kho Nam' }, { id: 3, name: 'Kho Trung' }],
            [
                { warehouseId: 1, productId: 10, onHand: 10 },
                { warehouseId: 1, productId: 11, onHand: 5 },
                { warehouseId: 2, productId: 10, onHand: 5 },
            ]
        )

        expect(distribution.total).toBe(20)
        expect(distribution.rows.map(row => row.onHand)).toEqual([15, 5, 0])
        expect(distribution.rows.map(row => row.percent)).toEqual([75, 25, 0])
        expect(distribution.gradient).toContain('conic-gradient(')
    })

    it('returns zero totals and no chart gradient when there is no inventory', () => {
        expect(summarizeDashboardInventory([])).toEqual({
            totalOnHand: 0,
            totalReserved: 0,
            totalAvailable: 0,
        })
        expect(buildWarehouseDistribution([{ id: 1, name: 'Kho Bắc' }], [])).toMatchObject({
            total: 0,
            rows: [{ onHand: 0, percent: 0 }],
            gradient: null,
        })
    })
})
