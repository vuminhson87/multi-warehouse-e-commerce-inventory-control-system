import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import ProductCard from '../components/ProductCard'
import ProductPagination from '../components/ProductPagination'
import LucideIcon from '../components/LucideIcon'
import './ProductCatalogPage.css'

const ALL = 'Tất cả'
const PRODUCTS_PER_PAGE = 10

function readCatalogPage(value) {
    if (!/^[1-9]\d*$/.test(value ?? '')) return 1

    const page = Number(value)
    return Number.isSafeInteger(page) ? page : 1
}

const SORT_OPTIONS = [
    { value: 'default', label: 'Mặc định' },
    { value: 'price-asc', label: 'Giá tăng dần' },
    { value: 'price-desc', label: 'Giá giảm dần' },
    { value: 'name-asc', label: 'Tên A → Z' },
]

function sortProducts(list, sort) {
    const copy = [...list]
    const price = (p) => (Number.isFinite(Number(p.price)) ? Number(p.price) : 0)

    if (sort === 'price-asc') copy.sort((a, b) => price(a) - price(b))
    else if (sort === 'price-desc') copy.sort((a, b) => price(b) - price(a))
    else if (sort === 'name-asc')
        copy.sort((a, b) => String(a.name).localeCompare(String(b.name), 'vi'))

    return copy
}

function buildUrl({ category, search, sort }) {
    const params = new URLSearchParams()
    if (category && category !== ALL) params.set('category', category)
    if (search) params.set('search', search)
    if (sort && sort !== 'default') params.set('sort', sort)
    const query = params.toString()
    return query ? `/products?${query}` : '/products'
}

function ProductCatalogPage() {
    const { products } = useProducts()
    const [searchParams, setSearchParams] = useSearchParams()
    const navigate = useNavigate()
    const [sheet, setSheet] = useState(null) // null | 'filter' | 'sort'

    const searchKeyword = searchParams.get('search') || ''
    const selectedCategory = searchParams.get('category') || ALL
    const sort = searchParams.get('sort') || 'default'
    const rawPage = searchParams.get('page')
    const requestedPage = readCatalogPage(rawPage)

    function getPageHref(page) {
        const params = new URLSearchParams(searchParams)
        params.set('page', String(page))
        return { pathname: '/products', search: `?${params.toString()}` }
    }

    const activeProducts = useMemo(
        () => products.filter((p) => (p.status ?? 'ACTIVE') === 'ACTIVE'),
        [products]
    )

    const categories = useMemo(
        () => [
            ALL,
            ...new Set(activeProducts.map((p) => p.category).filter(Boolean)),
        ],
        [activeProducts]
    )

    const filteredProducts = useMemo(() => {
        const keyword = searchKeyword.trim().toLowerCase()
        const filtered = activeProducts.filter((product) => {
            const matchesSearch = String(product.name)
                .toLowerCase()
                .includes(keyword)
            const matchesCategory =
                selectedCategory === ALL || product.category === selectedCategory
            return matchesSearch && matchesCategory
        })
        return sortProducts(filtered, sort)
    }, [activeProducts, searchKeyword, selectedCategory, sort])

    const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE)
    const currentPage = Math.min(requestedPage, Math.max(1, totalPages))
    const startIndex = (currentPage - 1) * PRODUCTS_PER_PAGE
    const pageProducts = filteredProducts.slice(
        startIndex,
        startIndex + PRODUCTS_PER_PAGE
    )

    useEffect(() => {
        if (rawPage === null || rawPage === String(currentPage)) return

        const params = new URLSearchParams(searchParams)
        params.set('page', String(currentPage))
        setSearchParams(params, { replace: true })
    }, [currentPage, rawPage, searchParams, setSearchParams])

    // Đóng panel mobile bằng Escape và khóa cuộn nền khi đang mở.
    useEffect(() => {
        if (!sheet) return undefined

        const onKey = (event) => {
            if (event.key === 'Escape') setSheet(null)
        }
        document.addEventListener('keydown', onKey)
        const previous = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previous
        }
    }, [sheet])

    function handleSearch(event) {
        event.preventDefault()
        const keyword = event.currentTarget.elements.search.value.trim()
        navigate(buildUrl({ category: selectedCategory, search: keyword, sort }))
    }

    function go(next) {
        setSheet(null)
        navigate(
            buildUrl({
                category: selectedCategory,
                search: searchKeyword,
                sort,
                ...next,
            })
        )
    }

    return (
        <main className="catalog-page">
            <div className="catalog-container">
                <div className="catalog-heading">
                    <h1>Sản phẩm</h1>
                    <p>{filteredProducts.length} sản phẩm</p>
                </div>

                {/* Thanh công cụ desktop/tablet */}
                <div className="catalog-toolbar">
                    <div className="catalog-chips" role="list">
                        {categories.map((category) => (
                            <Link
                                key={category}
                                role="listitem"
                                className={
                                    selectedCategory === category ? 'active' : ''
                                }
                                to={buildUrl({
                                    category,
                                    search: searchKeyword,
                                    sort,
                                })}
                            >
                                {category}
                            </Link>
                        ))}
                    </div>

                    <label className="catalog-sort">
                        <span className="catalog-sr">Sắp xếp</span>
                        <select
                            value={sort}
                            onChange={(event) => go({ sort: event.target.value })}
                        >
                            {SORT_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <form className="catalog-search" onSubmit={handleSearch}>
                    <LucideIcon
                        name="search"
                        size={16}
                        className="catalog-search__icon"
                    />
                    <input
                        type="search"
                        name="search"
                        key={searchKeyword}
                        defaultValue={searchKeyword}
                        placeholder="Tìm kiếm sản phẩm..."
                        aria-label="Tìm kiếm sản phẩm"
                    />
                </form>

                {/* Nút lọc / sắp xếp trên mobile */}
                <div className="catalog-mobile-bar">
                    <button type="button" onClick={() => setSheet('filter')}>
                        <LucideIcon name="filter" size={18} />
                        Bộ lọc
                    </button>
                    <button type="button" onClick={() => setSheet('sort')}>
                        <LucideIcon name="sort" size={18} />
                        Sắp xếp
                    </button>
                </div>

                <div className="product-grid">
                    {filteredProducts.length === 0 ? (
                        <div className="store-empty">
                            <strong>Không tìm thấy sản phẩm phù hợp</strong>
                            Hãy thử đổi từ khóa hoặc danh mục khác.
                        </div>
                    ) : (
                        pageProducts.map((product) => (
                            <ProductCard key={product.id} product={product} />
                        ))
                    )}
                </div>

                <ProductPagination
                    page={currentPage}
                    totalPages={totalPages}
                    getPageHref={getPageHref}
                />
            </div>

            {/* Panel mobile */}
            <div
                className={`catalog-sheet-overlay ${sheet ? 'is-open' : ''}`}
                onClick={() => setSheet(null)}
                aria-hidden="true"
            />
            <section
                className={`catalog-sheet ${sheet ? 'is-open' : ''}`}
                role="dialog"
                aria-modal="true"
                aria-label={sheet === 'sort' ? 'Sắp xếp' : 'Bộ lọc'}
                inert={!sheet}
            >
                <div className="catalog-sheet__head">
                    <h2>{sheet === 'sort' ? 'Sắp xếp' : 'Bộ lọc danh mục'}</h2>
                    <button
                        type="button"
                        className="icon-btn catalog-sheet__close"
                        onClick={() => setSheet(null)}
                        aria-label="Đóng"
                    >
                        <LucideIcon name="x" size={20} />
                    </button>
                </div>

                <div className="catalog-sheet__list">
                    {sheet === 'sort' &&
                        SORT_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                className={sort === option.value ? 'active' : ''}
                                onClick={() => go({ sort: option.value })}
                            >
                                {option.label}
                                {sort === option.value && (
                                    <LucideIcon name="check" size={16} />
                                )}
                            </button>
                        ))}

                    {sheet === 'filter' &&
                        categories.map((category) => (
                            <button
                                key={category}
                                type="button"
                                className={
                                    selectedCategory === category ? 'active' : ''
                                }
                                onClick={() => go({ category })}
                            >
                                {category}
                                {selectedCategory === category && (
                                    <LucideIcon name="check" size={16} />
                                )}
                            </button>
                        ))}
                </div>
            </section>
        </main>
    )
}

export default ProductCatalogPage
