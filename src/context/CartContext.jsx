import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import { useProducts } from './ProductContext'
import { useInventory } from './InventoryContext'

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
    const { getProductAvailableStock, findFulfillmentWarehouse } = useInventory()

    const storageKey = getStorageKey(currentUser)
    const [cartByUser, setCartByUser] = useState(() => ({
        [storageKey]: loadSavedCart(storageKey),
    }))

    const rawItems = cartByUser[storageKey] ?? loadSavedCart(storageKey)

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
            const availableStock = getProductAvailableStock(item.productId)
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
    }, [rawItems, products, getProductAvailableStock])

    // Xác định kho có thể đáp ứng trọn vẹn toàn bộ các món trong giỏ hàng (Single-Warehouse Fulfillment)
    const fulfillmentWarehouse = useMemo(() => {
        if (!rawItems.length) return null
        return findFulfillmentWarehouse(rawItems)
    }, [rawItems, findFulfillmentWarehouse])

    const updateRawItems = (updater) => {
        setCartByUser((prev) => {
            const currentItems = prev[storageKey] ?? loadSavedCart(storageKey)
            const nextItems =
                typeof updater === 'function' ? updater(currentItems) : updater
            return {
                ...prev,
                [storageKey]: nextItems,
            }
        })
    }

    const addToCart = (product) => {
        const productId = Number(product.id)
        const currentProduct = products.find((p) => Number(p.id) === productId)

        if (currentProduct && currentProduct.status === 'DISCONTINUED') {
            alert('Sản phẩm đã ngừng kinh doanh, không thể thêm vào giỏ hàng.')
            return
        }

        const available = getProductAvailableStock(productId)
        if (available <= 0) {
            alert('Sản phẩm hiện đã hết hàng, không thể thêm vào giỏ hàng.')
            return
        }

        const existingItem = rawItems.find((item) => item.productId === productId)
        const currentQty = existingItem ? existingItem.quantity : 0

        if (currentQty + 1 > available) {
            alert(
                `Số lượng trong giỏ không thể vượt quá khả năng đáp ứng của kho (kho có tồn khả dụng cao nhất hiện có: ${available}). Quy định: Một đơn hàng chỉ lấy từ 1 kho.`
            )
            return
        }

        if (currentQty + 1 > MAX_QUANTITY_PER_PRODUCT) {
            alert(`Số lượng tối đa cho mỗi sản phẩm là ${MAX_QUANTITY_PER_PRODUCT}.`)
            return
        }

        updateRawItems((prev) => {
            const existing = prev.find((item) => item.productId === productId)
            if (existing) {
                return prev.map((item) =>
                    item.productId === productId
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                )
            }
            return [...prev, { productId, quantity: 1 }]
        })
    }

    const increaseQuantity = (productId) => {
        const targetId = Number(productId)
        const currentProduct = products.find((p) => Number(p.id) === targetId)

        if (currentProduct && currentProduct.status === 'DISCONTINUED') {
            alert('Sản phẩm đã ngừng kinh doanh, không thể tăng số lượng.')
            return
        }

        const available = getProductAvailableStock(targetId)
        if (available <= 0) {
            alert('Sản phẩm hiện đã hết hàng trong kho.')
            return
        }

        const existingItem = rawItems.find((item) => item.productId === targetId)
        const currentQty = existingItem ? existingItem.quantity : 0

        if (currentQty + 1 > available) {
            alert(
                `Số lượng trong giỏ không thể vượt quá khả năng đáp ứng của kho (kho có tồn khả dụng cao nhất hiện có: ${available}). Quy định: Một đơn hàng chỉ lấy từ 1 kho.`
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