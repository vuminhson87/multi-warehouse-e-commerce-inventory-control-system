
import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import './ProductManagementPage.css'

function ProductManagementPage() {
    const { currentUser } = useAuth()
    const { products, updateProductStatus } = useProducts()

    const [keyword, setKeyword] = useState('')
    const [category, setCategory] = useState('Tất cả')

    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    if (currentUser.role !== 'ADMIN') {
        return <Navigate to="/products" replace />
    }

    const categories = [
        'Tất cả',
        ...new Set(products.map((product) => product.category)),
    ]

    const filteredProducts = products.filter((product) => {
        const matchesKeyword = product.name
            .toLowerCase()
            .includes(keyword.trim().toLowerCase())

        const matchesCategory =
            category === 'Tất cả' || product.category === category

        return matchesKeyword && matchesCategory
    })

    return (
        <main className="product-management-page">
            <div className="product-management-heading">
                <div>
                    <h1>Quản lý sản phẩm</h1>
                    <p>Quản lý danh sách sản phẩm trong hệ thống.</p>
                </div>

                <Link
                    className="product-management-add"
                    to="/admin/products/add"
                >
                    + Thêm sản phẩm
                </Link>
            </div>

            <div className="product-management-filters">
                <input
                    type="search"
                    placeholder="Tìm kiếm sản phẩm..."
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                />

                <select
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                >
                    {categories.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
            </div>

            <div className="product-management-table-wrapper">
                <table className="product-management-table">
                    <thead>
                        <tr>
                            <th>Mã SP</th>
                            <th>Tên sản phẩm</th>
                            <th>Danh mục</th>
                            <th>Giá bán</th>
                            <th>Tình trạng kho</th>
                            <th>Trạng thái kinh doanh</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredProducts.map((product) => (
                            <tr key={product.id}>
                                <td>#{product.id}</td>
                                <td>{product.name}</td>
                                <td>{product.category}</td>
                                <td>
                                    {product.price.toLocaleString('vi-VN')} VNĐ
                                </td>
                                <td>
                                    <span
                                        className={
                                            product.inStock
                                                ? 'product-status active'
                                                : 'product-status inactive'
                                        }
                                    >
                                        {product.inStock
                                            ? 'Còn hàng'
                                            : 'Hết hàng'}
                                    </span>
                                </td>
                                <td>
                                    <select
                                        className={`product-business-status ${product.status === 'DISCONTINUED'
                                                ? 'discontinued'
                                                : 'active'
                                            }`}
                                        value={product.status ?? 'ACTIVE'}
                                        onChange={(event) =>
                                            updateProductStatus(product.id, event.target.value)
                                        }
                                        aria-label={`Trạng thái kinh doanh của ${product.name}`}
                                    >
                                        <option value="ACTIVE">Đang kinh doanh</option>
                                        <option value="DISCONTINUED">Ngừng kinh doanh</option>
                                    </select>
                                </td>
                                <td>
                                    <Link
                                        className="product-action-edit"
                                        to={`/admin/products/${product.id}/edit`}
                                    >
                                        Sửa
                                    </Link>
                                </td>
                            </tr>
                        ))}

                        {filteredProducts.length === 0 && (
                            <tr>
                                <td colSpan="7" className="product-empty">
                                    Không tìm thấy sản phẩm phù hợp.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </main>
    )
}

export default ProductManagementPage
