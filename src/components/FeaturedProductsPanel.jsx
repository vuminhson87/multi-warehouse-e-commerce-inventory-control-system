import { useEffect, useMemo, useState } from 'react'
import { useProducts } from '../context/ProductContext'
import {
    loadAdminFeaturedSlides,
    saveAdminFeaturedSlides,
} from '../services/featuredProductsApi'
import LucideIcon from './LucideIcon'
import { handleImageError } from '../utils/format'
import './FeaturedProductsPanel.css'

const MAX_SLIDES = 5

function SlidePreviewCard({ slide }) {
    const [failedUrl, setFailedUrl] = useState(null)
    const effectiveImage = slide.imageUrlOverride?.trim() || slide.product?.imageUrl
    const effectiveDesc =
        slide.descriptionOverride?.trim() || slide.product?.description || ''

    const isImgFailed = failedUrl === effectiveImage

    return (
        <div className="featured-panel__preview-card">
            <div className="featured-panel__preview-media">
                {effectiveImage && !isImgFailed ? (
                    <img
                        src={effectiveImage}
                        alt={slide.product?.name || 'Xem trước'}
                        onError={() => setFailedUrl(effectiveImage)}
                    />
                ) : (
                    <span className="featured-panel__preview-placeholder" aria-hidden="true">
                        💻
                    </span>
                )}
            </div>
            {slide.product?.category && (
                <span className="featured-panel__preview-eyebrow">
                    {slide.product.category}
                </span>
            )}
            <div className="featured-panel__preview-title">
                {slide.product?.name || 'Tên sản phẩm'}
            </div>
            {effectiveDesc && (
                <div className="featured-panel__preview-desc">{effectiveDesc}</div>
            )}
            <div className="featured-panel__preview-cta">
                Mua ngay <LucideIcon name="arrow-right" size={13} />
            </div>
        </div>
    )
}

export default function FeaturedProductsPanel() {
    const { products } = useProducts()

    const [isOpen, setIsOpen] = useState(false)
    const [hasLoaded, setHasLoaded] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [savedSlides, setSavedSlides] = useState([])
    const [draftSlides, setDraftSlides] = useState([])
    const [error, setError] = useState('')
    const [notice, setNotice] = useState('')
    const [searchQuery, setSearchQuery] = useState('')
    const [swappingIndex, setSwappingIndex] = useState(null)
    const [reloadTrigger, setReloadTrigger] = useState(0)

    useEffect(() => {
        const controller = new AbortController()

        async function loadSlides() {
            try {
                const data = await loadAdminFeaturedSlides({ signal: controller.signal })
                const loaded = Array.isArray(data?.slides) ? data.slides : []
                if (!controller.signal.aborted) {
                    setSavedSlides(loaded)
                    setDraftSlides(loaded)
                    setHasLoaded(true)
                    setError('')
                }
            } catch (err) {
                if (!controller.signal.aborted) {
                    setError(err?.message || 'Không thể tải cấu hình sản phẩm nổi bật.')
                }
            } finally {
                if (!controller.signal.aborted) {
                    setIsLoading(false)
                }
            }
        }

        void loadSlides()
        return () => controller.abort()
    }, [reloadTrigger])

    // Danh sách sản phẩm kinh doanh khả dụng để thêm mới hoặc đổi
    const selectedProductIds = useMemo(
        () => new Set(draftSlides.map((s) => s.productId)),
        [draftSlides]
    )

    const availableProducts = useMemo(
        () =>
            products.filter(
                (p) =>
                    (p.status ?? 'ACTIVE') === 'ACTIVE' &&
                    !selectedProductIds.has(p.id)
            ),
        [products, selectedProductIds]
    )

    const searchResults = useMemo(() => {
        const query = searchQuery.trim().toLowerCase()
        if (!query) return availableProducts.slice(0, 6)
        return availableProducts
            .filter(
                (p) =>
                    String(p.name ?? '').toLowerCase().includes(query) ||
                    String(p.sku ?? '').toLowerCase().includes(query)
            )
            .slice(0, 10)
    }, [availableProducts, searchQuery])

    function handleOpen() {
        setDraftSlides(savedSlides)
        setError('')
        setNotice('')
        setSearchQuery('')
        setSwappingIndex(null)
        setIsOpen(true)
    }

    function handleCancel() {
        setDraftSlides(savedSlides)
        setError('')
        setNotice('')
        setSearchQuery('')
        setSwappingIndex(null)
        setIsOpen(false)
    }

    function moveSlide(index, delta) {
        const target = index + delta
        if (target < 0 || target >= draftSlides.length) return
        const next = [...draftSlides]
        const temp = next[index]
        next[index] = next[target]
        next[target] = temp
        setDraftSlides(next)
    }

    function removeSlide(index) {
        setDraftSlides((prev) => prev.filter((_, i) => i !== index))
    }

    function updateSlideField(index, field, value) {
        setDraftSlides((prev) => {
            const next = [...prev]
            next[index] = { ...next[index], [field]: value }
            return next
        })
    }

    function addSlide(product) {
        if (draftSlides.length >= MAX_SLIDES) return
        if (draftSlides.some((s) => s.productId === product.id)) return

        setDraftSlides((prev) => [
            ...prev,
            {
                productId: product.id,
                position: prev.length + 1,
                imageUrlOverride: null,
                descriptionOverride: null,
                product: {
                    id: product.id,
                    sku: product.sku || `SKU-${product.id}`,
                    name: product.name,
                    category: product.category,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    isActive: (product.status ?? 'ACTIVE') === 'ACTIVE',
                },
            },
        ])
        setSearchQuery('')
    }

    // Thay một vị trí bằng sản phẩm khác (xóa override cũ)
    function replaceSlideProduct(index, product) {
        setDraftSlides((prev) => {
            const next = [...prev]
            next[index] = {
                productId: product.id,
                position: index + 1,
                imageUrlOverride: null,
                descriptionOverride: null,
                product: {
                    id: product.id,
                    sku: product.sku || `SKU-${product.id}`,
                    name: product.name,
                    category: product.category,
                    description: product.description,
                    imageUrl: product.imageUrl,
                    isActive: (product.status ?? 'ACTIVE') === 'ACTIVE',
                },
            }
            return next
        })
        setSwappingIndex(null)
    }

    async function handleSave(event) {
        event.preventDefault()
        if (!hasLoaded || isLoading || isSaving) return

        setIsSaving(true)
        setError('')
        setNotice('')

        try {
            const { slides } = await saveAdminFeaturedSlides({
                slides: draftSlides.map(
                    ({ productId, imageUrlOverride, descriptionOverride }) => ({
                        productId,
                        imageUrlOverride: imageUrlOverride?.trim() || null,
                        descriptionOverride: descriptionOverride?.trim() || null,
                    })
                ),
            })

            setSavedSlides(slides)
            setDraftSlides(slides)
            setNotice('Đã lưu sản phẩm nổi bật trên Trang chủ.')
        } catch (err) {
            setError(err?.message || 'Không thể lưu. Vui lòng thử lại.')
        } finally {
            setIsSaving(false)
        }
    }

    const savedCount = savedSlides.length
    const draftCount = draftSlides.length

    return (
        <section className="featured-panel">
            <div className="featured-panel__header">
                <div className="featured-panel__title-wrap">
                    <h2 className="featured-panel__title">
                        <LucideIcon name="sparkles" size={20} />
                        Sản phẩm nổi bật trên Trang chủ
                    </h2>
                    <span
                        className={`featured-panel__badge ${
                            (isOpen ? draftCount : savedCount) >= MAX_SLIDES
                                ? 'featured-panel__badge--full'
                                : ''
                        }`}
                    >
                        {isOpen ? `${draftCount}/${MAX_SLIDES} vị trí` : `${savedCount}/${MAX_SLIDES} vị trí`}
                    </span>
                </div>

                <div>
                    {!isOpen ? (
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                            onClick={handleOpen}
                            disabled={isLoading}
                        >
                            Chỉnh sửa
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            Thu gọn
                        </button>
                    )}
                </div>
            </div>

            {!isOpen && (
                <p className="featured-panel__subtitle">
                    Cấu hình tối đa {MAX_SLIDES} slide trượt tại đầu Trang chủ. Khách hàng xem trực tiếp cấu hình này.
                </p>
            )}

            {error && (
                <div className="featured-panel__alert featured-panel__alert--error" role="alert">
                    <span>{error}</span>
                    {!hasLoaded && (
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                            onClick={() => {
                                setIsLoading(true)
                                setReloadTrigger((t) => t + 1)
                            }}
                        >
                            Tải lại
                        </button>
                    )}
                </div>
            )}

            {notice && (
                <div className="featured-panel__alert featured-panel__alert--success" role="status">
                    <span>{notice}</span>
                </div>
            )}

            {isLoading && !hasLoaded && (
                <div className="featured-panel__loading">
                    Đang tải cấu hình sản phẩm nổi bật...
                </div>
            )}

            {isOpen && (
                <form className="featured-panel__content" onSubmit={handleSave}>
                    <div className="featured-panel__slides-list">
                        {draftSlides.length === 0 ? (
                            <div className="featured-panel__empty-notice">
                                Chưa có sản phẩm nào trong banner. Chọn sản phẩm từ danh mục bên dưới để thêm.
                            </div>
                        ) : (
                            draftSlides.map((slide, index) => {
                                const isDiscontinued = slide.product?.isActive === false
                                const isSwapping = swappingIndex === index

                                return (
                                    <div
                                        key={slide.productId}
                                        className={`featured-panel__slide ${
                                            isDiscontinued ? 'featured-panel__slide--inactive' : ''
                                        }`}
                                    >
                                        <div className="featured-panel__slide-head">
                                            <div className="featured-panel__slide-meta">
                                                <span className="featured-panel__pos-tag">
                                                    #{index + 1}
                                                </span>
                                                <span className="featured-panel__slide-title">
                                                    {slide.product?.name || `Sản phẩm #${slide.productId}`}
                                                </span>
                                                <span className="featured-panel__slide-sku">
                                                    [{slide.product?.sku || `#${slide.productId}`}] · {slide.product?.category}
                                                </span>
                                                {isDiscontinued && (
                                                    <span className="featured-panel__discontinued-badge">
                                                        <LucideIcon name="alert-triangle" size={12} />
                                                        Ngừng kinh doanh (Cần đổi hoặc bỏ)
                                                    </span>
                                                )}
                                            </div>

                                            <div className="featured-panel__slide-actions">
                                                <button
                                                    type="button"
                                                    className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                    onClick={() => moveSlide(index, -1)}
                                                    disabled={index === 0 || isSaving}
                                                    title="Chuyển lên"
                                                >
                                                    Lên
                                                </button>
                                                <button
                                                    type="button"
                                                    className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                    onClick={() => moveSlide(index, 1)}
                                                    disabled={index === draftSlides.length - 1 || isSaving}
                                                    title="Chuyển xuống"
                                                >
                                                    Xuống
                                                </button>
                                                <button
                                                    type="button"
                                                    className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm featured-panel__btn-danger"
                                                    onClick={() => removeSlide(index)}
                                                    disabled={isSaving}
                                                    title="Bỏ khỏi banner"
                                                >
                                                    Bỏ khỏi banner
                                                </button>
                                            </div>
                                        </div>

                                        <div className="featured-panel__slide-body">
                                            <div className="featured-panel__fields">
                                                <div className="featured-panel__field">
                                                    <label>
                                                        Đổi sản phẩm cho vị trí này
                                                        <button
                                                            type="button"
                                                            className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                            onClick={() =>
                                                                setSwappingIndex(isSwapping ? null : index)
                                                            }
                                                            disabled={isSaving}
                                                        >
                                                            {isSwapping ? 'Đóng chọn' : 'Chọn sản phẩm khác'}
                                                        </button>
                                                    </label>
                                                    {isSwapping && (
                                                        <div className="featured-panel__swap-select">
                                                            <select
                                                                className="mgmt-select"
                                                                style={{ width: '100%' }}
                                                                defaultValue=""
                                                                onChange={(e) => {
                                                                    const pid = Number(e.target.value)
                                                                    const p = products.find((prod) => prod.id === pid)
                                                                    if (p) replaceSlideProduct(index, p)
                                                                }}
                                                            >
                                                                <option value="" disabled>
                                                                    -- Chọn sản phẩm thay thế --
                                                                </option>
                                                                {availableProducts.map((p) => (
                                                                    <option key={p.id} value={p.id}>
                                                                        {p.name} ({p.sku || `#${p.id}`}) - {p.category}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="featured-panel__field">
                                                    <label>
                                                        Đường dẫn ảnh banner riêng (tùy chọn)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        className="mgmt-input"
                                                        value={slide.imageUrlOverride ?? ''}
                                                        onChange={(e) =>
                                                            updateSlideField(
                                                                index,
                                                                'imageUrlOverride',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Mặc định từ sản phẩm: /images/products/... hoặc https://..."
                                                        disabled={isSaving}
                                                    />
                                                    <small>
                                                        Để trống sẽ lấy ảnh mặc định của sản phẩm.
                                                    </small>
                                                </div>

                                                <div className="featured-panel__field">
                                                    <label>
                                                        Mô tả banner riêng (tùy chọn)
                                                        <span className="featured-panel__char-count">
                                                            {(slide.descriptionOverride ?? '').length}/200 ký tự
                                                        </span>
                                                    </label>
                                                    <textarea
                                                        className="mgmt-input featured-panel__textarea"
                                                        maxLength={200}
                                                        rows={2}
                                                        value={slide.descriptionOverride ?? ''}
                                                        onChange={(e) =>
                                                            updateSlideField(
                                                                index,
                                                                'descriptionOverride',
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Mặc định từ mô tả của sản phẩm..."
                                                        disabled={isSaving}
                                                    />
                                                    <small>
                                                        Để trống sẽ lấy mô tả mặc định của sản phẩm.
                                                    </small>
                                                </div>
                                            </div>

                                            <div className="featured-panel__preview-box">
                                                <span className="featured-panel__preview-label">
                                                    Xem trước trên banner
                                                </span>
                                                <SlidePreviewCard slide={slide} />
                                            </div>
                                        </div>
                                    </div>
                                )
                            })
                        )}
                    </div>

                    {draftSlides.length < MAX_SLIDES && (
                        <div className="featured-panel__add-section">
                            <h3 className="featured-panel__add-title">
                                <LucideIcon name="plus" size={16} />
                                Thêm sản phẩm vào banner (còn trống {MAX_SLIDES - draftSlides.length} vị trí)
                            </h3>
                            <div className="featured-panel__search-bar">
                                <input
                                    type="search"
                                    className="mgmt-input"
                                    placeholder="Tìm theo tên sản phẩm hoặc SKU trên toàn danh mục..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    disabled={isSaving}
                                    aria-label="Tìm sản phẩm thêm vào banner"
                                />
                            </div>

                            <div className="featured-panel__search-results">
                                {searchResults.length === 0 ? (
                                    <div className="featured-panel__no-results">
                                        Không tìm thấy sản phẩm đang kinh doanh phù hợp.
                                    </div>
                                ) : (
                                    searchResults.map((product) => (
                                        <div
                                            key={product.id}
                                            className="featured-panel__product-item"
                                        >
                                            <div className="featured-panel__product-item-left">
                                                <img
                                                    className="featured-panel__product-item-thumb"
                                                    src={product.imageUrl || '/images/products/placeholder.jpg'}
                                                    alt=""
                                                    onError={handleImageError}
                                                />
                                                <div className="featured-panel__product-item-info">
                                                    <span className="featured-panel__product-item-name">
                                                        {product.name}
                                                    </span>
                                                    <span className="featured-panel__product-item-sub">
                                                        {product.sku || `#${product.id}`} · {product.category}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                                                onClick={() => addSlide(product)}
                                                disabled={isSaving}
                                            >
                                                + Thêm vào banner
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    <div className="featured-panel__footer">
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost"
                            onClick={handleCancel}
                            disabled={isSaving}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="mgmt-btn mgmt-btn--primary"
                            disabled={!hasLoaded || isLoading || isSaving}
                        >
                            {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
                        </button>
                    </div>
                </form>
            )}
        </section>
    )
}
