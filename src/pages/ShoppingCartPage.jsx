import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import './ShoppingCartPage.css'
import CustomerHeader from '../components/CustomerHeader'

function ShoppingCartPage() {
    const {
        cartItems,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
    } = useCart()

    const navigate = useNavigate()
    const totalPrice = cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    )

    return (
        <>
            <CustomerHeader />
            <div className="cart-page">
                <h1>Shopping Cart</h1>

                {cartItems.length === 0 ? (
                    <p>Giỏ hàng đang trống.</p>
                ) : (
                    <div>
                        {cartItems.map((item) => (
                            <div key={item.id}>
                                <h2>{item.name}</h2>

                                <p>
                                    Giá: {item.price.toLocaleString('vi-VN')} VNĐ
                                </p>

                                <div>
                                    <button onClick={() => decreaseQuantity(item.id)}>
                                        -
                                    </button>

                                    <span> Số lượng: {item.quantity} </span>

                                    <button onClick={() => increaseQuantity(item.id)}>
                                        +
                                    </button>
                                    <button onClick={() => removeFromCart(item.id)}>
                                        Xóa
                                    </button>
                                </div>
                            </div>
                        ))}

                        <h2>
                            Tổng tiền: {totalPrice.toLocaleString('vi-VN')} VNĐ
                        </h2>

                        <button onClick={() => navigate('/checkout')}>
                            Tiến hành thanh toán
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}

export default ShoppingCartPage