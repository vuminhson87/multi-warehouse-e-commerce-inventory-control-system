
import { Link, useParams } from 'react-router-dom'
import './ProductDetailPage.css'
import { useCart } from '../context/CartContext'
import { useProducts } from '../context/ProductContext'
import CustomerHeader from '../components/CustomerHeader'

function ProductDetailPage() {
    const { productId } = useParams()
    const { addToCart } = useCart()
    const { products } = useProducts()

    const product = products.find(
        (item) => String(item.id) === String(productId)
    )

    if (!product || product.status !== 'ACTIVE') {
        return (
            <>
                <CustomerHeader />

                <div className="product-detail-page">
                    <div className="product-detail-card">
                        <h1>Sản phẩm không khả dụng</h1>

                        <p>
                            Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.
                        </p>

                        <Link to="/products">
                            Quay lại danh sách sản phẩm
                        </Link>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <CustomerHeader />

            <div className="product-detail-page">
                <div className="product-detail-card">
                    <h1>{product.name}</h1>

                    <p>Danh mục: {product.category}</p>

                    <p>
                        Giá: {product.price.toLocaleString('vi-VN')} VNĐ
                    </p>

                    <p>{product.description}</p>

                    <p>
                        Trạng thái:{' '}
                        {product.inStock ? 'Còn hàng' : 'Hết hàng'}
                    </p>

                    <div className="product-detail-actions">
                        {product.inStock ? (
                            <button
                                className="add-cart-button"
                                onClick={() => addToCart(product)}
                            >
                                Thêm vào giỏ hàng
                            </button>
                        ) : (
                            <p>Sản phẩm hiện đã hết hàng.</p>
                        )}

                        <Link className="view-cart-link" to="/cart">
                            Xem giỏ hàng
                        </Link>
                    </div>
                </div>
            </div>
        </>
    )
}

export default ProductDetailPage
