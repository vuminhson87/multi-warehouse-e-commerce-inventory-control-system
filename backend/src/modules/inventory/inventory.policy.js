// Quy tắc chọn kho (SRS BR-01, SR-ORD-02; contract mục 3.3).
// Hàm thuần: nhận dữ liệu tồn kho đã được kiểm tra/khóa an toàn, không tự truy vấn DB.
// Muốn đổi ưu tiên chọn kho thì chỉ sửa file này.

// inventoryRows: [{ warehouseId, productId, onHand, reserved }]
// items:         [{ productId, quantity }]  (đã gộp sản phẩm trùng)
// Trả về warehouseId được chọn, hoặc null nếu không có kho nào đủ TOÀN BỘ items.
export function selectFulfillmentWarehouse(inventoryRows, items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null
    }

    const availableByWarehouse = new Map()

    for (const row of inventoryRows) {
        const available = row.onHand - row.reserved

        if (!availableByWarehouse.has(row.warehouseId)) {
            availableByWarehouse.set(row.warehouseId, new Map())
        }

        availableByWarehouse.get(row.warehouseId).set(row.productId, available)
    }

    // Ưu tiên hiện tại: warehouseId nhỏ nhất trong các kho đủ toàn bộ items.
    const candidates = [...availableByWarehouse.keys()].sort((a, b) => a - b)

    for (const warehouseId of candidates) {
        const stock = availableByWarehouse.get(warehouseId)

        const enough = items.every(
            (item) => (stock.get(item.productId) ?? 0) >= item.quantity
        )

        if (enough) {
            return warehouseId
        }
    }

    return null
}
