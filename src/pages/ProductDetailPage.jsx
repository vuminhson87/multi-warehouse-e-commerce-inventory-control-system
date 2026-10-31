import { Link, useParams } from 'react-router-dom'
import './ProductDetailPage.css'
import { useCart } from '../context/CartContext'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import LucideIcon from '../components/LucideIcon'

function ProductDetailPage() {
    const { productId } = useParams()
    const { cartItems, addToCart } = useCart()
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()

    const product = products.find(
        (item) => String(item.id) === String(productId)
    )

    if (!product || (product.status ?? 'ACTIVE') !== 'ACTIVE') {
        return (
            <div className="product-detail-page">
                <div
                    className="product-detail-card sharp-frame"
                    style={{ gridTemplateColumns: '1fr', padding: 40 }}
                >
                    <div>
                        <h1>Sản phẩm không khả dụng</h1>
                        <p style={{ color: '#71717a', marginBottom: 24 }}>
                            Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.
                        </p>
                        <Link
                            to="/products"
                            className="view-cart-link pill-btn"
                        >
                            Quay lại danh sách sản phẩm
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    const visual = getProductVisual(product)
    const availableStock = getProductAvailableStock(product.id)
    const isInStock = availableStock > 0
    const liked = isWishlisted(product.id)

    function handleAddToCart() {
        const existing = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const currentQty = existing ? existing.quantity : 0
        addToCart(product)
        if (currentQty + 1 <= availableStock) {
            showToast(`Đã thêm "${product.name}" vào giỏ hàng`)
        }
    }

    return (
        <div className="product-detail-page">
            <div className="product-detail-card sharp-frame">
                <div className="product-detail-image gallery-stage sharp-frame">
                    <img
                        src={visual.image}
                        alt={product.name}
                        className={
                            visual.framed
                                ? 'product-art-frame sharp-frame'
                                : 'product-clean-item sharp-frame'
                        }
                    />
                </div>

                <div className="product-detail-info sharp-frame">
                    <div>
                        <span className="product-detail-category">
                            {product.category} • MÃ SP #{product.id}
                        </span>

                        <h1>{product.name}</h1>

                        <p className="product-detail-subtitle">
                            {visual.subtitle}
                        </p>

                        <p className="product-detail-price">
                            {product.price.toLocaleString('vi-VN')} VNĐ
                        </p>

                        <p className="product-detail-description">
                            {product.description}
                        </p>

                        <p
                            className={`product-detail-stock sharp-frame ${
                                isInStock ? '' : 'out-of-stock'
                            }`}
                        >
                            {isInStock
                                ? `Còn hàng (${availableStock} sản phẩm khả dụng tại kho)`
                                : 'Hết hàng'}
                        </p>
                    </div>

                    <div className="product-detail-actions">
                        {isInStock ? (
                            <button
                                type="button"
                                className="add-cart-button pill-btn"
                                onClick={handleAddToCart}
                            >
                                Thêm vào giỏ hàng
                            </button>
                        ) : (
                            <p style={{ margin: 0, fontSize: 13, color: '#991b1b' }}>
                                Sản phẩm hiện đã hết hàng.
                            </p>
                        )}

                        <Link className="view-cart-link pill-btn" to="/cart">
                            Xem giỏ hàng
                        </Link>

                        <button
                            type="button"
                            onClick={() =>
                                toggleWishlist(product.id, product.name)
                            }
                            className={`icon-btn ${liked ? 'is-active' : ''}`}
                            style={{
                                width: 44,
                                height: 44,
                                border: '1px solid #d4d4d8',
                            }}
                            title="Thêm vào mục đã thích"
                            aria-label="Thêm vào mục đã thích"
                        >
                            <LucideIcon
                                name="heart"
                                size={18}
                                fill={liked ? '#18181b' : 'none'}
                            />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ProductDetailPage
