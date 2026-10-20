// M3 - Nguyễn Anh Quân: kiểm tra dữ liệu seed thỏa quy mô SRS và bất biến tồn kho.
import { describe, it, expect } from 'vitest'
import {
    SEED_USERS,
    SEED_WAREHOUSES,
    buildInventories,
    buildProducts,
} from '../../prisma/seed-data.js'

describe('seed-data', () => {
    it('quy mô kiểm thử: 3 kho, 100–300 sản phẩm (SRS T21)', () => {
        expect(SEED_WAREHOUSES).toHaveLength(3)
        expect(buildProducts(120)).toHaveLength(120)
        expect(buildProducts(300)).toHaveLength(300)
        expect(() => buildProducts(301)).toThrow()
        expect(() => buildProducts(1)).toThrow()
    })

    it('3 sản phẩm đầu khớp mock frontend để không đổi id khi tích hợp', () => {
        const [dell, g304, k2] = buildProducts(100)

        expect(dell).toMatchObject({ id: 1, name: 'Laptop Dell Inspiron 15', price: 15990000 })
        expect(g304).toMatchObject({ id: 2, name: 'Logitech G304', price: 790000 })
        expect(k2).toMatchObject({ id: 3, name: 'Keychron K2', price: 2190000 })
    })

    it('id, sku duy nhất; giá dương; có sản phẩm ngừng kinh doanh để test SR-CAT-01', () => {
        const products = buildProducts(200)

        expect(new Set(products.map((p) => p.id)).size).toBe(200)
        expect(new Set(products.map((p) => p.sku)).size).toBe(200)
        expect(products.every((p) => p.price > 0)).toBe(true)
        expect(products.some((p) => !p.isActive)).toBe(true)
    })

    it('dữ liệu tất định: seed hai lần cho cùng kết quả', () => {
        expect(buildProducts(150)).toEqual(buildProducts(150))
    })

    it('tồn kho phủ mọi cặp (kho, sản phẩm), thỏa bất biến và không có reserved mồ côi', () => {
        const products = buildProducts(120)
        const rows = buildInventories(products)
        const keys = new Set(rows.map((r) => `${r.warehouseId}:${r.productId}`))

        expect(rows).toHaveLength(120 * 3)
        expect(keys.size).toBe(rows.length)

        for (const row of rows) {
            expect(row.onHand).toBeGreaterThanOrEqual(0)
            expect(row.reserved).toBe(0)
            expect(row.reserved).toBeLessThanOrEqual(row.onHand)
            expect(row.lowStockThreshold).toBeGreaterThanOrEqual(0)
        }

        // Keychron K2 hết hàng ở mọi kho như mock frontend.
        expect(rows.filter((r) => r.productId === 3).every((r) => r.onHand === 0)).toBe(true)
    })

    it('Manager có đúng một kho được phân công, vai trò khác không có (SR-AUTH-05)', () => {
        const warehouseIds = new Set(SEED_WAREHOUSES.map((w) => w.id))

        for (const user of SEED_USERS) {
            if (user.role === 'WAREHOUSE_MANAGER') {
                expect(warehouseIds.has(user.assignedWarehouseId)).toBe(true)
            } else {
                expect(user.assignedWarehouseId).toBeNull()
            }
        }

        // Không có trường mật khẩu thô trong dữ liệu seed (NFR-SEC-01).
        expect(SEED_USERS.some((u) => 'password' in u)).toBe(false)
    })
})
