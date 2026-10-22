import { Navigate, useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrderContext'
import './CheckoutPage.css'

function CheckoutPage() {
    const { cartItems, clearCart, fulfillmentWarehouse } = useCart()
    const { currentUser } = useAuth()
    const { createOrderFromCart } = useOrders()
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
    const hasInvalidItems =
        hasDiscontinuedItems ||
        hasInsufficientStockItems ||
        isOrderUnfulfillable

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
    const handleConfirmOrder = () => {
        const result = createOrderFromCart(cartItems)

        if (!result.ok) {
            alert(result.message)
            return
        }

        // Xóa giỏ hàng sau khi đã tạo đơn và tạm giữ tồn kho thành công
        clearCart()

        // Chuyển sang trang kết quả đơn hàng để thực hiện thanh toán giả lập (Mock Payment)
        navigate('/order-result', {
            state: { orderId: result.order.id },
        })
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
                                                color: '#dc2626',
                                                fontSize: '0.85rem',
                                                marginLeft: '10px',
                                            }}
                                        >
                                            [Đã hết hàng]
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
                                                [Tồn khả dụng chỉ còn {item.availableStock}]
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
                            Tổng thanh toán: {totalPrice.toLocaleString('vi-VN')} VNĐ
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
                                    color: '#dc2626',
                                    fontWeight: 'bold',
                                    marginTop: '15px',
                                }}
                            >
                                Đơn hàng có sản phẩm không đủ tồn kho hoặc đã hết
                                hàng. Vui lòng quay lại giỏ hàng để cập nhật số
                                lượng.
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
                                    ✓ Kho tiếp nhận xử lý:{' '}
                                    {fulfillmentWarehouse.name}
                                </h3>
                                <p
                                    style={{
                                        margin: '6px 0 0',
                                        color: '#15803d',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    Kho này có đủ tồn kho để đáp ứng toàn bộ các
                                    mặt hàng trong đơn theo quy định của hệ thống
                                    (Single-Warehouse Fulfillment - BR-01).
                                </p>
                            </div>
                        )}

                        {isOrderUnfulfillable && (
                            <div
                                style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    padding: '14px 18px',
                                    borderRadius: '8px',
                                    marginTop: '15px',
                                }}
                            >
                                <h3
                                    style={{
                                        margin: 0,
                                        color: '#991b1b',
                                        fontSize: '1.05rem',
                                    }}
                                >
                                    ⚠️ Không thể đặt hàng: Không có kho nào đủ
                                    toàn bộ đơn hàng!
                                </h3>
                                <p
                                    style={{
                                        margin: '6px 0 0',
                                        color: '#7f1d1d',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    Quy tắc hệ thống yêu cầu một đơn hàng phải
                                    được giao trọn vẹn từ 1 kho duy nhất. Hiện
                                    không có kho nào có đủ toàn bộ số lượng các
                                    món trong đơn hàng. Vui lòng quay lại giỏ hàng
                                    để điều chỉnh số lượng.
                                </p>
                            </div>
                        )}

                        <button
                            type="button"
                            className="checkout-button"
                            disabled={hasInvalidItems}
                            onClick={handleConfirmOrder}
                        >
                            Xác nhận đặt hàng
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}

export default CheckoutPage
