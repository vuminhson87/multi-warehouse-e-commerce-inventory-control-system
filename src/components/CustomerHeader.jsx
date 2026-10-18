import { Link, useNavigate } from 'react-router-dom'
import './CustomerHeader.css'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

function CustomerHeader() {
    const navigate = useNavigate()
    const { cartItems } = useCart()
    const { currentUser, setCurrentUser } = useAuth()

    const cartCount = cartItems.reduce(
        (total, item) => total + item.quantity, 0
    )
    return (
        <header className="customer-header">
            <div className="header-logo">
                <Link to="/products">Multi-Warehouse</Link>
            </div>

            <form
                className="header-search"
                onSubmit={(e) => {
                    e.preventDefault()

                    const keyword = e.target.search.value.trim()

                    if (keyword) {
                        navigate(`/products?search=${encodeURIComponent(keyword)}`)
                    } else {
                        navigate('/products')
                    }
                }}
            >
                <input
                    type="text"
                    name="search"
                    placeholder="Bạn muốn tìm sản phẩm gì?"
                />
            </form>

            <nav className="header-nav">
                <Link to="/products">Sản phẩm</Link>
                <Link to="/cart">Giỏ hàng ({cartCount})</Link>
                <Link to="/orders">Đơn hàng</Link>
                {currentUser ? (
                    <Link
                        to="/products"
                        onClick={() => setCurrentUser(null)}
                    >
                        Đăng xuất
                    </Link>
                ) : (
                    <Link to="/login">Đăng nhập</Link>
                )}
            </nav>
        </header>
    )
}

export default CustomerHeader