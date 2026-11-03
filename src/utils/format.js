// Tiện ích định dạng & ảnh dự phòng dùng chung cho toàn bộ giao diện.

export function formatPrice(value) {
    const n = Number(value)
    return Number.isFinite(n) && n > 0
        ? `${n.toLocaleString('vi-VN')}₫`
        : 'Liên hệ'
}

export function formatNumber(value) {
    const n = Number(value)
    return Number.isFinite(n) ? n.toLocaleString('vi-VN') : '0'
}

const FALLBACK_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">' +
    '<rect width="200" height="200" fill="#f3f3f3"/>' +
    '<g fill="none" stroke="#bdbdbd" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M60 80l40-22 40 22v44l-40 22-40-22z"/>' +
    '<path d="M60 80l40 22 40-22M100 102v44"/></g></svg>'

export const IMAGE_FALLBACK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    FALLBACK_SVG
)}`

// Dùng làm onError cho thẻ <img>: chỉ thay một lần để tránh vòng lặp.
export function handleImageError(event) {
    const img = event.currentTarget
    if (img.dataset.fallback) return
    img.dataset.fallback = '1'
    img.src = IMAGE_FALLBACK
}

