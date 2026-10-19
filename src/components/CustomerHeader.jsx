import { Link, NavLink } from 'react-router-dom'
import './CustomerHeader.css'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

function CustomerHeader() {
    const { cartItems } = useCart()
    const { currentUser, setCurrentUser } = useAuth()

    const cartCount = cartItems.reduce(
        (total, item) => total + item.quantity, 0
    )
    return (
        <header className="customer-header">
            <div className="header-logo">
                <Link to="/">Multi-Warehouse</Link>
            </div>

            <nav className="header-nav">
                <NavLink to="/" end>
                    Trang chủ
                </NavLink>

                <NavLink to="/products">
                    Sản phẩm
                </NavLink>

                <NavLink
                    to="/cart"
                    className="header-cart"
                    aria-label="Giỏ hàng"
                    title="Giỏ hàng"
                >
                    <span className="header-cart-label">Giỏ hàng</span>
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                    >
                        <circle cx="9" cy="21" r="1" />
                        <circle cx="20" cy="21" r="1" />
                        <path d="M1 1h4l2.5 13h12l2.5-9H6" />
                    </svg>

                    <span className="header-cart-count">
                        {cartCount}
                    </span>
                </NavLink>

                {currentUser && (
                    <NavLink to="/orders">
                        Đơn hàng
                    </NavLink>
                )}
                {currentUser ? (
                    <Link
                        to="/products"
                        onClick={() => setCurrentUser(null)}
                    >
                        Đăng xuất
                    </Link>
                ) : (
                    <Link
                        to="/login"
                        className="header-account"
                        aria-label="Đăng nhập"
                        title="Đăng nhập"
                    >
                        <span className="header-account-label">Đăng nhập</span>
                        <svg
                            width="24"
                            height="24"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden="true"
                        >
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
                        </svg>
                    </Link>
                )}
            </nav>
        </header>
    )
}

export default CustomerHeader