import { Link } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useInventory } from '../context/InventoryContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import { formatPrice, handleImageError } from '../utils/format'
import LucideIcon from './LucideIcon'
import './ProductCard.css'

const MAX_QUANTITY_PER_PRODUCT = 100

// Thẻ sản phẩm dùng chung cho Trang chủ và Danh mục.
// Link chỉ bao ảnh/tên; nút "+" và tim là phần tử độc lập (không lồng button trong Link).
function ProductCard({ product }) {
    const { cartItems, addToCart } = useCart()
    const { getProductAvailableStock } = useInventory()
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()

    const visual = getProductVisual(product)
    const available = getProductAvailableStock(product.id)
    const isActive = (product.status ?? 'ACTIVE') === 'ACTIVE'
    const canAdd = isActive && available > 0
    const liked = isWishlisted(product.id)
    const detailPath = `/products/${product.id}`

    function handleQuickAdd() {
        if (!canAdd) return

        const inCart = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const nextQty = (inCart ? inCart.quantity : 0) + 1

        // addToCart tự kiểm tra tồn/giới hạn và báo lỗi nếu không hợp lệ.
        addToCart(product)

        if (nextQty <= available && nextQty <= MAX_QUANTITY_PER_PRODUCT) {
            showToast(`Đã thêm "${product.name}" vào giỏ hàng`)
        }
    }

    return (
        <article className="product-card">
            <div className="product-card__media">
                <Link
                    to={detailPath}
                    className="product-card__image-link"
                    tabIndex={-1}
                    aria-hidden="true"
                >
                    <img
                        src={visual.image}
                        alt=""
                        loading="lazy"
                        onError={handleImageError}
                    />
                </Link>

                <button
                    type="button"
                    className={`product-card__wish ${liked ? 'is-active' : ''}`}
                    onClick={() => toggleWishlist(product.id, product.name)}
                    aria-label={
                        liked
                            ? `Bỏ yêu thích ${product.name}`
                            : `Yêu thích ${product.name}`
                    }
                    aria-pressed={liked}
                >
                    <LucideIcon
                        name="heart"
                        size={16}
                        strokeWidth={1.75}
                        fill={liked ? '#111111' : 'none'}
                    />
                </button>

                {!canAdd && (
                    <span className="product-card__badge">
                        {isActive ? 'Hết hàng' : 'Ngừng bán'}
                    </span>
                )}
            </div>

            <div className="product-card__body">
                <h3 className="product-card__name" title={product.name}>
                    <Link to={detailPath}>{product.name}</Link>
                </h3>

                {product.category && (
                    <p className="product-card__category">{product.category}</p>
                )}

                <div className="product-card__footer">
                    <strong className="product-card__price">
                        {formatPrice(product.price)}
                    </strong>

                    <button
                        type="button"
                        className="product-card__add"
                        onClick={handleQuickAdd}
                        disabled={!canAdd}
                        aria-label={`Thêm ${product.name} vào giỏ hàng`}
                        title={canAdd ? 'Thêm vào giỏ hàng' : 'Hết hàng hoặc ngừng bán'}
                    >
                        <LucideIcon name="plus" size={18} strokeWidth={2} />
                    </button>
                </div>
            </div>
        </article>
    )
}

export default ProductCard

