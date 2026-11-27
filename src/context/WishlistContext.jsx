import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react'
import { useAuth } from './AuthContext'
import {
    addWishlistItemApi,
    getWishlistApi,
    removeWishlistItemApi,
} from '../services/wishlistApi'

const WishlistContext = createContext(null)
const GUEST_WISHLIST_STORAGE_KEY = 'atelier_wishlist_guest_ids'

function normalizeIds(raw) {
    if (!Array.isArray(raw)) return []
    const seen = new Set()
    const ids = []
    for (const value of raw) {
        const num = Number(value)
        if (Number.isSafeInteger(num) && num > 0 && !seen.has(num)) {
            seen.add(num)
            ids.push(num)
        }
    }
    return ids
}

function getInitialGuestWishlistIds() {
    try {
        const stored = localStorage.getItem(GUEST_WISHLIST_STORAGE_KEY)
        if (stored !== null) {
            return normalizeIds(JSON.parse(stored))
        }
    } catch {
        // Bỏ qua lỗi đọc localStorage
    }
    return []
}

export function WishlistProvider({ children }) {
    const { currentUser, token } = useAuth()
    const isAuthenticated = Boolean(token && currentUser?.id)
    const scopeKey = isAuthenticated ? `user:${currentUser.id}` : 'guest'

    const [guestIds, setGuestIds] = useState(getInitialGuestWishlistIds)
    const [remoteState, setRemoteState] = useState(null)
    const [isDrawerOpen, setIsDrawerOpen] = useState(false)
    const [toastMessage, setToastMessage] = useState('')
    const [isToastVisible, setIsToastVisible] = useState(false)

    const toastTimerRef = useRef(null)
    const inFlightIdsRef = useRef(new Set())
    const activeScopeRef = useRef(scopeKey)

    useEffect(() => {
        activeScopeRef.current = scopeKey
    }, [scopeKey])

    useEffect(() => {
        if (!isAuthenticated) return undefined

        const controller = new AbortController()
        const requestScope = scopeKey

        getWishlistApi(token, { signal: controller.signal })
            .then((data) => {
                if (!controller.signal.aborted) {
                    setRemoteState({
                        scopeKey: requestScope,
                        ids: normalizeIds(data?.productIds),
                    })
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setRemoteState({
                        scopeKey: requestScope,
                        ids: [],
                    })
                }
            })

        return () => controller.abort()
    }, [isAuthenticated, token, scopeKey])

    const wishlistIds = useMemo(() => {
        if (!isAuthenticated) return guestIds
        return remoteState?.scopeKey === scopeKey ? remoteState.ids : []
    }, [isAuthenticated, guestIds, remoteState, scopeKey])

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
            if (!Number.isSafeInteger(numericId) || numericId <= 0) return

            if (!isAuthenticated) {
                setGuestIds((prev) => {
                    const exists = prev.includes(numericId)
                    const next = exists
                        ? prev.filter((id) => id !== numericId)
                        : [...prev, numericId]
                    try {
                        localStorage.setItem(GUEST_WISHLIST_STORAGE_KEY, JSON.stringify(next))
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
                return
            }

            if (inFlightIdsRef.current.has(numericId)) return

            const requestScope = scopeKey
            const currentIds =
                remoteState?.scopeKey === requestScope ? remoteState.ids : []
            const exists = currentIds.includes(numericId)
            const optimisticIds = exists
                ? currentIds.filter((id) => id !== numericId)
                : [numericId, ...currentIds]

            setRemoteState({
                scopeKey: requestScope,
                ids: optimisticIds,
            })
            showToast(
                exists
                    ? `Đã xóa "${productName}" khỏi mục hàng đã thích`
                    : `Đã lưu "${productName}" vào mục hàng đã thích`
            )

            inFlightIdsRef.current.add(numericId)
            const request = exists
                ? removeWishlistItemApi(token, numericId)
                : addWishlistItemApi(token, numericId)

            request
                .then((data) => {
                    if (activeScopeRef.current !== requestScope) return
                    setRemoteState({
                        scopeKey: requestScope,
                        ids: normalizeIds(data?.productIds),
                    })
                })
                .catch((error) => {
                    if (activeScopeRef.current !== requestScope) return
                    setRemoteState((prev) => {
                        const baseIds =
                            prev?.scopeKey === requestScope ? prev.ids : optimisticIds
                        const rolledBack = exists
                            ? baseIds.includes(numericId)
                                ? baseIds
                                : [numericId, ...baseIds]
                            : baseIds.filter((id) => id !== numericId)
                        return {
                            scopeKey: requestScope,
                            ids: rolledBack,
                        }
                    })
                    showToast(error?.message || 'Không thể cập nhật mục hàng đã thích.')
                })
                .finally(() => {
                    inFlightIdsRef.current.delete(numericId)
                })
        },
        [isAuthenticated, token, scopeKey, remoteState, showToast]
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

// eslint-disable-next-line react-refresh/only-export-components
export function useWishlist() {
    const context = useContext(WishlistContext)
    if (!context) {
        throw new Error('useWishlist phải nằm trong WishlistProvider')
    }
    return context
}
