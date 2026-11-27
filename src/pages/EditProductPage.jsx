import { useMemo, useState } from 'react'
import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { ProductImagePanel, ProductMainFields } from '../components/ProductFormFields'
import { buildProductCategoryOptions } from '../constants/productCategories'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'

function EditProductPage() {
  const { productId } = useParams()
  const { loading, error } = useProducts()
  if (loading || error) return <p role={error ? "alert" : "status"}>{error?.message ?? "Đang tải sản phẩm…"}</p>
  return <EditProductForm key={productId} />
}

function EditProductForm() {
  const { currentUser } = useAuth()
  const { products, updateProduct } = useProducts()
  const { productId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()

  const listSearch =
    typeof location.state?.productListSearch === 'string'
      ? location.state.productListSearch
      : ''
  const listDestination = {
    pathname: '/admin/products',
    search: listSearch ? `?${listSearch}` : '',
  }

  const product = products.find(
    (item) => String(item.id) === String(productId)
  )

  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    category: product?.category ?? '',
    price: product ? String(product.price) : '',
    imageUrl: product?.imageUrl ?? '',
    description: product?.description ?? '',
  }))

  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)

  const categories = useMemo(
    () => buildProductCategoryOptions(products, product?.category ?? ''),
    [products, product?.category]
  )

  if (currentUser?.role !== 'ADMIN') {
    return <Navigate to="/products" replace />
  }

  if (!product) {
    return (
      <div className="mgmt-page">
        <div className="mgmt-head">
          <div>
            <h1>Không tìm thấy sản phẩm</h1>
            <p>Sản phẩm không tồn tại hoặc đã bị xóa.</p>
          </div>
        </div>
        <Link to={listDestination} className="mgmt-btn mgmt-btn--ghost">
          Quay lại danh sách
        </Link>
      </div>
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

  function handleSetField(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }))
    setError('')
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (saving || uploadingImage) return

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

    setSaving(true)
    try {
      await updateProduct(productId, form)
      navigate(listDestination)
    } catch (error) {
      setError(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mgmt-page">
      <div className="mgmt-head">
        <div>
          <h1>Chỉnh sửa sản phẩm</h1>
          <p>Cập nhật thông tin sản phẩm #{product.id}.</p>
        </div>
      </div>

      <form className="mgmt-product-layout" onSubmit={handleSubmit}>
        <div className="mgmt-form mgmt-form--in-grid">
          <ProductMainFields
            idPrefix="edit-product"
            form={form}
            categories={categories}
            onChange={handleChange}
            onSetField={handleSetField}
          />

          <p className="mgmt-note" style={{ marginTop: 8, marginBottom: 0 }}>
            Việc chỉnh sửa thông tin không thay đổi tình trạng kho
            hoặc trạng thái kinh doanh của sản phẩm.
          </p>

          {error && (
            <p className="mgmt-form__error" role="alert">
              {error}
            </p>
          )}

          <div className="mgmt-form__actions">
            <Link
              to={listDestination}
              className="mgmt-btn mgmt-btn--ghost"
            >
              Hủy
            </Link>

            <button
              type="submit"
              disabled={saving || uploadingImage}
              className="mgmt-btn mgmt-btn--primary"
            >
              Lưu thay đổi
            </button>
          </div>
        </div>

        <ProductImagePanel
          idPrefix="edit-product"
          imageUrl={form.imageUrl}
          saving={saving}
          uploadingImage={uploadingImage}
          onUploadingChange={setUploadingImage}
          onImageUrlChange={(value) => handleSetField('imageUrl', value)}
        />
      </form>
    </div>
  )
}

export default EditProductPage
