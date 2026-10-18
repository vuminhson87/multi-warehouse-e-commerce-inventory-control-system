import { describe, it, expect } from 'vitest'
import { selectFulfillmentWarehouse } from '../../src/modules/inventory/inventory.policy.js'

// Seed của M1 nhưng reserved = 0 (theo khuyến nghị contract mục 1).
const row = (warehouseId, productId, onHand, reserved = 0) => ({
    warehouseId,
    productId,
    onHand,
    reserved,
})

describe('selectFulfillmentWarehouse', () => {
    it('API01: không kho nào đủ cả hai sản phẩm thì trả null, không chia đơn (BR-01)', () => {
        // Kho 1 đủ A nhưng thiếu B; kho 2 đủ B nhưng thiếu A.
        const rows = [row(1, 1, 5), row(1, 2, 0), row(2, 1, 0), row(2, 2, 5)]

        expect(
            selectFulfillmentWarehouse(rows, [
                { productId: 1, quantity: 2 },
                { productId: 2, quantity: 2 },
            ])
        ).toBeNull()
    })

    it('API02: nhiều kho cùng đủ thì chọn warehouseId nhỏ nhất', () => {
        const rows = [
            row(3, 1, 10),
            row(1, 1, 10),
            row(2, 1, 10),
        ]

        expect(selectFulfillmentWarehouse(rows, [{ productId: 1, quantity: 2 }])).toBe(1)
    })

    it('bỏ qua kho nhỏ hơn nếu kho đó không đủ', () => {
        const rows = [row(1, 1, 1), row(2, 1, 10)]

        expect(selectFulfillmentWarehouse(rows, [{ productId: 1, quantity: 5 }])).toBe(2)
    })

    it('tính available = onHand - reserved', () => {
        const rows = [row(1, 1, 10, 9), row(2, 1, 10, 0)]

        expect(selectFulfillmentWarehouse(rows, [{ productId: 1, quantity: 2 }])).toBe(2)
    })

    it('đủ chính xác bằng số lượng cần thì vẫn chọn', () => {
        expect(
            selectFulfillmentWarehouse([row(1, 1, 5, 2)], [{ productId: 1, quantity: 3 }])
        ).toBe(1)
    })

    it('sản phẩm không có dòng tồn kho ở kho đó coi như hết hàng', () => {
        const rows = [row(1, 1, 10)]

        expect(
            selectFulfillmentWarehouse(rows, [
                { productId: 1, quantity: 1 },
                { productId: 2, quantity: 1 },
            ])
        ).toBeNull()
    })

    it('Keychron K2 hết hàng ở mọi kho (seed) thì trả null', () => {
        const rows = [row(1, 3, 0), row(2, 3, 0), row(3, 3, 0)]

        expect(selectFulfillmentWarehouse(rows, [{ productId: 3, quantity: 1 }])).toBeNull()
    })

    it('giỏ rỗng thì trả null', () => {
        expect(selectFulfillmentWarehouse([row(1, 1, 10)], [])).toBeNull()
    })
})
