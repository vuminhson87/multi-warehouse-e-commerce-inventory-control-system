import { useEffect, useRef, useState } from 'react'
import { CUSTOM_CATEGORY_OPTION } from '../constants/productCategories'
import { useAuth } from '../context/AuthContext'
import { uploadProductImage } from '../services/productApi'
import { handleImageError, resolveMediaUrl } from '../utils/format'
import { removeImageBackground } from '../utils/imageBackgroundRemoval'
import LucideIcon from './LucideIcon'

const ALLOWED_IMAGE_TYPES = new Set([
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/gif',
])
const MAX_IMAGE_BYTES = 3 * 1024 * 1024

export function ProductMainFields({
    idPrefix,
    form,
    categories,
    onChange,
    onSetField,
    namePlaceholder,
    pricePlaceholder,
    descriptionPlaceholder,
}) {
    const [customCategoryMode, setCustomCategoryMode] = useState(false)

    function handleCategorySelectChange(event) {
        const { value } = event.target
        if (value === CUSTOM_CATEGORY_OPTION) {
            setCustomCategoryMode(true)
            onSetField('category', '')
            return
        }
        setCustomCategoryMode(false)
        onSetField('category', value)
    }

    const selectValue = customCategoryMode
        ? CUSTOM_CATEGORY_OPTION
        : form.category

    return (
        <>
            <label htmlFor={`${idPrefix}-name`}>Tên sản phẩm *</label>
            <input
                id={`${idPrefix}-name`}
                name="name"
                value={form.name}
                onChange={onChange}
                placeholder={namePlaceholder}
                maxLength={150}
                required
            />

            <label htmlFor={`${idPrefix}-category`}>Danh mục *</label>
            <select
                id={`${idPrefix}-category`}
                name={customCategoryMode ? 'category-preset' : 'category'}
                value={selectValue}
                onChange={handleCategorySelectChange}
                required={!customCategoryMode}
            >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((category) => (
                    <option key={category} value={category}>
                        {category}
                    </option>
                ))}
                <option value={CUSTOM_CATEGORY_OPTION}>
                    + Nhập danh mục khác...
                </option>
            </select>

            {customCategoryMode && (
                <>
                    <label htmlFor={`${idPrefix}-custom-category`}>
                        Tên danh mục mới *
                    </label>
                    <input
                        id={`${idPrefix}-custom-category`}
                        name="category"
                        value={form.category}
                        onChange={onChange}
                        placeholder="Ví dụ: Máy tính bảng"
                        maxLength={80}
                        required
                    />
                </>
            )}

            <label htmlFor={`${idPrefix}-price`}>Giá bán (VNĐ) *</label>
            <input
                id={`${idPrefix}-price`}
                name="price"
                type="number"
                min="1"
                step="1"
                value={form.price}
                onChange={onChange}
                placeholder={pricePlaceholder}
                required
            />

            <label htmlFor={`${idPrefix}-description`}>Mô tả</label>
            <textarea
                id={`${idPrefix}-description`}
                name="description"
                value={form.description}
                onChange={onChange}
                rows={4}
                placeholder={descriptionPlaceholder}
            />
        </>
    )
}

export function ProductImagePanel({
    idPrefix,
    imageUrl,
    saving,
    uploadingImage,
    onUploadingChange,
    onImageUrlChange,
}) {
    const { token } = useAuth()
    const [autoRemoveBg, setAutoRemoveBg] = useState(true)
    const [tolerance, setTolerance] = useState(38)
    const [sourceFile, setSourceFile] = useState(null)
    const [isBgRemoved, setIsBgRemoved] = useState(false)
    const [localPreviewUrl, setLocalPreviewUrl] = useState('')
    const [uploadError, setUploadError] = useState('')
    const processSeqRef = useRef(0)
    const debounceRef = useRef(null)

    useEffect(() => {
        return () => {
            if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl)
        }
    }, [localPreviewUrl])

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
        }
    }, [])

    function replaceLocalPreview(nextUrl) {
        setLocalPreviewUrl((previous) => {
            if (previous) URL.revokeObjectURL(previous)
            return nextUrl
        })
    }

    async function processAndUploadFile(file, removeBgEnabled, currentTolerance) {
        const seq = ++processSeqRef.current
        setUploadError('')
        onUploadingChange?.(true)

        try {
            let fileToUpload = file
            let removed = false

            if (removeBgEnabled) {
                const processed = await removeImageBackground(file, {
                    tolerance: currentTolerance,
                })
                if (seq !== processSeqRef.current) return
                fileToUpload = processed.file
                removed = processed.backgroundRemoved
            }

            if (fileToUpload.size > MAX_IMAGE_BYTES) {
                throw new Error('Dung lượng ảnh sau xử lý vượt quá 3MB.')
            }

            const previewObjectUrl = URL.createObjectURL(fileToUpload)
            if (seq !== processSeqRef.current) {
                URL.revokeObjectURL(previewObjectUrl)
                return
            }
            replaceLocalPreview(previewObjectUrl)
            setIsBgRemoved(removed)

            const uploaded = await uploadProductImage(token, fileToUpload)
            if (seq !== processSeqRef.current) return
            if (uploaded?.imageUrl) {
                onImageUrlChange(uploaded.imageUrl)
                replaceLocalPreview('')
            }
        } catch (error) {
            if (seq === processSeqRef.current) {
                setUploadError(error.message || 'Không thể xử lý hoặc tải ảnh lên.')
            }
        } finally {
            if (seq === processSeqRef.current) {
                onUploadingChange?.(false)
            }
        }
    }

    async function handleFileSelect(event) {
        const file = event.target.files?.[0]
        event.target.value = ''
        if (!file) return

        setUploadError('')
        if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
            setUploadError('Chỉ hỗ trợ tệp ảnh PNG, JPG, WEBP hoặc GIF.')
            return
        }
        if (file.size > MAX_IMAGE_BYTES && !autoRemoveBg) {
            setUploadError('Dung lượng ảnh tối đa là 3MB.')
            return
        }

        setSourceFile(file)
        await processAndUploadFile(file, autoRemoveBg, tolerance)
    }

    function handleToggleRemoveBg(event) {
        const nextChecked = event.target.checked
        setAutoRemoveBg(nextChecked)
        if (sourceFile) {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            void processAndUploadFile(sourceFile, nextChecked, tolerance)
        }
    }

    function handleToleranceChange(event) {
        const nextTol = Number(event.target.value)
        setTolerance(nextTol)
        if (sourceFile && autoRemoveBg) {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            debounceRef.current = setTimeout(() => {
                void processAndUploadFile(sourceFile, true, nextTol)
            }, 320)
        }
    }

    function handleClearImage() {
        processSeqRef.current += 1
        if (debounceRef.current) clearTimeout(debounceRef.current)
        setSourceFile(null)
        setIsBgRemoved(false)
        setUploadError('')
        replaceLocalPreview('')
        onImageUrlChange('')
    }

    const previewSrc = localPreviewUrl || resolveMediaUrl(imageUrl)

    return (
        <section className="mgmt-card mgmt-image-card" aria-label="Ảnh sản phẩm">
            <div className="mgmt-card__head" style={{ marginBottom: 12 }}>
                <h2>Ảnh sản phẩm</h2>
                {isBgRemoved && previewSrc && (
                    <span className="mgmt-badge mgmt-badge--success">
                        Đã tách nền PNG
                    </span>
                )}
            </div>

            <div
                className={`mgmt-image-stage ${
                    isBgRemoved && previewSrc ? 'is-transparent-grid' : ''
                }`}
            >
                {previewSrc ? (
                    <img
                        src={previewSrc}
                        alt="Xem trước ảnh sản phẩm"
                        onError={handleImageError}
                    />
                ) : (
                    <div className="mgmt-image-stage__empty">
                        <LucideIcon name="package" size={34} strokeWidth={1.4} />
                        <strong>Chưa có ảnh sản phẩm</strong>
                        <span>Tải ảnh từ máy để xem trước kết quả tách nền</span>
                    </div>
                )}
            </div>

            <div className="mgmt-image-options">
                <label className="mgmt-image-toggle">
                    <input
                        type="checkbox"
                        checked={autoRemoveBg}
                        disabled={uploadingImage || saving}
                        onChange={handleToggleRemoveBg}
                    />
                    <span>Tự động tách nền khi tải ảnh lên</span>
                </label>

                {sourceFile && autoRemoveBg && (
                    <label className="mgmt-image-slider">
                        <span>
                            Độ nhạy tách nền: <strong>{tolerance}</strong>
                        </span>
                        <input
                            type="range"
                            min="15"
                            max="75"
                            step="1"
                            value={tolerance}
                            disabled={saving}
                            onChange={handleToleranceChange}
                        />
                    </label>
                )}
            </div>

            <div className="mgmt-image-controls">
                <div className="mgmt-head__actions">
                    <label
                        className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                        style={{
                            cursor:
                                uploadingImage || saving
                                    ? 'not-allowed'
                                    : 'pointer',
                            opacity: uploadingImage || saving ? 0.65 : 1,
                        }}
                    >
                        <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp,image/gif"
                            hidden
                            disabled={uploadingImage || saving}
                            onChange={handleFileSelect}
                        />
                        {uploadingImage
                            ? 'Đang xử lý & tải ảnh…'
                            : previewSrc
                              ? 'Đổi ảnh khác'
                              : 'Tải ảnh từ máy'}
                    </label>

                    {previewSrc && (
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                            disabled={uploadingImage || saving}
                            onClick={handleClearImage}
                        >
                            Xóa ảnh
                        </button>
                    )}
                </div>

                <label
                    htmlFor={`${idPrefix}-image-url`}
                    style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}
                >
                    Đường dẫn ảnh (URL)
                </label>
                <input
                    id={`${idPrefix}-image-url`}
                    name="imageUrl"
                    type="text"
                    className="mgmt-input"
                    value={imageUrl}
                    onChange={(event) => {
                        setUploadError('')
                        setSourceFile(null)
                        setIsBgRemoved(false)
                        replaceLocalPreview('')
                        onImageUrlChange(event.target.value)
                    }}
                    disabled={saving || uploadingImage}
                    maxLength={500}
                    placeholder="https://... hoặc /images/products/..."
                />

                <small className="mgmt-image-hint">
                    Hỗ trợ tệp PNG, JPG, WEBP, GIF tối đa 3MB hoặc dán đường dẫn ảnh.
                </small>

                {uploadError && (
                    <p
                        className="mgmt-form__error"
                        role="alert"
                        style={{ margin: 0 }}
                    >
                        {uploadError}
                    </p>
                )}
            </div>
        </section>
    )
}
