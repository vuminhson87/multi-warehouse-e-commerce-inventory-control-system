export const PAGINATION_WINDOW_SIZE = 5

/**
 * Tính cửa sổ trang cố định theo từng nhóm `windowSize` (mặc định 5 trang):
 * - Trang 1..5 -> [1, 2, 3, 4, 5]
 * - Trang 6..10 -> [6, 7, 8, 9, 10]
 * Không tự động trượt để căn trang hiện tại vào giữa.
 */
export function getPaginationWindow(page, totalPages, windowSize = PAGINATION_WINDOW_SIZE) {
    const safeTotalPages = Math.max(0, Math.trunc(Number(totalPages) || 0))
    if (safeTotalPages <= 0) {
        return { page: 1, totalPages: 0, pages: [], hasPrev: false, hasNext: false }
    }

    const safeWindowSize = Math.max(1, Math.trunc(Number(windowSize) || PAGINATION_WINDOW_SIZE))
    const safePage = Math.min(safeTotalPages, Math.max(1, Math.trunc(Number(page) || 1)))
    const blockStart = Math.floor((safePage - 1) / safeWindowSize) * safeWindowSize + 1
    const blockEnd = Math.min(safeTotalPages, blockStart + safeWindowSize - 1)
    const pages = Array.from(
        { length: blockEnd - blockStart + 1 },
        (_, index) => blockStart + index
    )

    return {
        page: safePage,
        totalPages: safeTotalPages,
        pages,
        hasPrev: safePage > 1,
        hasNext: safePage < safeTotalPages,
    }
}
