import { Link, useParams } from 'react-router-dom'
import products from '../data/products'
import './ProductDetailPage.css'
import { useCart } from '../context/CartContext'
import CustomerHeader from '../components/CustomerHeader'


function ProductDetailPage() {
    const { productId } = useParams()
    const { addToCart } = useCart()

    const product = products.find(
        (item) => item.id === Number(productId)
    )

    if (!product) {
        return (
            <div>
                <h1>Không tìm thấy sản phẩm</h1>
            </div>
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
                        Trạng thái: {product.inStock ? 'Còn hàng' : 'Hết hàng'}
                    </p>
                    <div className="product-detail-actions">
                        {product.inStock && (
                            <button
                                className="add-cart-button"
                                onClick={() => addToCart(product)}
                            >
                                Thêm vào giỏ hàng
                            </button>
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