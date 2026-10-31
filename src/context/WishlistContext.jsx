import { createContext, useCallback, useContext, useRef, useState } from 'react'

const WishlistContext = createContext(null)
const WISHLIST_STORAGE_KEY = 'atelier_wishlist_ids'

function getInitialWishlistIds() {
    try {
        const stored = localStorage.getItem(WISHLIST_STORAGE_KEY)
        if (stored !== null) {
            const parsed = JSON.parse(stored)
            if (Array.isArray(parsed)) {
                return parsed.map((id) => Number(id)).filter((id) => Number.isFinite(id))
            }
        }
    } catch {
        // Bỏ qua lỗi đọc localStorage
    }
    return [1, 2]
}

export function WishlistProvider({ children }) {
    const [wishlistIds, setWishlistIds] = useState(getInitialWishlistIds)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [toastMessage, setToastMessage] = useState('')
    const [isToastVisible, setIsToastVisible] = useState(false)
    const toastTimerRef = useRef(null)

    const showToast = useCallback((message) => {
        if (!message) return
        setToastMessage(message)
        setIsToastVisible(true)
        if (toastTimerRef.current) {
            clearTimeout(toastTimerRef.current)
        }
        toastTimerRef.current = setTimeout(() => {
            setIsToastVisible(false)
        }, 2400)
    }, [])

    const toggleWishlist = useCallback(
        (productId, productName = 'Sản phẩm') => {
            const numericId = Number(productId)
            setWishlistIds((prev) => {
                const exists = prev.includes(numericId)
                const next = exists
                    ? prev.filter((id) => id !== numericId)
                    : [...prev, numericId]
                try {
                    localStorage.setItem(WISHLIST_STORAGE_KEY, JSON.stringify(next))
                } catch {
                    // Bỏ qua lỗi lưu localStorage
                }
                showToast(
                    exists
                        ? `Đã xóa "${productName}" khỏi mục hàng đã thích`
                        : `Đã lưu "${productName}" vào mục hàng đã thích`
                )
                return next
            })
        },
        [showToast]
    )

    const isWishlisted = useCallback(
        (productId) => wishlistIds.includes(Number(productId)),
        [wishlistIds]
    )

    return (
        <WishlistContext.Provider
            value={{
                wishlistIds,
                toggleWishlist,
                isWishlisted,
                isDrawerOpen,
                setIsDrawerOpen,
                toastMessage,
                isToastVisible,
                showToast,
            }}
        >
            {children}
        </WishlistContext.Provider>
    )
}

export function useWishlist() {
    const context = useContext(WishlistContext)
    if (!context) {
        throw new Error('useWishlist phải nằm trong WishlistProvider')
    }
    return context
}
