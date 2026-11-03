import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import ProductThumb from '../components/ProductThumb'
import LucideIcon from '../components/LucideIcon'
import { formatPrice } from '../utils/format'

function ProductManagementPage() {
    const { currentUser } = useAuth()
    const { products, updateProductStatus } = useProducts()
    const { getProductAvailableStock } = useInventory()

    const [keyword, setKeyword] = useState('')
    const [category, setCategory] = useState('Tất cả')
    const [statusFilter, setStatusFilter] = useState('ALL')

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'ADMIN') {
        return <Navigate to="/products" replace />
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

    const activeCount = products.filter(
        (p) => (p.status ?? 'ACTIVE') === 'ACTIVE'
    ).length
    const discontinuedCount = products.length - activeCount

    return (
        <div className="mgmt-page">
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

            <section className="mgmt-card">
                <div className="mgmt-toolbar">
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm kiếm sản phẩm..."
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        aria-label="Tìm kiếm sản phẩm"
                    />

                    <select
                        className="mgmt-select"
                        value={category}
                        onChange={(event) => setCategory(event.target.value)}
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
                        onChange={(event) => setStatusFilter(event.target.value)}
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
                            {filteredProducts.map((product) => {
                                const available = getProductAvailableStock(
                                    product.id
                                )
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
                                                onChange={(event) =>
                                                    updateProductStatus(
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
            </section>
        </div>
    )
}

export default ProductManagementPage
