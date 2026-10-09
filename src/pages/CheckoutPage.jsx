
import { Navigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import CustomerHeader from '../components/CustomerHeader'
import './CheckoutPage.css'

function CheckoutPage() {
    const { cartItems } = useCart()
    const { currentUser } = useAuth()

    const totalPrice = cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    )

    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <>
                <CustomerHeader />

                <div className="checkout-page">
                    <div className="checkout-content">
                        <h1>Không có quyền truy cập</h1>
                        <p>Chức năng thanh toán chỉ dành cho khách hàng.</p>
                    </div>
                </div>
            </>
        )
    }

    return (
        <>
            <CustomerHeader />

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
                                <h3>{item.name}</h3>

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

                        <button
                            type="button"
                            className="checkout-button"
                            onClick={() =>
                                alert('Chức năng đặt hàng đang chờ kết nối backend.')
                            }
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
