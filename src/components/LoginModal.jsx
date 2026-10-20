import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import users from '../data/users'
import { useAuth } from '../context/AuthContext'
import './LoginModal.css'

function LoginModal({ onClose }) {
    const { setCurrentUser } = useAuth()
    const navigate = useNavigate()

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')

    const handleSubmit = (event) => {
        event.preventDefault()

        const user = users.find(
            (item) =>
                item.username === username &&
                item.password === password
        )

        if (!user) {
            setError('Tên đăng nhập hoặc mật khẩu không đúng.')
            return
        }

        setError('')
        setCurrentUser(user)
        onClose()

        if (user.role === 'WAREHOUSE_MANAGER') {
            navigate('/inventory')
        } else if (user.role === 'ADMIN') {
            navigate('/admin/products')
        }
        // CUSTOMER: ở lại trang hiện tại
    }

    return (
        <div
            className="login-modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) {
                    onClose()
                }
            }}
        >
            <div
                className="login-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="login-modal-title"
            >
                <button
                    type="button"
                    className="login-modal-close"
                    onClick={onClose}
                    aria-label="Đóng đăng nhập"
                >
                    ×
                </button>

                {/* CỘT TRÁI: GIỚI THIỆU */}
                <div className="login-modal-intro">
                    <div className="login-modal-brand">
                        Multi-Warehouse
                    </div>

                    <h2>Chào mừng bạn trở lại!</h2>

                    <p>
                        Khám phá sản phẩm công nghệ và mua sắm
                        thuận tiện trên hệ thống Multi-Warehouse.
                    </p>

                    <div className="login-modal-benefits">
                        <div>✓ Khám phá sản phẩm công nghệ đa dạng</div>
                        <div>✓ Quản lý và theo dõi đơn hàng dễ dàng</div>
                        <div>✓ Hệ thống quản lý kho hàng hiệu quả</div>
                    </div>
                </div>

                {/* CỘT PHẢI: FORM ĐĂNG NHẬP */}
                <div className="login-modal-content">
                    <div className="login-modal-header">
                        <h2 id="login-modal-title">Đăng nhập</h2>
                        <p>Đăng nhập vào tài khoản của bạn</p>
                    </div>

                    <form
                        className="login-modal-form"
                        onSubmit={handleSubmit}
                    >
                        <div className="login-modal-field">
                            <label htmlFor="modal-username">
                                Tên đăng nhập
                            </label>

                            <input
                                id="modal-username"
                                type="text"
                                placeholder="Nhập tên đăng nhập"
                                autoComplete="username"
                                autoFocus
                                required
                                value={username}
                                onChange={(event) => {
                                    setUsername(event.target.value)
                                    setError('')
                                }}
                            />
                        </div>

                        <div className="login-modal-field">
                            <label htmlFor="modal-password">
                                Mật khẩu
                            </label>

                            <div className="login-password-wrapper">
                                <input
                                    id="modal-password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Nhập mật khẩu"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(event) => {
                                        setPassword(event.target.value)
                                        setError('')
                                    }}
                                />

                                <button
                                    type="button"
                                    className="login-password-toggle"
                                    onClick={() => setShowPassword(!showPassword)}
                                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                >
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <p className="login-modal-error" role="alert">
                                {error}
                            </p>
                        )}

                        <button
                            className="login-modal-submit"
                            type="submit"
                        >
                            Đăng nhập
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
export default LoginModal