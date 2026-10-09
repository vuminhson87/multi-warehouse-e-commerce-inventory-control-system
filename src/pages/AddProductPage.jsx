
import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import './ProductForm.css'

function AddProductPage() {
    const { currentUser } = useAuth()
    const { addProduct } = useProducts()
    const navigate = useNavigate()

    const [form, setForm] = useState({
        name: '',
        category: '',
        price: '',
        description: '',
        inStock: true,
    })

    const [error, setError] = useState('')

    if (currentUser?.role !== 'ADMIN') {
        return <Navigate to="/products" replace />
    }

    function handleChange(event) {
        const { name, value, type, checked } = event.target

        setForm((previous) => ({
            ...previous,
            [name]: type === 'checkbox' ? checked : value,
        }))

        setError('')
    }

    function handleSubmit(event) {
        event.preventDefault()

        if (!form.name.trim()) {
            setError('Vui lòng nhập tên sản phẩm.')
            return
        }

        if (!form.category.trim()) {
            setError('Vui lòng nhập danh mục sản phẩm.')
            return
        }

        if (
            form.price.trim() === '' ||
            !Number.isFinite(Number(form.price)) ||
            Number(form.price) <= 0
        ) {
            setError('Giá bán phải là số lớn hơn 0.')
            return
        }

        addProduct(form)
        navigate('/admin/products')
    }

    return (
        <main className="product-form-page">
            <div className="product-form-header">
                <h1>Thêm sản phẩm</h1>
                <p>Nhập thông tin sản phẩm mới vào hệ thống.</p>
            </div>

            <form className="product-form" onSubmit={handleSubmit}>
                <label htmlFor="product-name">Tên sản phẩm *</label>
                <input
                    id="product-name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="Ví dụ: Laptop ASUS Vivobook"
                    maxLength={150}
                    required
                />

                <label htmlFor="product-category">Danh mục *</label>
                <select
                    id="product-category"
                    name="category"
                    value={form.category}
                    onChange={handleChange}
                    required
                >
                    <option value="">-- Chọn danh mục --</option>
                    <option value="Laptop">Laptop</option>
                    <option value="Phụ kiện">Phụ kiện</option>
                </select>

                <label htmlFor="product-price">Giá bán (VNĐ) *</label>
                <input
                    id="product-price"
                    name="price"
                    type="number"
                    min="1"
                    step="1"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="Ví dụ: 15000000"
                    required
                />

                <label htmlFor="product-description">Mô tả</label>
                <textarea
                    id="product-description"
                    name="description"
                    value={form.description}
                    onChange={handleChange}
                    rows={4}
                    placeholder="Nhập mô tả sản phẩm..."
                />

                <label className="product-form-checkbox">
                    <input
                        type="checkbox"
                        name="inStock"
                        checked={form.inStock}
                        onChange={handleChange}
                    />
                    Sản phẩm hiện còn hàng
                </label>

                <p className="product-form-note">
                    Trạng thái kinh doanh mặc định: Đang kinh doanh.
                </p>

                {error && (
                    <p className="product-form-error" role="alert">
                        {error}
                    </p>
                )}

                <div className="product-form-actions">
                    <Link
                        to="/admin/products"
                        className="product-form-cancel"
                    >
                        Hủy
                    </Link>

                    <button type="submit" className="product-form-submit">
                        Lưu sản phẩm
                    </button>
                </div>
            </form>
        </main>
    )
}

export default AddProductPage
