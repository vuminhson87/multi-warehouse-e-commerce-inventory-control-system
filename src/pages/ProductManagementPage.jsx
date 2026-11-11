import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import ProductThumb from '../components/ProductThumb'
import ProductPagination from '../components/ProductPagination'
import FeaturedProductsPanel from '../components/FeaturedProductsPanel'
import LucideIcon from '../components/LucideIcon'
import { formatPrice } from '../utils/format'

const ADMIN_PRODUCTS_PATH = '/admin/products'
const ADMIN_PRODUCTS_PER_PAGE = 10

function readAdminProductsPage(value) {
    if (!/^[1-9]\d*$/.test(value ?? '')) return 1

    const page = Number(value)
    return Number.isSafeInteger(page) ? page : 1
}

function ProductManagementPage() {
    const { currentUser } = useAuth()
    const { products, updateProductStatus, loading, error } = useProducts()
    const [pending, setPending] = useState(false)
    const [statusError, setStatusError] = useState(null)

    async function changeStatus(id, status) {
        setPending(true)
        setStatusError(null)
        try {
            await updateProductStatus(id, status)
        } catch (error) {
            setStatusError(error.message)
        } finally {
            setPending(false)
        }
    }

    const [searchParams, setSearchParams] = useSearchParams()
    const rawPage = searchParams.get('page')
    const requestedPage = readAdminProductsPage(rawPage)
    const keyword = searchParams.get('search') ?? ''
    const category = searchParams.get('category') ?? 'Tất cả'
    const statusFilter = searchParams.get('status') ?? 'ALL'

    function getPageHref(page) {
        const params = new URLSearchParams(searchParams)
        params.set('page', String(page))

        return { pathname: ADMIN_PRODUCTS_PATH, search: `?${params.toString()}` }
    }

    function updateFilter(key, value) {
        const params = new URLSearchParams(searchParams)

        if (value) {
            params.set(key, value)
        } else {
            params.delete(key)
        }

        params.delete('page')
        setSearchParams(params, { replace: key === 'search' })
    }

    const categories = [
        'Tất cả',
        ...new Set(products.map((product) => product.category).filter(Boolean)),
    ]

    const filteredProducts = products.filter((product) => {
        const matchesKeyword = String(product.name ?? '')
            .toLowerCase()
            .includes(keyword.trim().toLowerCase())

        const matchesCategory =
            category === 'Tất cả' || product.category === category

        const productStatus = product.status ?? 'ACTIVE'
        const matchesStatus =
            statusFilter === 'ALL' || productStatus === statusFilter

        return matchesKeyword && matchesCategory && matchesStatus
    })

    const totalPages = Math.ceil(filteredProducts.length / ADMIN_PRODUCTS_PER_PAGE)
    const currentPage = Math.min(requestedPage, Math.max(1, totalPages))
    const startIndex = (currentPage - 1) * ADMIN_PRODUCTS_PER_PAGE
    const pageProducts = filteredProducts.slice(
        startIndex,
        startIndex + ADMIN_PRODUCTS_PER_PAGE
    )

    const isAdmin = currentUser?.role === 'ADMIN'

    useEffect(() => {
        if (!isAdmin || rawPage === null || rawPage === String(currentPage)) return

        const params = new URLSearchParams(searchParams)
        params.set('page', String(currentPage))
        setSearchParams(params, { replace: true })
    }, [currentPage, isAdmin, rawPage, searchParams, setSearchParams])

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'ADMIN') {
        return <Navigate to="/products" replace />
    }

    const activeCount = products.filter(
        (p) => (p.status ?? 'ACTIVE') === 'ACTIVE'
    ).length
    const discontinuedCount = products.length - activeCount

    return (
        <div className="mgmt-page">
            {loading && <p role="status">Đang tải sản phẩm…</p>}
            {(error || statusError) && <p role="alert">{error?.message ?? statusError}</p>}
            <div className="mgmt-head">
                <div>
                    <h1>Quản lý sản phẩm</h1>
                    <p>
                        {products.length} sản phẩm · {activeCount} đang kinh doanh ·{' '}
                        {discontinuedCount} ngừng kinh doanh
                    </p>
                </div>

                <div className="mgmt-head__actions">
                    <Link
                        className="mgmt-btn mgmt-btn--primary"
                        to="/admin/products/add"
                    >
                        <LucideIcon name="plus" size={16} />
                        Thêm sản phẩm
                    </Link>
                </div>
            </div>

            <FeaturedProductsPanel />

            <section className="mgmt-card">
                <div className="mgmt-toolbar">
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm kiếm sản phẩm..."
                        value={keyword}
                        onChange={(event) => updateFilter('search', event.target.value)}
                        aria-label="Tìm kiếm sản phẩm"
                    />

                    <select
                        className="mgmt-select"
                        value={category}
                        onChange={(event) => {
                            const value = event.target.value
                            updateFilter('category', value === 'Tất cả' ? '' : value)
                        }}
                        aria-label="Lọc theo danh mục"
                    >
                        {categories.map((item) => (
                            <option key={item} value={item}>
                                {item}
                            </option>
                        ))}
                    </select>

                    <select
                        className="mgmt-select"
                        value={statusFilter}
                        onChange={(event) => {
                            const value = event.target.value
                            updateFilter('status', value === 'ALL' ? '' : value)
                        }}
                        aria-label="Lọc theo trạng thái kinh doanh"
                    >
                        <option value="ALL">Mọi trạng thái</option>
                        <option value="ACTIVE">Đang kinh doanh</option>
                        <option value="DISCONTINUED">Ngừng kinh doanh</option>
                    </select>
                </div>

                <div className="mgmt-table-wrap">
                    <table className="mgmt-table">
                        <thead>
                            <tr>
                                <th>Mã SP</th>
                                <th>Tên sản phẩm</th>
                                <th>Danh mục</th>
                                <th className="num">Giá bán</th>
                                <th>Tình trạng kho</th>
                                <th>Trạng thái kinh doanh</th>
                                <th>Thao tác</th>
                            </tr>
                        </thead>

                        <tbody>
                            {pageProducts.map((product) => {
                                const available = product.maxAvailable ?? 0
                                const isInStock = available > 0

                                return (
                                    <tr key={product.id}>
                                        <td>#{product.id}</td>
                                        <td>
                                            <div className="mgmt-product-cell">
                                                <ProductThumb product={product} />
                                                <span>{product.name}</span>
                                            </div>
                                        </td>
                                        <td>{product.category}</td>
                                        <td className="num">
                                            {formatPrice(product.price)}
                                        </td>
                                        <td>
                                            <span
                                                className={`mgmt-badge ${
                                                    isInStock
                                                        ? 'mgmt-badge--success'
                                                        : 'mgmt-badge--danger'
                                                }`}
                                            >
                                                {isInStock
                                                    ? `Còn hàng (${available})`
                                                    : 'Hết hàng'}
                                            </span>
                                        </td>
                                        <td>
                                            <select
                                                className="mgmt-select"
                                                value={product.status ?? 'ACTIVE'}
                                                disabled={pending}
                                                onChange={(event) =>
                                                    changeStatus(
                                                        product.id,
                                                        event.target.value
                                                    )
                                                }
                                                aria-label={`Trạng thái kinh doanh của ${product.name}`}
                                            >
                                                <option value="ACTIVE">
                                                    Đang kinh doanh
                                                </option>
                                                <option value="DISCONTINUED">
                                                    Ngừng kinh doanh
                                                </option>
                                            </select>
                                        </td>
                                        <td>
                                            <Link
                                                className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                to={`/admin/products/${product.id}/edit`}
                                                state={{
                                                    productListSearch: searchParams.toString(),
                                                }}
                                            >
                                                Sửa
                                            </Link>
                                        </td>
                                    </tr>
                                )
                            })}

                            {filteredProducts.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="mgmt-empty">
                                        Không tìm thấy sản phẩm phù hợp.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <ProductPagination
                    page={currentPage}
                    totalPages={totalPages}
                    getPageHref={getPageHref}
                />
            </section>
        </div>
    )
}

export default ProductManagementPage
