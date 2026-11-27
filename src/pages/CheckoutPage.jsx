import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import ProductImage from '../components/ProductImage'
import { createOrderApi } from '../services/orderApi.js'
import { acquireCheckoutKey, clearCheckoutKey } from '../services/requestKeys.js'
import { getWheelVouchersApi } from '../services/wheelApi.js'
import './CheckoutPage.css'

const VIETNAM_PROVINCES = [
    'TP. Hồ Chí Minh',
    'Hà Nội',
    'Đà Nẵng',
    'Hải Phòng',
    'Cần Thơ',
    'Bình Dương',
    'Đồng Nai',
    'Bà Rịa - Vũng Tàu',
    'Khánh Hòa',
    'Thừa Thiên Huế',
    'Bắc Ninh',
    'Quảng Ninh',
    'Nghệ An',
    'Thanh Hóa',
    'Lâm Đồng',
    'Đắk Lắk',
    'Long An',
    'Tiền Giang',
    'An Giang',
    'Kiên Giang',
    'Tây Ninh',
    'Bình Thuận',
    'Quảng Nam',
    'Bình Định',
    'Gia Lai',
    'Thái Nguyên',
    'Hưng Yên',
    'Vĩnh Phúc',
    'Hải Dương',
    'Nam Định',
    'Tỉnh / Thành phố khác',
]

function CheckoutPage() {
    const { cartItems, clearCart, fulfillmentWarehouse, stockLoading, stockError } = useCart()
    const { currentUser, token, authLoading } = useAuth()
    const location = useLocation()
    const navigate = useNavigate()

    const [submitting, setSubmitting] = useState(false)
    const [vouchers, setVouchers] = useState([])
    const [selectedVoucherCode, setSelectedVoucherCode] = useState(
        () => location.state?.voucherCode || ''
    )

    const [shippingFullName, setShippingFullName] = useState(
        () => currentUser?.fullName || ''
    )
    const [shippingPhone, setShippingPhone] = useState('')
    const [shippingProvince, setShippingProvince] = useState('TP. Hồ Chí Minh')
    const [shippingAddressLine, setShippingAddressLine] = useState('')
    const [shippingNote, setShippingNote] = useState('')
    const [fieldErrors, setFieldErrors] = useState({})

    useEffect(() => {
        if (!token || currentUser?.role !== 'CUSTOMER') return
        const controller = new AbortController()
        getWheelVouchersApi(token, { signal: controller.signal })
            .then((data) => {
                const usable = (data?.vouchers || []).filter((v) => v.isUsable)
                setVouchers(usable)
                if (usable.length > 0) {
                    setSelectedVoucherCode((prev) => {
                        if (prev && usable.some((v) => v.code === prev)) return prev
                        return location.state?.voucherCode &&
                            usable.some((v) => v.code === location.state.voucherCode)
                            ? location.state.voucherCode
                            : ''
                    })
                }
            })
            .catch(() => {})
        return () => controller.abort()
    }, [token, currentUser?.role, location.state?.voucherCode])

    const totalPrice = cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    )

    const selectedVoucher = vouchers.find((v) => v.code === selectedVoucherCode) || null
    const discountAmount = selectedVoucher
        ? Math.min(totalPrice, Math.round((totalPrice * selectedVoucher.discountPercent) / 100))
        : 0
    const finalPrice = Math.max(0, totalPrice - discountAmount)

    const hasDiscontinuedItems = cartItems.some((item) => item.isDiscontinued)
    const hasInsufficientStockItems = cartItems.some(
        (item) => item.isOutOfStock || item.isInsufficientStock
    )
    const isOrderUnfulfillable =
        cartItems.length > 0 && !fulfillmentWarehouse

    if (authLoading) {
        return (
            <div className="checkout-page">
                <div className="checkout-container">
                    <div className="checkout-empty-card">Đang kiểm tra phiên...</div>
                </div>
            </div>
        )
    }

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <div className="checkout-page">
                <div className="checkout-container">
                    <div className="checkout-empty-card">
                        <h2>Không có quyền truy cập</h2>
                        <p>Chức năng thanh toán chỉ dành cho khách hàng.</p>
                    </div>
                </div>
            </div>
        )
    }

    function validateShippingForm() {
        const errors = {}
        const name = shippingFullName.trim()
        const phone = shippingPhone.trim()
        const province = shippingProvince.trim()
        const addressLine = shippingAddressLine.trim()

        if (name.length < 2) {
            errors.fullName = 'Vui lòng nhập họ tên người nhận (tối thiểu 2 ký tự).'
        }
        if (!/^[0-9+\-\s().]{8,20}$/.test(phone)) {
            errors.phone = 'Vui lòng nhập số điện thoại hợp lệ (8–15 chữ số).'
        }
        if (province.length < 2) {
            errors.province = 'Vui lòng chọn Tỉnh / Thành phố.'
        }
        if (addressLine.length < 4) {
            errors.addressLine = 'Vui lòng nhập địa chỉ chi tiết (số nhà, tên đường, phường/xã, quận/huyện).'
        }
        return errors
    }

    // Xử lý xác nhận đặt hàng (UC04: SR-ORD-01..03, BR-01, BR-02)
    const handleConfirmOrder = async () => {
        if (submitting || cartItems.length === 0) return
        if (!token || !currentUser?.id) {
            alert('Vui lòng đăng nhập lại.')
            return
        }
        if (hasDiscontinuedItems) {
            alert('Giỏ hàng có sản phẩm đã ngừng kinh doanh.')
            return
        }
        if (stockLoading || stockError || hasInsufficientStockItems || isOrderUnfulfillable) {
            alert('Tồn kho hiện tại không đáp ứng toàn bộ giỏ hàng từ một kho. Vui lòng quay lại giỏ hàng để kiểm tra.')
            return
        }

        const errors = validateShippingForm()
        setFieldErrors(errors)
        if (Object.keys(errors).length > 0) {
            return
        }

        const shippingAddress = {
            fullName: shippingFullName.trim(),
            phone: shippingPhone.trim(),
            province: shippingProvince.trim(),
            addressLine: shippingAddressLine.trim(),
            ...(shippingNote.trim() ? { note: shippingNote.trim() } : {}),
        }

        setSubmitting(true)
        try {
            const voucherToApply = selectedVoucher ? selectedVoucher.code : null
            const key = acquireCheckoutKey(
                currentUser.id,
                cartItems,
                voucherToApply,
                shippingAddress
            )
            const data = await createOrderApi(
                token,
                cartItems,
                key,
                voucherToApply,
                shippingAddress
            )
            if (!data?.orderId) throw new Error('Hệ thống chưa trả về mã đơn hàng.')

            clearCheckoutKey(currentUser.id)
            clearCart()
            navigate(`/order-result/${data.orderId}`, { replace: true })
        } catch (error) {
            console.error('Checkout failed:', error.code ?? error.message)
            if (error.code === 'REQUEST_OUTCOME_UNKNOWN' || error.status === 503) {
                alert('Chưa xác định kết quả tạo đơn. Không nhấn liên tục; kiểm tra lịch sử đơn hoặc thử lại với cùng yêu cầu.')
            } else {
                alert(error.message || 'Không thể tạo đơn hàng.')
            }
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="checkout-page">
            <div className="checkout-container">
                <div className="checkout-header">
                    <h1>Xác nhận đơn hàng</h1>
                </div>

                {cartItems.length === 0 ? (
                    <div className="checkout-empty-card">
                        <p>Giỏ hàng đang trống. Không thể thanh toán.</p>
                    </div>
                ) : (
                    <div className="checkout-grid">
                        {/* Cột trái: Thông tin sản phẩm (có ảnh) + Địa chỉ giao hàng */}
                        <div className="checkout-left-col">
                            <section className="checkout-card">
                                <h2 className="checkout-card-title">Thông tin đơn hàng</h2>

                                <div className="checkout-item-list">
                                    {cartItems.map((item) => (
                                        <div className="checkout-order-item" key={item.id}>
                                            <div className="checkout-item-thumb">
                                                <ProductImage
                                                    imageUrl={item.imageUrl}
                                                    name={item.name}
                                                />
                                            </div>

                                            <div className="checkout-item-info">
                                                <h3>{item.name}</h3>
                                                <p className="checkout-item-meta">
                                                    Đơn giá: {item.price.toLocaleString('vi-VN')} VNĐ • Số lượng: {item.quantity}
                                                </p>

                                                {item.isDiscontinued && (
                                                    <span className="checkout-item-flag checkout-item-flag--danger">
                                                        Đã ngừng kinh doanh
                                                    </span>
                                                )}
                                                {!item.isDiscontinued && item.isOutOfStock && (
                                                    <span className="checkout-item-flag checkout-item-flag--warning">
                                                        Hiện đã hết hàng
                                                    </span>
                                                )}
                                                {!item.isDiscontinued &&
                                                    !item.isOutOfStock &&
                                                    item.isInsufficientStock && (
                                                        <span className="checkout-item-flag checkout-item-flag--warning">
                                                            Tồn khả dụng tại một kho chỉ còn {item.availableStock}
                                                        </span>
                                                    )}
                                            </div>

                                            <div className="checkout-item-price">
                                                {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="checkout-warehouse-bar">
                                    <span>Tổng sản phẩm: {cartItems.reduce((sum, i) => sum + i.quantity, 0)}</span>
                                    {!stockLoading && !stockError && fulfillmentWarehouse && (
                                        <span className="checkout-warehouse-pill">
                                            ✓ Xuất từ: {fulfillmentWarehouse.name}
                                        </span>
                                    )}
                                    {stockLoading && <span role="status">Đang kiểm tra kho xuất...</span>}
                                </div>

                                {stockError && (
                                    <div className="checkout-alert checkout-alert--danger" role="alert">
                                        Không thể tải tồn kho. Quay lại giỏ hàng và thử tải lại trước khi đặt hàng.
                                    </div>
                                )}

                                {hasDiscontinuedItems && (
                                    <div className="checkout-alert checkout-alert--danger" role="alert">
                                        Đơn hàng có sản phẩm đã ngừng kinh doanh. Vui lòng quay lại giỏ hàng để xóa trước khi đặt hàng.
                                    </div>
                                )}

                                {!stockLoading && !stockError && hasInsufficientStockItems && (
                                    <div className="checkout-alert checkout-alert--warning" role="alert">
                                        Tồn kho hiện tại không đủ cho số lượng trong giỏ. Hãy điều chỉnh số lượng trước khi đặt hàng.
                                    </div>
                                )}

                                {!stockLoading && !stockError && isOrderUnfulfillable && (
                                    <div className="checkout-alert checkout-alert--warning" role="alert">
                                        Không có kho nào đủ hàng cho toàn bộ giỏ hàng. Vui lòng điều chỉnh số lượng hoặc sản phẩm rồi thử lại.
                                    </div>
                                )}
                            </section>

                            <section className="checkout-card">
                                <h2 className="checkout-card-title">Địa chỉ giao hàng</h2>

                                <div className="checkout-form-grid">
                                    <div className="checkout-field">
                                        <label htmlFor="shipping-full-name">
                                            Họ tên người nhận <span>*</span>
                                        </label>
                                        <input
                                            id="shipping-full-name"
                                            type="text"
                                            className={`checkout-input${fieldErrors.fullName ? ' is-error' : ''}`}
                                            placeholder="Nhập họ và tên người nhận"
                                            value={shippingFullName}
                                            onChange={(e) => {
                                                setShippingFullName(e.target.value)
                                                if (fieldErrors.fullName) {
                                                    setFieldErrors((prev) => ({ ...prev, fullName: '' }))
                                                }
                                            }}
                                        />
                                        {fieldErrors.fullName && (
                                            <span className="checkout-field-error">{fieldErrors.fullName}</span>
                                        )}
                                    </div>

                                    <div className="checkout-field">
                                        <label htmlFor="shipping-phone">
                                            Số điện thoại <span>*</span>
                                        </label>
                                        <input
                                            id="shipping-phone"
                                            type="tel"
                                            className={`checkout-input${fieldErrors.phone ? ' is-error' : ''}`}
                                            placeholder="Ví dụ: 0901 234 567"
                                            value={shippingPhone}
                                            onChange={(e) => {
                                                setShippingPhone(e.target.value)
                                                if (fieldErrors.phone) {
                                                    setFieldErrors((prev) => ({ ...prev, phone: '' }))
                                                }
                                            }}
                                        />
                                        {fieldErrors.phone && (
                                            <span className="checkout-field-error">{fieldErrors.phone}</span>
                                        )}
                                    </div>

                                    <div className="checkout-field">
                                        <label htmlFor="shipping-province">
                                            Tỉnh / Thành phố <span>*</span>
                                        </label>
                                        <select
                                            id="shipping-province"
                                            className={`checkout-select${fieldErrors.province ? ' is-error' : ''}`}
                                            value={shippingProvince}
                                            onChange={(e) => {
                                                setShippingProvince(e.target.value)
                                                if (fieldErrors.province) {
                                                    setFieldErrors((prev) => ({ ...prev, province: '' }))
                                                }
                                            }}
                                        >
                                            {VIETNAM_PROVINCES.map((province) => (
                                                <option key={province} value={province}>
                                                    {province}
                                                </option>
                                            ))}
                                        </select>
                                        {fieldErrors.province && (
                                            <span className="checkout-field-error">{fieldErrors.province}</span>
                                        )}
                                    </div>

                                    <div className="checkout-field">
                                        <label htmlFor="shipping-address-line">
                                            Địa chỉ chi tiết <span>*</span>
                                        </label>
                                        <input
                                            id="shipping-address-line"
                                            type="text"
                                            className={`checkout-input${fieldErrors.addressLine ? ' is-error' : ''}`}
                                            placeholder="Số nhà, tên đường, phường/xã, quận/huyện"
                                            value={shippingAddressLine}
                                            onChange={(e) => {
                                                setShippingAddressLine(e.target.value)
                                                if (fieldErrors.addressLine) {
                                                    setFieldErrors((prev) => ({ ...prev, addressLine: '' }))
                                                }
                                            }}
                                        />
                                        {fieldErrors.addressLine && (
                                            <span className="checkout-field-error">{fieldErrors.addressLine}</span>
                                        )}
                                    </div>

                                    <div className="checkout-field checkout-field--full">
                                        <label htmlFor="shipping-note">
                                            Ghi chú giao hàng (tùy chọn)
                                        </label>
                                        <textarea
                                            id="shipping-note"
                                            className="checkout-textarea"
                                            placeholder="Ví dụ: Giao trong giờ hành chính, gọi điện trước khi giao..."
                                            value={shippingNote}
                                            onChange={(e) => setShippingNote(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Cột phải: Thanh toán & áp dụng mã giảm giá */}
                        <aside className="checkout-right-col">
                            <section className="checkout-card">
                                <h2 className="checkout-card-title">Thanh toán</h2>

                                <div className="checkout-voucher-box">
                                    <label htmlFor="checkout-voucher-select">
                                        Mã giảm giá của bạn
                                    </label>
                                    <select
                                        id="checkout-voucher-select"
                                        className="checkout-select"
                                        value={selectedVoucherCode}
                                        onChange={(e) => setSelectedVoucherCode(e.target.value)}
                                    >
                                        <option value="">
                                            {vouchers.length > 0
                                                ? 'Không áp dụng mã giảm giá'
                                                : 'Chưa có mã giảm giá khả dụng'}
                                        </option>
                                        {vouchers.map((v) => (
                                            <option key={v.id} value={v.code}>
                                                {v.code} — Giảm {v.discountPercent}% (HSD:{' '}
                                                {new Date(v.expiresAt).toLocaleDateString('vi-VN')})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="checkout-divider" />

                                <div className="checkout-summary-rows">
                                    <div className="checkout-summary-row">
                                        <span>Tạm tính</span>
                                        <strong>{totalPrice.toLocaleString('vi-VN')} VNĐ</strong>
                                    </div>

                                    <div className="checkout-summary-row checkout-summary-row--discount">
                                        <span>
                                            Giảm giá
                                            {selectedVoucher ? ` (${selectedVoucher.discountPercent}%)` : ''}
                                        </span>
                                        <strong>
                                            {discountAmount > 0
                                                ? `-${discountAmount.toLocaleString('vi-VN')} VNĐ`
                                                : '0 VNĐ'}
                                        </strong>
                                    </div>

                                    <div className="checkout-summary-row checkout-summary-row--free">
                                        <span>Phí giao hàng</span>
                                        <strong>Miễn phí</strong>
                                    </div>
                                </div>

                                <div className="checkout-divider" />

                                <div className="checkout-grand-total">
                                    <span className="checkout-grand-total-label">Tổng thanh toán</span>
                                    <span className="checkout-grand-total-value">
                                        {finalPrice.toLocaleString('vi-VN')} VNĐ
                                    </span>
                                </div>

                                <button
                                    type="button"
                                    className="checkout-button"
                                    disabled={
                                        submitting ||
                                        cartItems.length === 0 ||
                                        hasDiscontinuedItems ||
                                        stockLoading ||
                                        Boolean(stockError) ||
                                        hasInsufficientStockItems ||
                                        isOrderUnfulfillable
                                    }
                                    onClick={handleConfirmOrder}
                                >
                                    {submitting ? 'Đang tạo đơn hàng...' : 'Xác nhận đặt hàng'}
                                </button>
                            </section>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    )
}

export default CheckoutPage
