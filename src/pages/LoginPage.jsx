import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import users from '../data/users'
import { useAuth } from '../context/AuthContext'
import './LoginPage.css'


function LoginPage() {
    const { setCurrentUser } = useAuth()
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const navigate = useNavigate()

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

        if (user.role === 'CUSTOMER') {
            navigate('/products')
        } else if (user.role === 'WAREHOUSE_MANAGER') {
            navigate('/inventory')
        } else if (user.role === 'ADMIN') {
            navigate('/admin/products')
        }
    }

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <h1>Multi-Warehouse</h1>
                    <p>Đăng nhập vào hệ thống</p>
                </div>

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

                    <button className="login-button" type="submit">
                        Đăng nhập
                    </button>
                </form>
            </div>
        </div>
    )
}

export default LoginPage