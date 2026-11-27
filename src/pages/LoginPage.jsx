import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import RegisterModal from '../components/RegisterModal'
import './LoginPage.css'

function LoginPage() {
    const { login } = useAuth()
    const location = useLocation()
    const registered = location.state?.registered === true
    const [submitting, setSubmitting] = useState(false)
    const [username, setUsername] = useState(location.state?.username ?? '')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isRegisterOpen, setIsRegisterOpen] = useState(false)

    const navigate = useNavigate()

    const handleSubmit = async (event) => {
        event.preventDefault()

        if (submitting) return

        setSubmitting(true)
        setError('')

        try {
            const user = await login(username.trim(), password)

            if (user.role === 'CUSTOMER') {
                navigate('/products')
            } else if (user.role === 'WAREHOUSE_MANAGER') {
                navigate('/inventory')
            } else if (user.role === 'ADMIN') {
                navigate('/admin')
            }
        } catch (err) {
            setError(err.message || 'Đăng nhập thất bại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-split-card">
                <div className="login-split-intro">
                    <div className="login-split-brand">Multi-Warehouse</div>
                    <img
                        src="/images/auth-warehouse-network.jpg"
                        alt="Hệ thống 3 kho hàng Multi-Warehouse"
                        className="login-split-illustration"
                    />
                    <h2>Kiểm soát tồn kho đa kho</h2>
                    <p>
                        Đăng nhập bằng tên tài khoản hoặc Gmail để tiếp tục mua sắm và theo dõi đơn hàng theo thời gian thực.
                    </p>
                </div>

                <div className="login-card">
                    <div className="login-header">
                        <h1>Đăng nhập</h1>
                        <p>Đăng nhập vào hệ thống Multi-Warehouse</p>
                    </div>

                    {registered && (
                        <p className="login-success" role="status">
                            Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.
                        </p>
                    )}

                    <form className="login-form" onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label htmlFor="username">Tên đăng nhập hoặc Gmail</label>
                            <input
                                id="username"
                                type="text"
                                placeholder="Nhập tên đăng nhập hoặc @gmail.com"
                                autoComplete="username"
                                required
                                value={username}
                                onChange={(event) => {
                                    setUsername(event.target.value)
                                    setError('')
                                }}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Mật khẩu</label>
                            <div className="login-page-password-wrap">
                                <input
                                    id="password"
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
                                    className="login-page-password-toggle"
                                    onClick={() => setShowPassword((prev) => !prev)}
                                >
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        {error && <p className="login-error" role="alert">{error}</p>}

                        <button
                            className="login-button"
                            type="submit"
                            disabled={submitting}
                        >
                            {submitting ? 'Đang đăng nhập...' : 'Đăng nhập'}
                        </button>
                    </form>

                    <p className="register-login-link">
                        Chưa có tài khoản?{' '}
                        <button type="button" onClick={() => setIsRegisterOpen(true)}>
                            Đăng ký qua Gmail
                        </button>
                    </p>

                    <p className="register-login-link" style={{ marginTop: '10px' }}>
                        <Link to="/">← Quay về trang chủ</Link>
                    </p>
                </div>
            </div>

            {isRegisterOpen && (
                <RegisterModal
                    onClose={() => setIsRegisterOpen(false)}
                    onSwitchToLogin={() => setIsRegisterOpen(false)}
                    onSuccess={(registeredUsername) => {
                        setIsRegisterOpen(false)
                        setUsername(registeredUsername)
                        navigate('/login', {
                            replace: true,
                            state: { registered: true, username: registeredUsername },
                        })
                    }}
                />
            )}
        </div>
    )
}

export default LoginPage
