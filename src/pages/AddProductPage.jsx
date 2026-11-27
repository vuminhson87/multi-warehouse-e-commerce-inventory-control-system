import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ProductImagePanel, ProductMainFields } from '../components/ProductFormFields'
import { buildProductCategoryOptions } from '../constants/productCategories'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'

function AddProductPage() {
    const { currentUser } = useAuth()
    const { products, addProduct } = useProducts()
    const navigate = useNavigate()

    const [form, setForm] = useState({
        name: '',
        category: '',
        price: '',
        imageUrl: '',
        description: '',
    })

    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [uploadingImage, setUploadingImage] = useState(false)

    const categories = useMemo(
        () => buildProductCategoryOptions(products),
        [products]
    )

    if (currentUser?.role !== 'ADMIN') {
        return <Navigate to="/products" replace />
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
            setError('Vui lòng chọn hoặc nhập danh mục sản phẩm.')
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
            await addProduct(form)
            navigate('/admin/products')
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
                    <h1>Thêm sản phẩm</h1>
                    <p>Nhập thông tin sản phẩm mới vào hệ thống.</p>
                </div>
            </div>

            <form className="mgmt-product-layout" onSubmit={handleSubmit}>
                <div className="mgmt-form mgmt-form--in-grid">
                    <ProductMainFields
                        idPrefix="product"
                        form={form}
                        categories={categories}
                        onChange={handleChange}
                        onSetField={handleSetField}
                        namePlaceholder="Ví dụ: Laptop ASUS Vivobook"
                        pricePlaceholder="Ví dụ: 15000000"
                        descriptionPlaceholder="Nhập mô tả sản phẩm..."
                    />

                    <p className="mgmt-note" style={{ marginTop: 8, marginBottom: 0 }}>
                        Trạng thái kinh doanh mặc định: Đang kinh doanh. Tồn kho khởi tạo tại các kho là 0 (cập nhật tại mục Quản lý kho).
                    </p>

                    {error && (
                        <p className="mgmt-form__error" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="mgmt-form__actions">
                        <Link
                            to="/admin/products"
                            className="mgmt-btn mgmt-btn--ghost"
                        >
                            Hủy
                        </Link>

                        <button
                            type="submit"
                            disabled={saving || uploadingImage}
                            className="mgmt-btn mgmt-btn--primary"
                        >
                            Lưu sản phẩm
                        </button>
                    </div>
                </div>

                <ProductImagePanel
                    idPrefix="product"
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

export default AddProductPage
