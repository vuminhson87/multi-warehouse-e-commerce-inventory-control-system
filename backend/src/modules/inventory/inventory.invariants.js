// M3 - Nguyễn Anh Quân: Hàm thuần về bất biến tồn kho, dùng chung cho repository và test.
// SR-INV-02, BR-07, BR-12.

import { validationError } from '../../shared/errors.js'

// Giới hạn một lần nhập kho để chặn nhập nhầm số quá lớn.
export const MAX_RESTOCK_QUANTITY = 100000
export const MAX_LOW_STOCK_THRESHOLD = 100000

export function computeAvailable({ onHand, reserved }) {
    return onHand - reserved
}

// BR-07 / SR-ALERT-02: cảnh báo khi available <= threshold (bằng ngưỡng cũng cảnh báo – test T12).
export function isLowStock({ onHand, reserved, lowStockThreshold }) {
    return computeAvailable({ onHand, reserved }) <= lowStockThreshold
}

export function isValidInventoryState({ onHand, reserved, lowStockThreshold = 0 }) {
    return (
        Number.isInteger(onHand) &&
        Number.isInteger(reserved) &&
        onHand >= 0 &&
        reserved >= 0 &&
        reserved <= onHand &&
        Number.isInteger(lowStockThreshold) &&
        lowStockThreshold >= 0
    )
}

export function assertPositiveQuantity(value, field = 'quantity', max = MAX_RESTOCK_QUANTITY) {
    if (!Number.isInteger(value) || value < 1 || value > max) {
        throw validationError([{ field, reason: `Phải là số nguyên từ 1 đến ${max}.` }])
    }

    return value
}

export function assertThreshold(value, field = 'threshold') {
    if (!Number.isInteger(value) || value < 0 || value > MAX_LOW_STOCK_THRESHOLD) {
        throw validationError([
            { field, reason: `Phải là số nguyên từ 0 đến ${MAX_LOW_STOCK_THRESHOLD}.` },
        ])
    }

    return value
}

// Chuẩn hóa items: gộp sản phẩm trùng, sắp theo productId để khóa hàng theo thứ tự cố định (tránh deadlock).
export function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw validationError([{ field: 'items', reason: 'Phải có ít nhất một sản phẩm.' }])
    }

    const merged = new Map()

    items.forEach((item, index) => {
        if (!Number.isInteger(item?.productId) || item.productId < 1) {
            throw validationError([
                { field: `items[${index}].productId`, reason: 'Phải là số nguyên dương.' },
            ])
        }

        assertPositiveQuantity(item.quantity, `items[${index}].quantity`)
        merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity)
    })

    return [...merged.entries()]
        .sort(([a], [b]) => a - b)
        .map(([productId, quantity]) => ({ productId, quantity }))
}
