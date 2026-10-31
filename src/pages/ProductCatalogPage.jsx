import './ProductCatalogPage.css'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import LucideIcon from '../components/LucideIcon'

function ProductCatalogPage() {
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const { cartItems, addToCart } = useCart()
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const searchKeyword = searchParams.get('search') || ''
    const selectedCategory = searchParams.get('category') || 'Tất cả'

    const activeProducts = products.filter(
        (product) => (product.status ?? 'ACTIVE') === 'ACTIVE'
    )

    const categories = [
        'Tất cả',
        ...new Set(activeProducts.map((product) => product.category)),
    ]

    const filteredProducts = activeProducts.filter((product) => {
        const matchesSearch = product.name
            .toLowerCase()
            .includes(searchKeyword.trim().toLowerCase())

        const matchesCategory =
            selectedCategory === 'Tất cả' ||
            product.category === selectedCategory

        return matchesSearch && matchesCategory
    })

    function handleQuickAddToCart(product, availableStock) {
        if (availableStock <= 0) {
            showToast(`"${product.name}" hiện đã hết hàng`)
            return
        }
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
        <div className="catalog-page">
            <div className="catalog-container sharp-frame">
                <div className="catalog-heading sharp-frame">
                    <span className="catalog-heading-label">
                        ATELIER OF MULTI-WAREHOUSE • BỘ SƯU TẬP
                    </span>

                    <h1>Khám phá sản phẩm</h1>

                    <p>
                        Tuyển chọn thiết bị công nghệ và phụ kiện chế tác tinh
                        xảo, phân phối trực tiếp từ hệ thống kho gần nhất.
                    </p>
                </div>

                <div className="catalog-toolbar sharp-frame">
                    <div className="category-filter">
                        {categories.map((category) => (
                            <Link
                                key={category}
                                className={
                                    selectedCategory === category ? 'active' : ''
                                }
                                to={
                                    category === 'Tất cả'
                                        ? '/products'
                                        : `/products?category=${encodeURIComponent(
                                              category
                                          )}`
                                }
                            >
                                {category}
                            </Link>
                        ))}
                    </div>

                    <form
                        className="catalog-search"
                        onSubmit={(e) => {
                            e.preventDefault()

                            const keyword =
                                e.currentTarget.elements.search.value.trim()
                            const params = new URLSearchParams(searchParams)

                            if (keyword) {
                                params.set('search', keyword)
                            } else {
                                params.delete('search')
                            }

                            const query = params.toString()
                            navigate(query ? `/products?${query}` : '/products')
                        }}
                    >
                        <input
                            type="search"
                            name="search"
                            key={searchKeyword}
                            defaultValue={searchKeyword}
                            placeholder="Tìm kiếm sản phẩm..."
                            aria-label="Tìm kiếm sản phẩm"
                            className="sharp-frame"
                        />

                        <button type="submit" aria-label="Tìm kiếm">
                            <LucideIcon name="search" size={16} />
                        </button>
                    </form>
                </div>

                <div className="product-list sharp-frame">
                    {filteredProducts.length === 0 && (
                        <p className="catalog-empty">
                            Không tìm thấy sản phẩm phù hợp.
                        </p>
                    )}

                    {filteredProducts.map((product) => {
                        const availableStock = getProductAvailableStock(
                            product.id
                        )
                        const isInStock = availableStock > 0
                        const visual = getProductVisual(product)
                        const liked = isWishlisted(product.id)

                        const aspectClass =
                            visual.aspect === 'portrait'
                                ? 'aspect-portrait'
                                : visual.aspect === 'square'
                                  ? 'aspect-square'
                                  : 'aspect-landscape'

                        const frameClass = visual.framed
                            ? 'product-art-frame is-framed'
                            : 'product-clean-item'

                        return (
                            <article
                                className="gallery-card sharp-frame"
                                key={product.id}
                            >
                                <div className="gallery-stage catalog-stage-box sharp-frame">
                                    <span
                                        className={`catalog-stock-badge sharp-frame ${
                                            isInStock
                                                ? 'in-stock'
                                                : 'out-of-stock'
                                        }`}
                                    >
                                        {isInStock
                                            ? `Còn hàng (${availableStock})`
                                            : 'Hết hàng'}
                                    </span>

                                    <Link
                                        to={`/products/${product.id}`}
                                        className={`catalog-art-wrapper ${aspectClass} ${frameClass} sharp-frame`}
                                    >
                                        <img
                                            src={visual.image}
                                            alt={product.name}
                                            className="sharp-frame"
                                        />
                                    </Link>

                                    <div className="catalog-card-actions">
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleQuickAddToCart(
                                                    product,
                                                    availableStock
                                                )
                                            }
                                            className="icon-btn catalog-icon-btn"
                                            title="Thêm nhanh vào giỏ hàng"
                                            aria-label={`Thêm ${product.name} vào giỏ hàng`}
                                        >
                                            <LucideIcon
                                                name="box"
                                                size={14}
                                                strokeWidth={1.75}
                                            />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                toggleWishlist(
                                                    product.id,
                                                    product.name
                                                )
                                            }
                                            className={`icon-btn catalog-icon-btn ${
                                                liked ? 'is-active' : ''
                                            }`}
                                            title="Thêm vào mục đã thích"
                                            aria-label={`Yêu thích ${product.name}`}
                                        >
                                            <LucideIcon
                                                name="heart"
                                                size={14}
                                                strokeWidth={1.75}
                                                fill={
                                                    liked ? '#18181b' : 'none'
                                                }
                                            />
                                        </button>
                                    </div>
                                </div>

                                <div className="catalog-card-info sharp-frame">
                                    <h2>
                                        <Link to={`/products/${product.id}`}>
                                            {product.name}
                                        </Link>
                                    </h2>

                                    <p className="catalog-card-cat">
                                        Danh mục: {product.category} •{' '}
                                        {visual.subtitle}
                                    </p>

                                    <p className="catalog-card-price">
                                        Từ{' '}
                                        {product.price.toLocaleString('vi-VN')}{' '}
                                        VNĐ
                                    </p>

                                    <Link
                                        to={`/products/${product.id}`}
                                        className="product-detail-button pill-btn"
                                    >
                                        Xem chi tiết →
                                    </Link>
                                </div>
                            </article>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default ProductCatalogPage
