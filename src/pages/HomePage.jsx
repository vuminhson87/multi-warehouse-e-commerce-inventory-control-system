import { Link } from 'react-router-dom'
import CustomerHeader from '../components/CustomerHeader'
import './HomePage.css'
import { useProducts } from '../context/ProductContext'

function HomePage() {
    const { products } = useProducts()

    const featuredProducts = products
        .filter((product) => product.status === 'ACTIVE')
        .slice(0, 4)
    return (
        <>
            <CustomerHeader />

            <main className="home-page">
                <section className="home-hero">
                    <div className="home-hero-content">
                        <span className="home-hero-label">
                            MULTI-WAREHOUSE STORE
                        </span>

                        <h1>Công nghệ cho cuộc sống hiện đại</h1>

                        <p>
                            Khám phá laptop và phụ kiện chính hãng,
                            mua sắm tiện lợi với hệ thống quản lý tồn kho thông minh.
                        </p>

                        <Link to="/products" className="home-hero-button">
                            Khám phá sản phẩm →
                        </Link>
                    </div>

                    <div className="home-hero-visual">
                        <img
                            src="/images/hero-laptop.png"
                            alt="Laptop công nghệ hiện đại"
                        />
                    </div>
                </section>
                <section className="home-featured">
                    <div className="home-section-heading">
                        <h2>Sản phẩm nổi bật</h2>
                        <Link to="/products">Xem tất cả →</Link>
                    </div>

                    <div className="home-featured-grid">
                        {featuredProducts.map((product) => (
                            <Link
                                key={product.id}
                                to={`/products/${product.id}`}
                                className="home-product-card"
                            >
                                <div className="home-product-image">
                                    <span>💻</span>
                                </div>

                                <div className="home-product-info">
                                    <span className="home-product-category">
                                        {product.category}
                                    </span>

                                    <h3>{product.name}</h3>

                                    <p className="home-product-price">
                                        {Number(product.price).toLocaleString('vi-VN')} VNĐ
                                    </p>

                                    <span className="home-product-link">
                                        Xem chi tiết →
                                    </span>
                                </div>
                            </Link>
                        ))}
                    </div>
                </section>
            </main>
        </>
    )
}

export default HomePage