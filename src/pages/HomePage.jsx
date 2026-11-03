import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { getProductVisual } from '../utils/productVisuals'
import { handleImageError } from '../utils/format'
import ProductCard from '../components/ProductCard'
import LucideIcon from '../components/LucideIcon'
import './HomePage.css'

const MAX_HERO_SLIDES = 5
const FEATURED_COUNT = 4
const EXPLORE_COUNT = 4
const TICK_MS = 100
const TICK_STEP = 2 // 100ms * 50 nhịp = 5 giây mỗi slide

function usePrefersReducedMotion() {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== 'undefined' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches
    )

    useEffect(() => {
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        const onChange = (event) => setReduced(event.matches)
        query.addEventListener('change', onChange)
        return () => query.removeEventListener('change', onChange)
    }, [])

    return reduced
}

function SectionHeader({ title }) {
    return (
        <div className="home-section__header">
            <h2>{title}</h2>
            <Link to="/products" className="home-section__link">
                Xem tất cả
                <LucideIcon name="arrow-right" size={16} />
            </Link>
        </div>
    )
}

function HomePage() {
    const { products } = useProducts()

    const activeProducts = useMemo(
        () => products.filter((p) => (p.status ?? 'ACTIVE') === 'ACTIVE'),
        [products]
    )

    const slides = useMemo(
        () =>
            activeProducts.slice(0, MAX_HERO_SLIDES).map((product) => ({
                id: product.id,
                name: product.name,
                category: product.category,
                description: product.description,
                image: getProductVisual(product).image,
            })),
        [activeProducts]
    )

    const [slideState, setSlideState] = useState({ index: 0, progress: 0 })
    const [paused, setPaused] = useState(false)
    const reducedMotion = usePrefersReducedMotion()

    const slideCount = slides.length
    const activeIndex = slideCount > 0 ? slideState.index % slideCount : 0
    const slide = slides[activeIndex]

    // Chỉ tự chạy khi có >= 2 slide, không bị tạm dừng và không bật giảm chuyển động.
    useEffect(() => {
        if (slideCount <= 1 || paused || reducedMotion) return undefined

        const timer = setInterval(() => {
            setSlideState((state) =>
                state.progress >= 100
                    ? { index: (state.index + 1) % slideCount, progress: 0 }
                    : { ...state, progress: state.progress + TICK_STEP }
            )
        }, TICK_MS)

        return () => clearInterval(timer)
    }, [slideCount, paused, reducedMotion])

    function goTo(index) {
        setSlideState({ index, progress: 0 })
    }

    function goRelative(delta) {
        if (slideCount === 0) return
        goTo((activeIndex + delta + slideCount) % slideCount)
    }

    const featured = activeProducts.slice(0, FEATURED_COUNT)
    const explore = activeProducts.slice(
        FEATURED_COUNT,
        FEATURED_COUNT + EXPLORE_COUNT
    )

    return (
        <main className="home-page">
            <div className="home-container">
                {/* HERO */}
                <section
                    className="home-hero"
                    aria-roledescription="carousel"
                    aria-label="Sản phẩm nổi bật"
                    onMouseEnter={() => setPaused(true)}
                    onMouseLeave={() => setPaused(false)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                >
                    {slide ? (
                        <div className="home-hero__slide" key={slide.id}>
                            <div className="home-hero__copy">
                                {slide.category && (
                                    <p className="home-hero__eyebrow">
                                        {slide.category}
                                    </p>
                                )}
                                <h1 className="home-hero__title">{slide.name}</h1>
                                {slide.description && (
                                    <p className="home-hero__sub">
                                        {slide.description}
                                    </p>
                                )}
                                <Link
                                    to={`/products/${slide.id}`}
                                    className="home-hero__cta"
                                >
                                    Mua ngay
                                    <LucideIcon name="arrow-right" size={16} />
                                </Link>
                            </div>
                            <div className="home-hero__media">
                                <img
                                    src={slide.image}
                                    alt={slide.name}
                                    onError={handleImageError}
                                />
                            </div>
                        </div>
                    ) : (
                        <div className="home-hero__slide">
                            <div className="home-hero__copy">
                                <p className="home-hero__eyebrow">Cửa hàng</p>
                                <h1 className="home-hero__title">
                                    Chào mừng bạn đến với cửa hàng
                                </h1>
                                <p className="home-hero__sub">
                                    Sản phẩm sẽ xuất hiện tại đây khi được thêm vào hệ thống.
                                </p>
                                <Link to="/products" className="home-hero__cta">
                                    Xem sản phẩm
                                    <LucideIcon name="arrow-right" size={16} />
                                </Link>
                            </div>
                        </div>
                    )}

                    {slideCount > 1 && (
                        <>
                            <button
                                type="button"
                                className="home-hero__arrow is-prev"
                                onClick={() => goRelative(-1)}
                                aria-label="Slide trước"
                            >
                                <LucideIcon name="chevron-left" size={18} />
                            </button>
                            <button
                                type="button"
                                className="home-hero__arrow is-next"
                                onClick={() => goRelative(1)}
                                aria-label="Slide tiếp theo"
                            >
                                <LucideIcon name="chevron-right" size={18} />
                            </button>

                            <div className="home-hero__pager">
                                <span className="home-hero__counter">
                                    {activeIndex + 1} / {slideCount}
                                </span>
                                <div className="home-hero__bars">
                                    {slides.map((item, index) => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className="home-hero__bar"
                                            onClick={() => goTo(index)}
                                            aria-label={`Chuyển đến slide ${index + 1}`}
                                            aria-current={index === activeIndex}
                                        >
                                            <span
                                                style={{
                                                    width:
                                                        index < activeIndex
                                                            ? '100%'
                                                            : index === activeIndex
                                                              ? `${reducedMotion ? 100 : slideState.progress}%`
                                                              : '0%',
                                                }}
                                            />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </section>

                {/* SẢN PHẨM NỔI BẬT */}
                <section className="home-section" id="featured">
                    <SectionHeader title="Sản phẩm nổi bật" />
                    <div className="product-grid">
                        {featured.length === 0 ? (
                            <div className="store-empty">
                                <strong>Chưa có sản phẩm</strong>
                                Hiện chưa có sản phẩm nào đang kinh doanh.
                            </div>
                        ) : (
                            featured.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))
                        )}
                    </div>
                </section>

                {/* KHÁM PHÁ THÊM (chỉ hiện khi còn sản phẩm khác) */}
                {explore.length > 0 && (
                    <section className="home-section" id="explore">
                        <SectionHeader title="Khám phá thêm" />
                        <div className="product-grid">
                            {explore.map((product) => (
                                <ProductCard key={product.id} product={product} />
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <footer className="home-footer">
                <div className="home-container home-footer__inner">
                    <p className="home-footer__brand">Multi-Warehouse</p>
                    <nav className="home-footer__links" aria-label="Liên kết nhanh">
                        <Link to="/products">Sản phẩm</Link>
                        <Link to="/cart">Giỏ hàng</Link>
                        <Link to="/orders">Đơn hàng</Link>
                    </nav>
                </div>
            </footer>
        </main>
    )
}

export default HomePage
