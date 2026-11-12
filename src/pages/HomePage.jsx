import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { loadPublicFeaturedSlides } from '../services/featuredProductsApi'
import { getProductVisual } from '../utils/productVisuals'
import ProductCard from '../components/ProductCard'
import ProductImage from '../components/ProductImage'
import LucideIcon from '../components/LucideIcon'
import './HomePage.css'

const FEATURED_COUNT = 4
const EXPLORE_COUNT = 4
const TICK_MS = 100
const TICK_STEP = 2 // 100ms * 50 nhịp = 5 giây mỗi slide
const FALLBACK_HERO_COUNT = 5
const HERO_START = { index: 0, progress: 0 }

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
    const [apiSlides, setApiSlides] = useState(null)

    const activeProducts = useMemo(
        () => products.filter((product) => (product.status ?? 'ACTIVE') === 'ACTIVE'),
        [products]
    )

    const fallbackSlides = useMemo(
        () => activeProducts.slice(0, FALLBACK_HERO_COUNT).map((product) => ({
            productId: product.id,
            name: product.name,
            category: product.category,
            description: product.description,
            imageUrl: product.imageUrl,
        })),
        [activeProducts]
    )

    const heroSlides = apiSlides ?? fallbackSlides

    useEffect(() => {
        const controller = new AbortController()

        async function loadSlides() {
            try {
                const data = await loadPublicFeaturedSlides({ signal: controller.signal })

                if (controller.signal.aborted) return

                const validSlides = Array.isArray(data?.slides) && data.slides.every(
                    (item) => Number.isSafeInteger(item?.productId)
                        && item.productId > 0
                        && typeof item.name === 'string'
                )

                if (!validSlides) {
                    throw new Error('API sản phẩm nổi bật trả dữ liệu không hợp lệ.')
                }

                setApiSlides(data.slides)
            } catch (error) {
                if (!controller.signal.aborted && import.meta.env.DEV) {
                    console.warn('Không tải được slide nổi bật từ API.', error)
                }
            }
        }

        void loadSlides()
        return () => controller.abort()
    }, [])

    const [slideState, setSlideState] = useState(HERO_START)
    const [prevHeroSlides, setPrevHeroSlides] = useState(heroSlides)
    const [paused, setPaused] = useState(false)

    if (prevHeroSlides !== heroSlides) {
        setPrevHeroSlides(heroSlides)
        setSlideState(HERO_START)
    }

    const slideCount = heroSlides.length
    const activeIndex = slideCount > 0 ? slideState.index % slideCount : 0
    const slide = heroSlides[activeIndex]

    useEffect(() => {
        if (slideCount <= 1 || paused) return undefined

        const timer = setInterval(() => {
            setSlideState((previous) => {
                const nextProgress = previous.progress + TICK_STEP

                if (nextProgress >= 100) {
                    return {
                        index: (previous.index + 1) % slideCount,
                        progress: 0,
                    }
                }

                return {
                    ...previous,
                    progress: nextProgress,
                }
            })
        }, TICK_MS)

        return () => clearInterval(timer)
    }, [slideCount, paused])

    function goTo(index) {
        setSlideState({ index, progress: 0 })
    }

    function goRelative(delta) {
        if (slideCount <= 1) return
        setSlideState((previous) => ({
            index: (previous.index + delta + slideCount) % slideCount,
            progress: 0,
        }))
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
                        <div className="home-hero__slide" key={slide.productId}>
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
                                    to={`/products/${slide.productId}`}
                                    className="home-hero__cta"
                                >
                                    Mua ngay
                                    <LucideIcon name="arrow-right" size={16} />
                                </Link>
                            </div>
                            <div className="home-hero__media home-product-image">
                                <ProductImage
                                    imageUrl={
                                        slide.imageUrl ||
                                        getProductVisual({
                                            name: slide.name,
                                            category: slide.category,
                                        }).image
                                    }
                                    name={slide.name}
                                    loading="eager"
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
                                    Khám phá sản phẩm
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
                                    {heroSlides.map((item, index) => (
                                        <button
                                            key={item.productId}
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
                                                              ? `${slideState.progress}%`
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
