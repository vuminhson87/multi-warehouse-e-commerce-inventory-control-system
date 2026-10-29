import { Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import './CheckoutPage.css'
import { useState } from 'react'
import { createOrderApi } from '../services/orderApi.js'
import { acquireCheckoutKey, clearCheckoutKey } from '../services/requestKeys.js'

function CheckoutPage() {
    const { cartItems, clearCart, fulfillmentWarehouse } = useCart()
    const { currentUser, token, authLoading } = useAuth()

    const [submitting, setSubmitting] = useState(false)
    const navigate = useNavigate()

    const totalPrice = cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    )

    const hasDiscontinuedItems = cartItems.some((item) => item.isDiscontinued)
    const hasInsufficientStockItems = cartItems.some(
        (item) => item.isOutOfStock || item.isInsufficientStock
    )
    const isOrderUnfulfillable =
        cartItems.length > 0 && !fulfillmentWarehouse

    if (authLoading) {
        return (
            <div className="checkout-page">
                <div className="checkout-content">
                    <p>Đang kiểm tra phiên...</p>
                </div>
            </div>
        )
    }

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <>
                <div className="checkout-page">
                    <div className="checkout-content">
                        <h1>Không có quyền truy cập</h1>
                        <p>Chức năng thanh toán chỉ dành cho khách hàng.</p>
                    </div>
                </div>
            </>
        )
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

        setSubmitting(true)
        try {
            const key = acquireCheckoutKey(currentUser.id, cartItems)
            const data = await createOrderApi(token, cartItems, key)
            if (!data?.orderId) throw new Error('Backend không trả về orderId.')

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
        <>
            <div className="checkout-page">
                <h1>Xác nhận đơn hàng</h1>

                {cartItems.length === 0 ? (
                    <div className="checkout-content">
                        <p>Giỏ hàng đang trống. Không thể thanh toán.</p>
                    </div>
                ) : (
                    <div className="checkout-content">
                        <h2>Thông tin đơn hàng</h2>

                        {cartItems.map((item) => (
                            <div className="checkout-item" key={item.id}>
                                <h3>
                                    {item.name}
                                    {item.isDiscontinued && (
                                        <span
                                            style={{
                                                color: '#dc2626',
                                                fontSize: '0.85rem',
                                                marginLeft: '10px',
                                            }}
                                        >
                                            [Đã ngừng kinh doanh]
                                        </span>
                                    )}
                                    {!item.isDiscontinued && item.isOutOfStock && (
                                        <span
                                            style={{
                                                color: '#b45309',
                                                fontSize: '0.85rem',
                                                marginLeft: '10px',
                                            }}
                                        >
                                            [Dự kiến hết hàng trên dữ liệu tạm]
                                        </span>
                                    )}
                                    {!item.isDiscontinued &&
                                        !item.isOutOfStock &&
                                        item.isInsufficientStock && (
                                            <span
                                                style={{
                                                    color: '#b45309',
                                                    fontSize: '0.85rem',
                                                    marginLeft: '10px',
                                                }}
                                            >
                                                [Dự kiến tồn khả dụng chỉ còn {item.availableStock}]
                                            </span>
                                        )}
                                </h3>

                                <p>
                                    Đơn giá: {item.price.toLocaleString('vi-VN')} VNĐ
                                </p>

                                <p>Số lượng: {item.quantity}</p>

                                <p>
                                    Thành tiền:{' '}
                                    {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                                </p>
                            </div>
                        ))}

                        <div className="checkout-total">
                            Tổng tạm tính (sẽ xác nhận theo giá server): {totalPrice.toLocaleString('vi-VN')} VNĐ
                        </div>

                        {hasDiscontinuedItems && (
                            <p
                                style={{
                                    color: '#dc2626',
                                    fontWeight: 'bold',
                                    marginTop: '15px',
                                }}
                            >
                                Đơn hàng có sản phẩm đã ngừng kinh doanh. Vui lòng
                                quay lại giỏ hàng và xóa sản phẩm trước khi đặt
                                hàng.
                            </p>
                        )}

                        {hasInsufficientStockItems && (
                            <p
                                style={{
                                    color: '#b45309',
                                    fontWeight: 'bold',
                                    marginTop: '15px',
                                }}
                            >
                                Dữ liệu tạm thời trên trình duyệt ghi nhận có sản phẩm
                                vượt tồn kho dự kiến. Hệ thống sẽ kiểm tra tồn kho thực tế
                                trên máy chủ khi gửi đơn.
                            </p>
                        )}

                        {fulfillmentWarehouse && (
                            <div
                                style={{
                                    background: '#f0fdf4',
                                    border: '1px solid #86efac',
                                    padding: '14px 18px',
                                    borderRadius: '8px',
                                    marginTop: '15px',
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        color: '#166534',
                                        fontSize: '1.05rem',
                                    }}
                                >
                                    ✓ Dự kiến kho tiếp nhận xử lý:{' '}
                                    {fulfillmentWarehouse.name}
                                </h3>
                                <p
                                    style={{
                                        margin: '6px 0 0',
                                        color: '#15803d',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    Dự kiến kho {fulfillmentWarehouse.name} đáp ứng đơn hàng;
                                    hệ thống sẽ xác nhận kho và tồn kho thực tế khi gửi đơn
                                    (Single-Warehouse Fulfillment - BR-01).
                                </p>
                            </div>
                        )}

                        {isOrderUnfulfillable && (
                            <div
                                style={{
                                    background: '#fffbeb',
                                    border: '1px solid #fcd34d',
                                    padding: '14px 18px',
                                    borderRadius: '8px',
                                    marginTop: '15px',
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        color: '#92400e',
                                        fontSize: '1.05rem',
                                    }}
                                >
                                    ℹ️ Chưa xác định được kho dự kiến trên dữ liệu tạm
                                </h3>
                                <p
                                    style={{
                                        margin: '6px 0 0',
                                        color: '#78350f',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    Quy tắc hệ thống yêu cầu một đơn hàng phải
                                    được giao trọn vẹn từ 1 kho duy nhất. Máy chủ
                                    sẽ kiểm tra và chọn kho thực tế khi bạn xác nhận đặt hàng.
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            className="checkout-button"
                            disabled={
                                submitting ||
                                cartItems.length === 0 ||
                                hasDiscontinuedItems
                            }
                            onClick={handleConfirmOrder}
                        >
                            {submitting ? 'Đang tạo đơn hàng...' : 'Xác nhận đặt hàng'}
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}

export default CheckoutPage
