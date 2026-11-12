// 'OUT_OF_STOCK' | 'LOW_STOCK' | 'NORMAL'
export function getStockStatus(available, threshold) {
    if (available <= 0) return 'OUT_OF_STOCK'
    return available <= threshold ? 'LOW_STOCK' : 'NORMAL'
}

