// Ngưỡng cảnh báo tồn kho theo (kho, sản phẩm) lưu ở localStorage.
// Dùng chung cho trang Cảnh báo, Dashboard kho và Tổng quan Admin.

export const THRESHOLD_STORAGE_KEY = 'productWarehouseLowStockThresholds'
export const DEFAULT_LOW_STOCK_THRESHOLD = 10

export function getStoredThresholds() {
    try {
        const saved = JSON.parse(localStorage.getItem(THRESHOLD_STORAGE_KEY))
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            return saved
        }
    } catch {
        // fallback
    }
    return {}
}

export function getThreshold(thresholds, warehouseId, productId) {
    const value = thresholds[`${warehouseId}_${productId}`]
    return Number.isSafeInteger(value) && value >= 0
        ? value
        : DEFAULT_LOW_STOCK_THRESHOLD
}

// 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL'
export function getStockStatus(available, threshold) {
    if (available <= 0) return 'OUT_OF_STOCK'
    return available <= threshold ? 'LOW_STOCK' : 'NORMAL'
}

