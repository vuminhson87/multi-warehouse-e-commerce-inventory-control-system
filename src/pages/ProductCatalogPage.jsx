import products from '../data/products'
import './ProductCatalogPage.css'
import { Link, useSearchParams } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'

function ProductCatalogPage() {
    const [searchParams] = useSearchParams()
    const searchKeyword = searchParams.get('search') || ''
    const selectedCategory = searchParams.get('category') || 'Tất cả'

    const filteredProducts = products.filter((product) => {
        const matchesSearch = product.name
            .toLowerCase()
            .includes(searchKeyword.toLowerCase())

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
                    <Link
                        className={selectedCategory === 'Tất cả' ? 'active' : ''}
                        to="/products"
                    >
                        Tất cả
                    </Link>

                    <Link
                        className={selectedCategory === 'Laptop' ? 'active' : ''}
                        to="/products?category=Laptop"
                    >
                        Laptop
                    </Link>

                    <Link
                        className={selectedCategory === 'Phụ kiện' ? 'active' : ''}
                        to="/products?category=Phụ kiện"
                    >
                        Phụ kiện
                    </Link>
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