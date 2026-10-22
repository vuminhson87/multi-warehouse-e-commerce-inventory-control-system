
import './ProductCatalogPage.css'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'

function ProductCatalogPage() {
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()

    const searchKeyword = searchParams.get('search') || ''
    const selectedCategory = searchParams.get('category') || 'Tất cả'

    const activeProducts = products.filter(
        (product) => product.status === 'ACTIVE'
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

    return (
        <>
            <div className="catalog-page">
                <div className="catalog-heading">
                    <span className="catalog-heading-label">
                        MULTI-WAREHOUSE STORE
                    </span>

                    <h1>Khám phá sản phẩm</h1>

                    <p>
                        Khám phá laptop và phụ kiện công nghệ
                        phù hợp với nhu cầu của bạn.
                    </p>
                </div>
                <div className="catalog-toolbar">
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
                                        : `/products?category=${encodeURIComponent(category)}`
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

                            const keyword = e.currentTarget.elements.search.value.trim()
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
                        />

                        <button type="submit" aria-label="Tìm kiếm">
                            <svg
                                width="20"
                                height="20"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                        </button>
                    </form>
                </div>
                <div className="product-list">
                    {filteredProducts.length === 0 && (
                        <p>Không tìm thấy sản phẩm phù hợp.</p>
                    )}

                    {filteredProducts.map((product) => {
                        const availableStock = getProductAvailableStock(product.id)
                        const isInStock = availableStock > 0

                        return (
                            <div className="product-card" key={product.id}>
                                <div className="product-card-image">
                                    <span>💻</span>
                                </div>

                                <h2>{product.name}</h2>

                                <p>Danh mục: {product.category}</p>

                                <p className="product-price">
                                    {product.price.toLocaleString('vi-VN')} VNĐ
                                </p>

                                <p className="product-stock">
                                    <span
                                        className={`stock-badge ${isInStock ? 'in-stock' : 'out-of-stock'}`}
                                    >
                                        {isInStock ? 'Còn hàng' : 'Hết hàng'}
                                    </span>
                                </p>

                                <Link
                                    to={`/products/${product.id}`}
                                    className="product-detail-button"
                                >
                                    Xem chi tiết →
                                </Link>
                            </div>
                        )
                    })}
                </div>
            </div >
        </>
    )
}

export default ProductCatalogPage
