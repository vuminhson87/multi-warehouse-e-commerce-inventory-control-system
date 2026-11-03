import { Link, useNavigate, useParams } from 'react-router-dom'
import './ProductDetailPage.css'
import { useCart } from '../context/CartContext'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import { formatPrice, handleImageError } from '../utils/format'
import LucideIcon from '../components/LucideIcon'

const MAX_QUANTITY_PER_PRODUCT = 100

function ProductDetailPage() {
    const { productId } = useParams()
    const navigate = useNavigate()
    const { cartItems, addToCart } = useCart()
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()

    const product = products.find(
        (item) => String(item.id) === String(productId)
    )

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

    const visual = getProductVisual(product)
    const availableStock = getProductAvailableStock(product.id)
    const isInStock = availableStock > 0
    const liked = isWishlisted(product.id)

    function handleAddToCart() {
        const existing = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const nextQty = (existing ? existing.quantity : 0) + 1
        addToCart(product)
        if (nextQty <= availableStock && nextQty <= MAX_QUANTITY_PER_PRODUCT) {
            showToast(`Đã thêm "${product.name}" vào giỏ hàng`)
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
                    <div className="pd-media">
                        <img
                            src={visual.image}
                            alt={product.name}
                            onError={handleImageError}
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
                            {isInStock
                                ? `Còn hàng (${availableStock} sản phẩm khả dụng tại một kho)`
                                : 'Hết hàng'}
                        </p>

                        {product.description && (
                            <p className="pd-description">{product.description}</p>
                        )}

                        <div className="pd-actions">
                            <button
                                type="button"
                                className="pd-btn pd-btn--primary pd-btn--grow"
                                onClick={handleAddToCart}
                                disabled={!isInStock}
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

                        <Link to="/cart" className="pd-btn pd-btn--ghost">
                            Xem giỏ hàng
                        </Link>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default ProductDetailPage
