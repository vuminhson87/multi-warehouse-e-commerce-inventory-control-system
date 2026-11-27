// 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL'
export function getStockStatus(available, threshold) {
    if (available <= 0) return 'OUT_OF_STOCK'
    return available <= threshold ? 'LOW_STOCK' : 'NORMAL'
}

export function buildProductFallback(row) {
    if (!row || row.productId == null) return null

    return {
        id: Number(row.productId),
        sku: row.sku,
        name: row.productName || 'Không xác định',
        category: row.category || '',
        imageUrl: row.imageUrl ?? null,
        status: row.isActive === false ? 'DISCONTINUED' : 'ACTIVE',
    }
}

/**
 * Hợp nhất danh sách sản phẩm từ context với thông tin sản phẩm đính kèm
 * trong tồn kho / cảnh báo (giúp Quản lý kho hiển thị đủ cả sản phẩm ngừng kinh doanh).
 */
export function mergeInventoryProducts(products = [], rows = []) {
    const merged = [...products]
    const seenIds = new Set(products.map((product) => Number(product.id)))

    for (const row of rows) {
        const productId = Number(row?.productId)
        if (!Number.isSafeInteger(productId) || productId <= 0 || seenIds.has(productId)) {
            continue
        }
        const fallback = buildProductFallback(row)
        if (fallback) {
            seenIds.add(productId)
            merged.push(fallback)
        }
    }

    return merged
}

