
import { useState } from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import './ProductForm.css'

function EditProductPage() {
  const { currentUser } = useAuth()
  const { products, updateProduct } = useProducts()
  const { productId } = useParams()
  const navigate = useNavigate()

  const product = products.find(
    (item) => String(item.id) === String(productId)
  )

  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    category: product?.category ?? '',
    price: product ? String(product.price) : '',
    description: product?.description ?? '',
  }))

  const [error, setError] = useState('')

  if (currentUser?.role !== 'ADMIN') {
    return <Navigate to="/products" replace />
  }

  if (!product) {
    return (
      <main className="product-form-page">
        <h1>Không tìm thấy sản phẩm</h1>
        <p>Sản phẩm không tồn tại hoặc đã bị xóa.</p>
        <Link to="/admin/products">Quay lại danh sách</Link>
      </main>
    )
  }

  function handleChange(event) {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
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
      setError('Vui lòng chọn danh mục.')
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

    updateProduct(productId, form)
    navigate('/admin/products')
  }

  return (
    <main className="product-form-page">
      <div className="product-form-header">
        <h1>Chỉnh sửa sản phẩm</h1>
        <p>Cập nhật thông tin sản phẩm #{product.id}.</p>
      </div>

      <form className="product-form" onSubmit={handleSubmit}>
        <label htmlFor="edit-product-name">Tên sản phẩm *</label>
        <input
          id="edit-product-name"
          name="name"
          value={form.name}
          onChange={handleChange}
          maxLength={150}
          required
        />

        <label htmlFor="edit-product-category">Danh mục *</label>
        <select
          id="edit-product-category"
          name="category"
          value={form.category}
          onChange={handleChange}
          required
        >
          <option value="">-- Chọn danh mục --</option>
          <option value="Laptop">Laptop</option>
          <option value="Phụ kiện">Phụ kiện</option>
        </select>

        <label htmlFor="edit-product-price">Giá bán (VNĐ) *</label>
        <input
          id="edit-product-price"
          name="price"
          type="number"
          min="1"
          step="1"
          value={form.price}
          onChange={handleChange}
          required
        />

        <label htmlFor="edit-product-description">Mô tả</label>
        <textarea
          id="edit-product-description"
          name="description"
          value={form.description}
          onChange={handleChange}
          rows={4}
        />

        <p className="product-form-note">
          Việc chỉnh sửa thông tin không thay đổi tình trạng kho
          hoặc trạng thái kinh doanh của sản phẩm.
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
            Lưu thay đổi
          </button>
        </div>
      </form>
    </main>
  )
}

export default EditProductPage
