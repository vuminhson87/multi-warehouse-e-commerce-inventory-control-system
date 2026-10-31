import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { buildHeroSlides, getProductVisual } from '../utils/productVisuals'
import LucideIcon from '../components/LucideIcon'
import './HomePage.css'

function HomePage() {
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const { cartItems, addToCart } = useCart()
    const { isWishlisted, toggleWishlist, showToast } = useWishlist()

    const activeProducts = useMemo(
        () =>
            products.filter(
                (product) => (product.status ?? 'ACTIVE') === 'ACTIVE'
            ),
        [products]
    )

    const heroSlides = useMemo(
        () => buildHeroSlides(activeProducts),
        [activeProducts]
    )

    const [currentSlideIndex, setCurrentSlideIndex] = useState(0)
    const [progressValue, setProgressValue] = useState(0)
    const [activeCategoryFilter, setActiveCategoryFilter] = useState('all')
    const [quickViewProduct, setQuickViewProduct] = useState(null)

    const safeSlideIndex =
        heroSlides.length > 0 ? currentSlideIndex % heroSlides.length : 0
    const currentSlide = heroSlides[safeSlideIndex] || heroSlides[0]

    // Tự động chuyển slide mỗi 5 giây (50ms * 100 bước = 5000ms)
    useEffect(() => {
        if (heroSlides.length <= 1) return undefined

        const timer = setInterval(() => {
            setProgressValue((prev) => {
                if (prev >= 100) {
                    setCurrentSlideIndex((idx) => (idx + 1) % heroSlides.length)
                    return 0
                }
                return prev + 1
            })
        }, 50)

        return () => clearInterval(timer)
    }, [heroSlides.length])

    function handleNextSlide() {
        setCurrentSlideIndex((idx) => (idx + 1) % heroSlides.length)
        setProgressValue(0)
    }

    function handlePrevSlide() {
        setCurrentSlideIndex(
            (idx) => (idx - 1 + heroSlides.length) % heroSlides.length
        )
        setProgressValue(0)
    }

    const categories = useMemo(
        () => [
            'all',
            ...new Set(activeProducts.map((p) => p.category).filter(Boolean)),
        ],
        [activeProducts]
    )

    const filteredProducts = useMemo(() => {
        if (activeCategoryFilter === 'all') return activeProducts
        return activeProducts.filter(
            (product) => product.category === activeCategoryFilter
        )
    }, [activeProducts, activeCategoryFilter])

    // Đảm bảo lấp đầy lưới 4 cột đẹp mắt giống bản thiết kế mẫu
    const newArrivalsList = useMemo(() => {
        if (filteredProducts.length === 0) return []
        const base = filteredProducts.slice(0, 4)
        return base
    }, [filteredProducts])

    const bestSellersList = useMemo(() => {
        if (filteredProducts.length === 0) return []
        const reversed = [...filteredProducts].reverse()
        return reversed.slice(0, 4)
    }, [filteredProducts])

    function handleQuickAddToCart(product) {
        const available = getProductAvailableStock(product.id)
        if (available <= 0) {
            showToast(`"${product.name}" hiện đã hết hàng tại các kho`)
            return
        }
        const existing = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const currentQty = existing ? existing.quantity : 0
        addToCart(product)
        if (currentQty + 1 <= available) {
            showToast(`Đã thêm "${product.name}" vào giỏ hàng`)
        }
    }

    function renderGalleryCard(product, sectionPrefix) {
        const visual = getProductVisual(product)
        const available = getProductAvailableStock(product.id)
        const inStock = available > 0
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
                key={`${sectionPrefix}-${product.id}`}
                className="gallery-card sharp-frame"
            >
                <div className="gallery-stage atelier-stage-box sharp-frame">
                    <span
                        className={`atelier-card-stock-tag sharp-frame ${
                            inStock ? '' : 'out-of-stock'
                        }`}
                    >
                        {inStock ? `Còn hàng (${available})` : 'Hết hàng'}
                    </span>

                    <div
                        onClick={() => setQuickViewProduct(product)}
                        className={`atelier-art-wrapper ${aspectClass} ${frameClass} sharp-frame`}
                        title="Nhấn để xem nhanh"
                    >
                        <img
                            src={visual.image}
                            alt={product.name}
                            className="sharp-frame"
                        />
                    </div>

                    {/* 2 Nút bấm chỉ có icon bo tròn ở góc dưới bên phải */}
                    <div className="atelier-card-actions">
                        <button
                            type="button"
                            onClick={() => handleQuickAddToCart(product)}
                            className="icon-btn atelier-card-icon-btn"
                            title="Thêm nhanh vào giỏ hàng"
                            aria-label={`Thêm ${product.name} vào giỏ hàng`}
                        >
                            <LucideIcon name="box" size={14} strokeWidth={1.75} />
                        </button>

                        <button
                            type="button"
                            onClick={() =>
                                toggleWishlist(product.id, product.name)
                            }
                            className={`icon-btn atelier-card-icon-btn ${
                                liked ? 'is-active' : ''
                            }`}
                            title="Thêm vào mục đã thích"
                            aria-label={`Yêu thích ${product.name}`}
                        >
                            <LucideIcon
                                name="heart"
                                size={14}
                                strokeWidth={1.75}
                                fill={liked ? '#18181b' : 'none'}
                            />
                        </button>
                    </div>
                </div>

                <div className="atelier-card-meta sharp-frame">
                    <h3 className="atelier-card-title">
                        <Link to={`/products/${product.id}`}>
                            {product.name}
                        </Link>
                    </h3>
                    <p className="atelier-card-subtitle">{visual.subtitle}</p>
                    <p className="atelier-card-price">
                        Từ {product.price.toLocaleString('vi-VN')} VNĐ
                    </p>
                </div>
            </article>
        )
    }

    const qvVisual = quickViewProduct
        ? getProductVisual(quickViewProduct)
        : null
    const qvAvailable = quickViewProduct
        ? getProductAvailableStock(quickViewProduct.id)
        : 0

    return (
        <main className="atelier-home">
            {/* ===================================================================== */}
            {/* 1. KHUNG TRÌNH CHIẾU SẢN PHẨM NỔI BẬT (TỰ ĐỘNG CHUYỂN MỖI 5 GIÂY)     */}
            {/* ===================================================================== */}
            <section className="atelier-hero-section sharp-frame">
                <div className="atelier-hero-topbar">
                    <div className="atelier-hero-status">
                        <span className="atelier-hero-status-tag">
                            TIÊU ĐIỂM
                        </span>
                        <span>•</span>
                        <span className="atelier-hero-status-text">
                            Tự động chuyển mỗi 5 giây
                        </span>
                    </div>

                    <div className="atelier-hero-modes">
                        {categories.map((cat) => (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => setActiveCategoryFilter(cat)}
                                className={`pill-btn atelier-mode-pill ${
                                    activeCategoryFilter === cat
                                        ? 'is-active'
                                        : ''
                                }`}
                            >
                                {cat === 'all' ? 'Tất cả bộ sưu tập' : cat}
                            </button>
                        ))}
                    </div>
                </div>

                {currentSlide && (
                    <div className="sharp-frame">
                        <div className="atelier-hero-grid sharp-frame">
                            {/* Khối Trình Bày Sản Phẩm Nổi Bật Trên Nền Trắng Sạch Sẽ */}
                            <div className="atelier-hero-left sharp-frame">
                                <div className="atelier-hero-product-stage">
                                    <span className="atelier-slide-tag">
                                        {currentSlide.tag}
                                    </span>
                                    <div className="atelier-slide-img-box sharp-frame">
                                        <img
                                            src={currentSlide.productImg}
                                            alt={currentSlide.subtitle}
                                        />
                                    </div>
                                </div>

                                <div className="atelier-hero-meta">
                                    <p className="atelier-slide-subtitle">
                                        {currentSlide.subtitle}
                                    </p>
                                    <h1 className="atelier-slide-title">
                                        {currentSlide.title}
                                    </h1>

                                    <div className="atelier-hero-controls">
                                        <Link
                                            to={`/products/${currentSlide.id}`}
                                            className="pill-btn atelier-explore-btn"
                                        >
                                            <span>Khám phá</span>
                                            <LucideIcon
                                                name="arrow-up-right"
                                                size={14}
                                            />
                                        </Link>

                                        <div className="atelier-slider-nav">
                                            <span className="atelier-slide-counter">
                                                {safeSlideIndex + 1} /{' '}
                                                {heroSlides.length}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handlePrevSlide}
                                                className="icon-btn atelier-slider-arrow"
                                                title="Slide trước"
                                                aria-label="Slide trước"
                                            >
                                                <LucideIcon
                                                    name="chevron-left"
                                                    size={16}
                                                />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleNextSlide}
                                                className="icon-btn atelier-slider-arrow"
                                                title="Slide tiếp theo"
                                                aria-label="Slide tiếp theo"
                                            >
                                                <LucideIcon
                                                    name="chevron-right"
                                                    size={16}
                                                />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Khối Hình Ảnh Bối Cảnh / Chiến Dịch Quảng Cáo Vuông Góc */}
                            <div className="atelier-hero-right sharp-frame">
                                <img
                                    src={currentSlide.lifestyleImg}
                                    alt={currentSlide.campaignHeadline}
                                    className="sharp-frame"
                                />

                                <div className="atelier-hero-overlay sharp-frame">
                                    <p className="atelier-campaign-cat">
                                        {currentSlide.campaignCategory}
                                    </p>
                                    <h2 className="atelier-campaign-headline">
                                        {currentSlide.campaignHeadline}
                                    </h2>
                                    <div>
                                        <Link
                                            to="/products"
                                            className="atelier-campaign-cta"
                                        >
                                            MUA NGAY BỘ SƯU TẬP
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Thanh thời gian chạy 5 giây (Mỏng 2px, vuông góc) */}
                        <div className="atelier-progress-track sharp-frame">
                            <div
                                className="progress-bar-fill"
                                style={{ width: `${progressValue}%` }}
                            />
                        </div>
                    </div>
                )}
            </section>

            {/* ===================================================================== */}
            {/* 2. KHU VỰC TRƯNG BÀY 1: HÀNG MỚI VỀ (NEW ARRIVALS)                    */}
            {/* ===================================================================== */}
            <section
                id="new-arrivals"
                className="atelier-showcase-section sharp-frame"
            >
                <div className="atelier-section-header">
                    <h2 className="atelier-section-title">
                        HÀNG MỚI VỀ (NEW ARRIVALS)
                    </h2>
                    <Link to="/products" className="atelier-section-link">
                        Xem toàn bộ bộ sưu tập
                    </Link>
                </div>

                <div className="atelier-gallery-grid sharp-frame">
                    {newArrivalsList.map((product) =>
                        renderGalleryCard(product, 'new')
                    )}
                </div>
            </section>

            {/* ===================================================================== */}
            {/* 3. KHU VỰC TRƯNG BÀY 2: BÁN CHẠY NHẤT (BEST SELLERS)                  */}
            {/* ===================================================================== */}
            <section
                id="best-sellers"
                className="atelier-showcase-section is-bottom sharp-frame"
            >
                <div className="atelier-section-header">
                    <h2 className="atelier-section-title">
                        BÁN CHẠY NHẤT (BEST SELLERS)
                    </h2>
                    <Link to="/products" className="atelier-section-link">
                        Xem toàn bộ bộ sưu tập
                    </Link>
                </div>

                <div className="atelier-gallery-grid sharp-frame">
                    {bestSellersList.map((product) =>
                        renderGalleryCard(product, 'best')
                    )}
                </div>
            </section>

            {/* ===================================================================== */}
            {/* CHÂN TRANG TỐI GIẢN NỀN TRẮNG                                         */}
            {/* ===================================================================== */}
            <footer className="atelier-footer sharp-frame">
                <div className="atelier-footer-inner">
                    <div>
                        <p className="atelier-footer-brand">
                            ATELIER OF MULTI-WAREHOUSE
                        </p>
                        <p style={{ margin: 0 }}>
                            Thiết kế tối giản • Nền trắng tinh khiết • Khung trưng
                            bày vuông góc • Đồng bộ tồn kho đa điểm
                        </p>
                    </div>
                    <div className="atelier-footer-links">
                        <a href="#new-arrivals">Hàng mới về</a>
                        <a href="#best-sellers">Bán chạy nhất</a>
                        <Link to="/products">Danh mục sản phẩm</Link>
                        <Link to="/cart">Giỏ hàng</Link>
                    </div>
                </div>
            </footer>

            {/* ===================================================================== */}
            {/* HỘP THOẠI XEM NHANH SẢN PHẨM (VUÔNG GÓC 100%, NỀN PHÍA SAU MỜ XÁM)    */}
            {/* ===================================================================== */}
            {quickViewProduct && qvVisual && (
                <div
                    className="atelier-qv-overlay"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) {
                            setQuickViewProduct(null)
                        }
                    }}
                >
                    <div
                        className="atelier-qv-modal sharp-frame"
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className="atelier-qv-stage sharp-frame">
                            <img
                                src={qvVisual.image}
                                alt={quickViewProduct.name}
                                className="product-art-frame sharp-frame"
                            />
                        </div>
                        <div className="atelier-qv-body sharp-frame">
                            <div>
                                <div className="atelier-qv-top">
                                    <span className="atelier-qv-cat">
                                        {quickViewProduct.category} • TỒN KHO KHẢ
                                        DỤNG: {qvAvailable}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setQuickViewProduct(null)}
                                        className="icon-btn"
                                        style={{ width: 32, height: 32 }}
                                        aria-label="Đóng xem nhanh"
                                    >
                                        <LucideIcon name="x" size={16} />
                                    </button>
                                </div>
                                <h3 className="atelier-qv-title">
                                    {quickViewProduct.name}
                                </h3>
                                <p className="atelier-qv-sub">
                                    {qvVisual.subtitle}
                                </p>
                                <p className="atelier-qv-price">
                                    {quickViewProduct.price.toLocaleString(
                                        'vi-VN'
                                    )}{' '}
                                    VNĐ
                                </p>
                                <p className="atelier-qv-desc">
                                    {quickViewProduct.description ||
                                        'Sản phẩm chính hãng được tuyển chọn kỹ lưỡng, phân phối trực tiếp từ hệ thống kho gần nhất với độ hoàn thiện cao cấp.'}
                                </p>
                            </div>

                            <div className="atelier-qv-actions">
                                <button
                                    type="button"
                                    disabled={qvAvailable <= 0}
                                    onClick={() => {
                                        handleQuickAddToCart(quickViewProduct)
                                        setQuickViewProduct(null)
                                    }}
                                    className="pill-btn atelier-qv-add-btn"
                                >
                                    {qvAvailable > 0
                                        ? 'Thêm vào giỏ hàng'
                                        : 'Tạm hết hàng'}
                                </button>
                                <Link
                                    to={`/products/${quickViewProduct.id}`}
                                    onClick={() => setQuickViewProduct(null)}
                                    className="pill-btn atelier-qv-detail-link"
                                >
                                    Chi tiết
                                </Link>
                                <button
                                    type="button"
                                    onClick={() =>
                                        toggleWishlist(
                                            quickViewProduct.id,
                                            quickViewProduct.name
                                        )
                                    }
                                    className={`icon-btn ${
                                        isWishlisted(quickViewProduct.id)
                                            ? 'is-active'
                                            : ''
                                    }`}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        border: '1px solid #e4e4e7',
                                    }}
                                    aria-label="Yêu thích"
                                >
                                    <LucideIcon
                                        name="heart"
                                        size={16}
                                        fill={
                                            isWishlisted(quickViewProduct.id)
                                                ? '#18181b'
                                                : 'none'
                                        }
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </main>
    )
}

export default HomePage
