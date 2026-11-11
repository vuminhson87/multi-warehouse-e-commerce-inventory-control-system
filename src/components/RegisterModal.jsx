import { useState } from 'react'
import { registerApi } from '../services/authApi.js'
import './LoginModal.css'

function RegisterModal({ onClose, onSwitchToLogin, onSuccess }) {
    const [fullName, setFullName] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    async function handleSubmit(event) {
        event.preventDefault()
        if (submitting) return
        if (password !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            await registerApi({ username: username.trim(), password, fullName: fullName.trim() })
            onSuccess(username.trim())
        } catch (requestError) {
            setError(requestError.message || 'Không thể tạo tài khoản. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className="login-modal-overlay"
            onMouseDown={event => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div className="login-modal register-modal" role="dialog" aria-modal="true" aria-labelledby="register-modal-title">
                <button type="button" className="login-modal-close" onClick={onClose} aria-label="Đóng đăng ký">×</button>

                <div className="login-modal-intro">
                    <div className="login-modal-brand">Multi-Warehouse</div>
                    <h2>Bắt đầu mua sắm</h2>
                    <p>Tạo tài khoản khách hàng để đặt hàng và theo dõi đơn mua của bạn.</p>
                    <div className="login-modal-benefits">
                        <div>✓ Khám phá sản phẩm công nghệ đa dạng</div>
                        <div>✓ Theo dõi đơn hàng thuận tiện</div>
                        <div>✓ Quản lý lịch sử mua sắm</div>
                    </div>
                </div>

                <div className="login-modal-content">
                    <div className="login-modal-header">
                        <h2 id="register-modal-title">Đăng ký</h2>
                        <p>Tạo tài khoản khách hàng mới</p>
                    </div>

                    <form className="login-modal-form register-modal-form" onSubmit={handleSubmit}>
                        <div className="login-modal-field">
                            <label htmlFor="register-full-name">Họ và tên <span>(tùy chọn)</span></label>
                            <input id="register-full-name" type="text" autoComplete="name" maxLength={120} placeholder="Nhập họ và tên" value={fullName} onChange={event => setFullName(event.target.value)} />
                        </div>
                        <div className="login-modal-field">
                            <label htmlFor="register-username">Tên đăng nhập</label>
                            <input id="register-username" type="text" autoComplete="username" minLength={3} maxLength={50} pattern="[A-Za-z0-9_]{3,50}" title="Dùng 3–50 chữ cái, chữ số hoặc dấu gạch dưới." required placeholder="Ví dụ: khachhang01" value={username} onChange={event => setUsername(event.target.value)} />
                        </div>
                        <div className="login-modal-field">
                            <label htmlFor="register-password">Mật khẩu</label>
                            <input id="register-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required placeholder="Ít nhất 8 ký tự" value={password} onChange={event => setPassword(event.target.value)} />
                        </div>
                        <div className="login-modal-field">
                            <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
                            <input id="register-confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required placeholder="Nhập lại mật khẩu" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} />
                        </div>

                        {error && <p className="login-modal-error" role="alert">{error}</p>}

                        <button className="login-modal-submit" type="submit" disabled={submitting}>
                            {submitting ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
                        </button>
                    </form>

                    <p className="login-modal-register">
                        Đã có tài khoản?{' '}
                        <button type="button" onClick={onSwitchToLogin}>Đăng nhập</button>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default RegisterModal
