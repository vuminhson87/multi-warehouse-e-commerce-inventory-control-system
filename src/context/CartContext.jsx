import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from './AuthContext'
import { useProducts } from './ProductContext'
import { loadProductAvailability } from '../services/productApi.js'

const CartContext = createContext()
const MAX_QUANTITY_PER_PRODUCT = 100

function getStorageKey(user) {
    if (!user) {
        return 'cart_guest'
    }
    return `cart_user_${user.id || user.username}`
}

function loadSavedCart(storageKey) {
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey))
        if (Array.isArray(saved)) {
            return saved
                .filter(
                    (item) =>
                        item &&
                        Number.isSafeInteger(Number(item.productId)) &&
                        Number.isSafeInteger(Number(item.quantity)) &&
                        Number(item.quantity) > 0
                )
                .map((item) => ({
                    productId: Number(item.productId),
                    quantity: Number(item.quantity),
                }))
        }
    } catch (error) {
        console.error('Không thể đọc giỏ hàng từ localStorage:', error)
    }
    return []
}

export function CartProvider({ children }) {
    const { currentUser } = useAuth()
    const { products } = useProducts()

    const storageKey = getStorageKey(currentUser)
    const [cartByUser, setCartByUser] = useState(() => ({
        [storageKey]: loadSavedCart(storageKey),
    }))
    const [stockData, setStockData] = useState({ warehouses: [], items: [], productIds: [], queryKey: '', error: null })
    const cartByUserRef = useRef(cartByUser)
    const cartVersionRef = useRef(0)

    const rawItems = cartByUser[storageKey] ?? loadSavedCart(storageKey)
    const cartProductIds = [...new Set(rawItems.map(item => Number(item.productId)))].sort((a, b) => a - b)
    const cartProductIdsKey = cartProductIds.join(',')
    const stockQueryKey = `${storageKey}:${cartVersionRef.current}:${cartProductIdsKey}`

    useEffect(() => {
        if (!cartProductIdsKey) {
            return undefined
        }

        const controller = new AbortController()
        const productIds = cartProductIdsKey.split(',').map(Number)
        loadProductAvailability(productIds, controller.signal)
            .then(data => {
                if (!controller.signal.aborted) setStockData({ ...data, productIds, queryKey: stockQueryKey, error: null })
            })
            .catch(error => {
                if (!controller.signal.aborted) setStockData(previous => ({ ...previous, productIds, queryKey: stockQueryKey, error }))
            })
        return () => controller.abort()
    }, [stockQueryKey])

    const stockMatchesCart = rawItems.length === 0 || stockData.queryKey === stockQueryKey
    const stockLoading = rawItems.length > 0 && !stockMatchesCart
    const stockError = rawItems.length > 0 && stockMatchesCart ? stockData.error : null

    // Lưu giỏ hàng của tài khoản hiện tại vào localStorage khi có thay đổi
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(rawItems))
        } catch (error) {
            console.error('Không thể lưu giỏ hàng vào localStorage:', error)
        }
    }, [storageKey, rawItems])

    // Đồng bộ thông tin sản phẩm mới nhất (giá mới, tên, trạng thái kinh doanh, tồn kho khả dụng)
    const cartItems = useMemo(() => {
        return rawItems.map((item) => {
            const product = products.find(
                (p) => Number(p.id) === Number(item.productId)
            )

            const isDiscontinued = !product || product.status === 'DISCONTINUED'
            const availableStock = Math.max(0, ...stockData.items
                .filter(row => Number(row.productId) === Number(item.productId))
                .map(row => Number(row.available)))
            const isOutOfStock = availableStock <= 0
            const isInsufficientStock = item.quantity > availableStock

            return {
                id: item.productId,
                productId: item.productId,
                name: product?.name || 'Sản phẩm không xác định',
                price: product?.price ?? 0,
                category: product?.category || '',
                description: product?.description || '',
                status: product?.status || 'DISCONTINUED',
                isDiscontinued,
                availableStock,
                isOutOfStock,
                isInsufficientStock,
                quantity: item.quantity,
            }
        })
    }, [rawItems, products, stockData.items])

    // Xác định kho có thể đáp ứng trọn vẹn toàn bộ các món trong giỏ hàng (Single-Warehouse Fulfillment)
    const fulfillmentWarehouse = useMemo(() => {
        if (!rawItems.length) return null
        if (stockLoading || stockError) return null
        return [...stockData.warehouses]
            .sort((a, b) => Number(a.id) - Number(b.id))
            .find(warehouse => rawItems.every(item => {
                const row = stockData.items.find(stock =>
                    Number(stock.warehouseId) === Number(warehouse.id) &&
                    Number(stock.productId) === Number(item.productId)
                )
                return Number(row?.available ?? 0) >= item.quantity
            })) ?? null
    }, [rawItems, stockData.items, stockData.warehouses, stockLoading, stockError])

    const updateRawItems = (updater) => {
        const previousCart = cartByUserRef.current
        const currentItems = previousCart[storageKey] ?? loadSavedCart(storageKey)
        const nextItems = typeof updater === 'function' ? updater(currentItems) : updater

        if (nextItems === currentItems) return false

        const nextCart = {
            ...previousCart,
            [storageKey]: nextItems,
        }

        cartByUserRef.current = nextCart
        cartVersionRef.current += 1
        setCartByUser(nextCart)
        return true
    }

    const addToCart = (product, quantity = 1, { warehouseStock } = {}) => {
        const productId = Number(product?.id)
        const currentProduct = products.find((item) => Number(item.id) === productId)

        if (!currentProduct || (currentProduct.status ?? 'ACTIVE') !== 'ACTIVE') {
            alert('Sản phẩm không khả dụng để thêm vào giỏ hàng.')
            return false
        }

        if (!Number.isSafeInteger(quantity) || quantity < 1) {
            alert('Số lượng thêm phải là số nguyên dương.')
            return false
        }

        if (warehouseStock !== undefined
            && (!Number.isSafeInteger(warehouseStock) || warehouseStock < 0)) {
            alert('Thông tin tồn kho không hợp lệ.')
            return false
        }

        const available = warehouseStock ?? Number(currentProduct.maxAvailable ?? 0)

        if (!Number.isSafeInteger(available) || available <= 0) {
            alert(warehouseStock === undefined
                ? 'Sản phẩm hiện đã hết hàng, không thể thêm vào giỏ hàng.'
                : 'Sản phẩm hiện đã hết hàng tại kho đang xem.')
            return false
        }

        const limit = Math.min(available, MAX_QUANTITY_PER_PRODUCT)
        const added = updateRawItems((items) => {
            const existing = items.find((item) => item.productId === productId)
            const nextQty = (existing?.quantity ?? 0) + quantity

            if (nextQty > limit) return items

            if (!existing) return [...items, { productId, quantity }]

            return items.map((item) =>
                item.productId === productId ? { ...item, quantity: nextQty } : item
            )
        })

        if (!added) {
            alert(`Tổng số lượng sản phẩm trong giỏ không được vượt quá ${limit}.`)
        }

        return added
    }

    const increaseQuantity = (productId) => {
        if (stockLoading || stockError) {
            alert('Đang tải tồn kho máy chủ. Vui lòng thử lại sau.')
            return
        }
        const targetId = Number(productId)
        const currentProduct = products.find((p) => Number(p.id) === targetId)

        if (currentProduct && currentProduct.status === 'DISCONTINUED') {
            alert('Sản phẩm đã ngừng kinh doanh, không thể tăng số lượng.')
            return
        }

        const available = Math.max(0, ...stockData.items
            .filter(item => Number(item.productId) === targetId)
            .map(item => Number(item.available)))
        if (available <= 0) {
            alert('Sản phẩm hiện đã hết hàng trong kho.')
            return
        }

        const latestItems = cartByUserRef.current[storageKey] ?? loadSavedCart(storageKey)
        const existingItem = latestItems.find((item) => item.productId === targetId)
        const currentQty = existingItem ? existingItem.quantity : 0

        if (currentQty + 1 > available) {
            alert(
                `Số lượng trong giỏ vượt quá tồn khả dụng dự kiến của một kho (hiện có: ${available}). Quy định: Một đơn hàng chỉ lấy từ 1 kho.`
            )
            return
        }

        if (currentQty + 1 > MAX_QUANTITY_PER_PRODUCT) {
            alert(`Số lượng tối đa cho mỗi sản phẩm là ${MAX_QUANTITY_PER_PRODUCT}.`)
            return
        }

        updateRawItems((prev) =>
            prev.map((item) =>
                item.productId === targetId
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            )
        )
    }

    const decreaseQuantity = (productId) => {
        const targetId = Number(productId)
        updateRawItems((prev) =>
            prev
                .map((item) =>
                    item.productId === targetId
                        ? { ...item, quantity: item.quantity - 1 }
                        : item
                )
                .filter((item) => item.quantity > 0)
        )
    }

    const removeFromCart = (productId) => {
        const targetId = Number(productId)
        updateRawItems((prev) =>
            prev.filter((item) => item.productId !== targetId)
        )
    }

    const clearCart = () => {
        updateRawItems([])
    }

    return (
        <CartContext.Provider
            value={{
                cartItems,
                addToCart,
                increaseQuantity,
                decreaseQuantity,
                removeFromCart,
                clearCart,
                fulfillmentWarehouse,
                stockLoading,
                stockError,
            }}
        >
            {children}
        </CartContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
    return useContext(CartContext)
}
