
import './ProductCatalogPage.css'
import { Link, useSearchParams } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'
import { useProducts } from '../context/ProductContext'

function ProductCatalogPage() {
    const { products } = useProducts()
    const [searchParams] = useSearchParams()

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
            <CustomerHeader />

            <div className="catalog-page">
                <h1>Product Catalog</h1>

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

                <p>Danh sách sản phẩm đang được bán.</p>

                <div className="product-list">
                    {filteredProducts.length === 0 && (
                        <p>Không tìm thấy sản phẩm phù hợp.</p>
                    )}

                    {filteredProducts.map((product) => (
                        <div className="product-card" key={product.id}>
                            <h2>{product.name}</h2>

                            <p>Danh mục: {product.category}</p>

                            <p>
                                Giá: {product.price.toLocaleString('vi-VN')} VNĐ
                            </p>

                            <p>
                                Trạng thái:{' '}
                                {product.inStock ? 'Còn hàng' : 'Hết hàng'}
                            </p>

                            <Link to={`/products/${product.id}`}>
                                Xem chi tiết
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </>
    )
}

export default ProductCatalogPage
