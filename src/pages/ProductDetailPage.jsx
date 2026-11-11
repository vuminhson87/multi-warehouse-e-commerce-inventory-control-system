import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import './ProductDetailPage.css'
import { useCart } from '../context/CartContext'
import { loadProduct, loadProductAvailability } from '../services/productApi.js'
import { useWishlist } from '../context/WishlistContext'
import { formatPrice } from '../utils/format'
import LucideIcon from '../components/LucideIcon'
import ProductImage from '../components/ProductImage'

const MAX_QUANTITY_PER_PRODUCT = 100

function ProductDetailPage() {
    const { productId } = useParams()
    return <ProductDetailContent key={productId} productId={productId} />
}

function ProductDetailContent({ productId }) {
    const navigate = useNavigate()
    const { cartItems, addToCart } = useCart()
    const [detail, setDetail] = useState(null)
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()

    const [warehouseId, setWarehouseId] = useState('')
    const [requestedQuantity, setRequestedQuantity] = useState(1)

    useEffect(() => {
        const controller = new AbortController()
        Promise.all([
            loadProduct(productId, controller.signal),
            loadProductAvailability([productId], controller.signal),
        ])
            .then(([product, availability]) => {
                if (!controller.signal.aborted) setDetail({ product, availability })
            })
            .catch(error => {
                if (!controller.signal.aborted) setDetail({ error })
            })
        return () => controller.abort()
    }, [productId])

    if (!detail) return <p role="status">Đang tải sản phẩm…</p>
    if (detail.error && detail.error.status !== 404) {
        return <p role="alert">{detail.error.message}</p>
    }
    const product = detail.product

    if (!product || (product.status ?? 'ACTIVE') !== 'ACTIVE') {
        return (
            <main className="pd-page">
                <div className="pd-container pd-unavailable">
                    <h1>Sản phẩm không khả dụng</h1>
                    <p>Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.</p>
                    <Link to="/products" className="pd-btn pd-btn--primary">
                        Quay lại danh sách sản phẩm
                    </Link>
                </div>
            </main>
        )
    }

    const warehouseOptions = detail.availability.warehouses.map((warehouse) => {
        const row = detail.availability.items.find((item) =>
            Number(item.productId) === Number(product.id) && Number(item.warehouseId) === Number(warehouse.id)
        )
        return {
            ...warehouse,
            available: row?.available ?? 0,
        }
    })

    const defaultWarehouse = warehouseOptions.reduce(
        (best, option) => !best || option.available > best.available ? option : best,
        null
    )
    const selectedWarehouse = warehouseOptions.find(
        (warehouse) => String(warehouse.id) === warehouseId
    ) ?? defaultWarehouse

    const availableStock = selectedWarehouse?.available ?? 0
    const isInStock = availableStock > 0
    const liked = isWishlisted(product.id)
    const inCart = cartItems.find(
        (item) => Number(item.productId ?? item.id) === Number(product.id)
    )?.quantity ?? 0

    const maxCanAdd = Math.max(
        0,
        Math.min(availableStock, MAX_QUANTITY_PER_PRODUCT) - inCart
    )
    const quantity = Math.min(requestedQuantity, maxCanAdd)

    let stockLabel = 'Chưa có thông tin tồn kho'
    if (selectedWarehouse) {
        stockLabel = isInStock
            ? `Còn hàng tại ${selectedWarehouse.name} (${availableStock} sản phẩm)`
            : `Hết hàng tại ${selectedWarehouse.name}`
    }

    function handleWarehouseChange(event) {
        setWarehouseId(event.target.value)
        setRequestedQuantity(1)
    }

    function handleAddToCart() {
        if (quantity < 1) return

        const added = addToCart(product, quantity, { warehouseStock: availableStock })
        if (added) {
            showToast(`Đã thêm ${quantity} sản phẩm "${product.name}" vào giỏ hàng`)
            setRequestedQuantity(1)
        }
    }

    return (
        <main className="pd-page">
            <div className="pd-container">
                <button
                    type="button"
                    className="pd-back"
                    onClick={() => navigate(-1)}
                >
                    <LucideIcon name="arrow-left" size={18} />
                    Quay lại
                </button>

                <div className="pd-layout">
                    <div className="pd-media product-detail-image">
                        <ProductImage
                            imageUrl={product.imageUrl}
                            name={product.name}
                            loading="eager"
                        />
                    </div>

                    <div className="pd-info">
                        {product.category && (
                            <p className="pd-category">
                                {product.category} • Mã SP #{product.id}
                            </p>
                        )}

                        <h1>{product.name}</h1>
                        <p className="pd-price">{formatPrice(product.price)}</p>

                        <p
                            className={`pd-stock ${isInStock ? '' : 'is-out'}`}
                            role="status"
                        >
                            {stockLabel}
                        </p>

                        {product.description && (
                            <p className="pd-description">{product.description}</p>
                        )}

                        <div className="pd-warehouse-field">
                            <label htmlFor="pd-warehouse">Xem tồn theo kho</label>
                            <select
                                id="pd-warehouse"
                                value={selectedWarehouse ? String(selectedWarehouse.id) : ''}
                                onChange={handleWarehouseChange}
                                disabled={warehouseOptions.length === 0}
                                aria-describedby="pd-warehouse-note"
                            >
                                {warehouseOptions.length === 0 && <option value="">Chưa có kho</option>}
                                {warehouseOptions.map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name} — {warehouse.available > 0
                                            ? `Còn ${warehouse.available} sản phẩm`
                                            : 'Hết hàng'}
                                    </option>
                                ))}
                            </select>
                            <p id="pd-warehouse-note" className="pd-warehouse-note">
                                Hệ thống xác nhận kho xuất hàng khi đặt đơn.
                            </p>
                        </div>

                        <div className="pd-actions">
                            <div className="pd-quantity-field">
                                <span id="pd-quantity-label">Số lượng</span>
                                <div className="pd-stepper" role="group" aria-labelledby="pd-quantity-label">
                                    <button
                                        type="button"
                                        aria-label="Giảm số lượng"
                                        onClick={() => setRequestedQuantity(quantity - 1)}
                                        disabled={quantity <= 1}
                                    >
                                        <LucideIcon name="minus" size={16} />
                                    </button>
                                    <output aria-label="Số lượng muốn thêm">{quantity}</output>
                                    <button
                                        type="button"
                                        aria-label="Tăng số lượng"
                                        onClick={() => setRequestedQuantity(quantity + 1)}
                                        disabled={quantity >= maxCanAdd}
                                    >
                                        <LucideIcon name="plus" size={16} />
                                    </button>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="pd-btn pd-btn--primary pd-btn--grow"
                                onClick={handleAddToCart}
                                disabled={quantity < 1}
                            >
                                {isInStock ? 'Thêm vào giỏ hàng' : 'Tạm hết hàng'}
                            </button>

                            <button
                                type="button"
                                className={`pd-wish ${liked ? 'is-active' : ''}`}
                                onClick={() =>
                                    toggleWishlist(product.id, product.name)
                                }
                                aria-label={
                                    liked ? 'Bỏ khỏi mục đã thích' : 'Thêm vào mục đã thích'
                                }
                                aria-pressed={liked}
                            >
                                <LucideIcon
                                    name="heart"
                                    size={20}
                                    fill={liked ? '#111111' : 'none'}
                                />
                            </button>
                        </div>

                        {isInStock && maxCanAdd === 0 && (
                            <p className="pd-warehouse-note" role="status">
                                Số lượng trong giỏ đã đạt giới hạn tại kho đang xem.
                            </p>
                        )}

                        <Link to="/cart" className="pd-btn pd-btn--ghost">
                            Xem giỏ hàng
                        </Link>

                        <ul className="pd-service-badges" aria-label="Chính sách cửa hàng">
                            <li>
                                <LucideIcon name="package" size={20} />
                                <span>Giao hàng nhanh</span>
                            </li>
                            <li>
                                <LucideIcon name="shield" size={20} />
                                <span>Bảo hành 24 tháng</span>
                            </li>
                            <li>
                                <LucideIcon name="check" size={20} />
                                <span>Hoàn hàng trong 7 ngày</span>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default ProductDetailPage
