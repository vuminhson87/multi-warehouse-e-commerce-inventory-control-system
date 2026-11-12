import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
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
        } catch (error) {
            setError(error.message || 'Đăng nhập thất bại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <h1>Multi-Warehouse</h1>
                    <p>Đăng nhập vào hệ thống</p>
                </div>

                {registered && <p className="login-success" role="status">Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.</p>}

                <form className="login-form" onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="username">Tên đăng nhập</label>
                        <input
                            id="username"
                            type="text"
                            placeholder="Nhập tên đăng nhập"
                            value={username}
                            onChange={(event) => setUsername(event.target.value)}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">Mật khẩu</label>
                        <input
                            id="password"
                            type="password"
                            placeholder="Nhập mật khẩu"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                        />
                    </div>

                    {error && <p className="login-error">{error}</p>}

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
                    <button type="button" onClick={() => setIsRegisterOpen(true)}>Đăng ký</button>
                </p>
            </div>
            {isRegisterOpen && (
                <RegisterModal
                    onClose={() => setIsRegisterOpen(false)}
                    onSwitchToLogin={() => setIsRegisterOpen(false)}
                    onSuccess={registeredUsername => {
                        setIsRegisterOpen(false)
                        setUsername(registeredUsername)
                        navigate('/login', { replace: true, state: { registered: true, username: registeredUsername } })
                    }}
                />
            )}
        </div>
    )
}

export default LoginPage
