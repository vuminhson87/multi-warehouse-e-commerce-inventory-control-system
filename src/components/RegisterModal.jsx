import { useEffect, useRef, useState } from 'react'
import { requestRegisterOtpApi, verifyRegisterOtpApi } from '../services/authApi.js'
import {
    deriveUsernameFromGmail,
    formatCountdown,
    prepareOtpRegistrationRequest,
    prepareOtpVerification,
} from '../utils/registrationForm.js'
import './LoginModal.css'

const OTP_LENGTH = 6
const EMPTY_DIGITS = Array(OTP_LENGTH).fill('')

function RegisterModal({ onClose, onSwitchToLogin, onSuccess }) {
    const [step, setStep] = useState('form') // 'form' | 'otp'
    const [email, setEmail] = useState('')
    const [username, setUsername] = useState('')
    const [usernameEdited, setUsernameEdited] = useState(false)
    const [fullName, setFullName] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)

    const [otpDigits, setOtpDigits] = useState(EMPTY_DIGITS)
    const [expiresAtMs, setExpiresAtMs] = useState(0)
    const [resendAvailableAtMs, setResendAvailableAtMs] = useState(0)
    const [secondsLeft, setSecondsLeft] = useState(0)
    const [resendSecondsLeft, setResendSecondsLeft] = useState(0)
    const [deliveryMode, setDeliveryMode] = useState('email')
    const [verifiedPayload, setVerifiedPayload] = useState(null)

    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')
    const [statusMessage, setStatusMessage] = useState('')

    const digitRefs = useRef([])

    useEffect(() => {
        if (step !== 'otp') return undefined

        const updateTimers = () => {
            const now = Date.now()
            setSecondsLeft(Math.max(0, Math.ceil((expiresAtMs - now) / 1000)))
            setResendSecondsLeft(Math.max(0, Math.ceil((resendAvailableAtMs - now) / 1000)))
        }

        const timer = setInterval(updateTimers, 1000)
        return () => clearInterval(timer)
    }, [step, expiresAtMs, resendAvailableAtMs])

    useEffect(() => {
        if (step === 'otp') {
            digitRefs.current[0]?.focus()
        }
    }, [step])

    function handleEmailChange(event) {
        const nextEmail = event.target.value
        setEmail(nextEmail)
        setError('')
        if (!usernameEdited) {
            setUsername(deriveUsernameFromGmail(nextEmail))
        }
    }

    function handleUsernameChange(event) {
        const nextUsername = event.target.value
        setUsername(nextUsername)
        setUsernameEdited(nextUsername.length > 0)
        setError('')
    }

    function applyOtpMetadata(meta, payload) {
        const now = Date.now()
        const ttlSec = Number(meta?.expiresInSeconds) || 180
        const cooldownSec = Number(meta?.cooldownSeconds) || 60
        setVerifiedPayload(payload)
        setEmail(meta?.email ?? payload.email)
        setUsername(meta?.username ?? payload.username)
        setExpiresAtMs(now + ttlSec * 1000)
        setResendAvailableAtMs(now + cooldownSec * 1000)
        setSecondsLeft(ttlSec)
        setResendSecondsLeft(cooldownSec)
        setDeliveryMode(meta?.delivery ?? 'email')
        setOtpDigits(EMPTY_DIGITS)
        setStep('otp')
    }

    async function handleRequestOtp(event) {
        event.preventDefault()
        if (submitting) return

        const { error: validationError, payload } = prepareOtpRegistrationRequest({
            email,
            username,
            fullName,
            password,
            confirmPassword,
        })
        if (validationError) {
            setError(validationError)
            return
        }

        setSubmitting(true)
        setError('')
        setStatusMessage('')
        try {
            const result = await requestRegisterOtpApi(payload)
            applyOtpMetadata(result, payload)
        } catch (requestError) {
            setError(requestError.message || 'Không thể gửi mã xác thực OTP. Vui lòng thử lại.')
        } finally {
            setSubmitting(false)
        }
    }

    async function handleResendOtp() {
        if (submitting || resendSecondsLeft > 0 || !verifiedPayload) return

        setSubmitting(true)
        setError('')
        setStatusMessage('')
        try {
            const result = await requestRegisterOtpApi(verifiedPayload)
            applyOtpMetadata(result, verifiedPayload)
            setStatusMessage('Đã gửi lại mã OTP 6 chữ số mới tới Gmail của bạn.')
        } catch (requestError) {
            setError(requestError.message || 'Không thể gửi lại mã OTP.')
        } finally {
            setSubmitting(false)
        }
    }

    function handleOtpDigitChange(index, rawValue) {
        const digitsOnly = String(rawValue ?? '').replace(/\D/g, '')
        setError('')

        if (digitsOnly.length > 1) {
            const next = [...otpDigits]
            for (let i = 0; i < OTP_LENGTH - index && i < digitsOnly.length; i += 1) {
                next[index + i] = digitsOnly[i]
            }
            setOtpDigits(next)
            const focusIndex = Math.min(OTP_LENGTH - 1, index + digitsOnly.length)
            digitRefs.current[focusIndex]?.focus()
            return
        }

        const next = [...otpDigits]
        next[index] = digitsOnly
        setOtpDigits(next)
        if (digitsOnly && index < OTP_LENGTH - 1) {
            digitRefs.current[index + 1]?.focus()
        }
    }

    function handleOtpKeyDown(index, event) {
        if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
            digitRefs.current[index - 1]?.focus()
        }
    }

    function handleOtpPaste(event) {
        const pasted = event.clipboardData?.getData('text') ?? ''
        const digitsOnly = pasted.replace(/\D/g, '').slice(0, OTP_LENGTH)
        if (!digitsOnly) return
        event.preventDefault()
        const next = Array.from({ length: OTP_LENGTH }, (_, idx) => digitsOnly[idx] ?? '')
        setOtpDigits(next)
        setError('')
        const nextFocus = Math.min(OTP_LENGTH - 1, digitsOnly.length)
        digitRefs.current[nextFocus]?.focus()
    }

    async function handleVerifyOtp(event) {
        event.preventDefault()
        if (submitting || !verifiedPayload) return

        if (secondsLeft <= 0) {
            setError('Mã xác thực OTP đã hết hạn (3 phút). Vui lòng bấm gửi lại mã mới.')
            return
        }

        const joined = otpDigits.join('')
        const { error: otpError, otp } = prepareOtpVerification(joined)
        if (otpError) {
            setError(otpError)
            return
        }

        setSubmitting(true)
        setError('')
        try {
            const result = await verifyRegisterOtpApi({
                ...verifiedPayload,
                otp,
            })
            onSuccess(result?.user?.username || verifiedPayload.username)
        } catch (requestError) {
            setError(requestError.message || 'Xác thực OTP thất bại. Vui lòng kiểm tra lại mã.')
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div
            className="login-modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget) onClose()
            }}
        >
            <div
                className="login-modal register-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="register-modal-title"
            >
                <button
                    type="button"
                    className="login-modal-close"
                    onClick={onClose}
                    aria-label="Đóng đăng ký"
                >
                    ×
                </button>

                <div className="login-modal-intro">
                    <div className="login-modal-brand">Multi-Warehouse</div>

                    <img
                        src="/images/auth-warehouse-network.jpg"
                        alt="Hệ thống 3 kho hàng Multi-Warehouse"
                        className="auth-warehouse-illustration"
                    />

                    <h2>Bắt đầu mua sắm</h2>
                    <p>
                        {step === 'form'
                            ? 'Đăng ký bằng Gmail chính chủ với xác thực OTP 6 chữ số.'
                            : 'Nhập mã OTP 6 chữ số đã gửi về Gmail để kích hoạt tài khoản.'}
                    </p>
                    <div className="login-modal-benefits">
                        <div>✓ Xác thực Gmail an toàn trong 3 phút</div>
                        <div>✓ Khám phá sản phẩm công nghệ đa kho</div>
                        <div>✓ Theo dõi đơn hàng chi tiết theo thời gian thực</div>
                    </div>
                </div>

                <div className="login-modal-content">
                    <div className="login-modal-header">
                        <h2 id="register-modal-title">
                            {step === 'form' ? 'Đăng ký' : 'Xác thực OTP Gmail'}
                        </h2>
                        <p>
                            {step === 'form'
                                ? 'Tạo tài khoản khách hàng mới qua Gmail'
                                : 'Bước 2 / 2 — Nhập mã xác thực 6 chữ số'}
                        </p>
                    </div>

                    {step === 'form' ? (
                        <form className="login-modal-form register-modal-form" onSubmit={handleRequestOtp}>
                            <div className="login-modal-field">
                                <label htmlFor="register-email">Địa chỉ Gmail</label>
                                <input
                                    id="register-email"
                                    type="email"
                                    autoComplete="email"
                                    maxLength={120}
                                    required
                                    autoFocus
                                    placeholder="Ví dụ: duyan746@gmail.com"
                                    value={email}
                                    onChange={handleEmailChange}
                                />
                            </div>

                            <div className="login-modal-field">
                                <label htmlFor="register-username">
                                    Tên đăng nhập <span>(có thể chỉnh sửa)</span>
                                </label>
                                <input
                                    id="register-username"
                                    type="text"
                                    autoComplete="username"
                                    minLength={3}
                                    maxLength={50}
                                    pattern="[A-Za-z0-9_]{3,50}"
                                    title="Dùng 3–50 chữ cái, chữ số hoặc dấu gạch dưới."
                                    required
                                    placeholder="Mặc định lấy phần trước @gmail.com"
                                    value={username}
                                    onChange={handleUsernameChange}
                                />
                                <p className="login-field-hint">
                                    Tự động gợi ý từ phần trước @gmail.com, bạn có thể đổi tùy thích.
                                </p>
                            </div>

                            <div className="login-modal-field">
                                <label htmlFor="register-full-name">
                                    Họ và tên <span>(tùy chọn)</span>
                                </label>
                                <input
                                    id="register-full-name"
                                    type="text"
                                    autoComplete="name"
                                    maxLength={120}
                                    placeholder="Nhập họ và tên"
                                    value={fullName}
                                    onChange={(event) => setFullName(event.target.value)}
                                />
                            </div>

                            <div className="login-modal-field">
                                <label htmlFor="register-password">Mật khẩu</label>
                                <div className="login-password-wrapper">
                                    <input
                                        id="register-password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        minLength={8}
                                        maxLength={72}
                                        required
                                        placeholder="Ít nhất 8 ký tự"
                                        value={password}
                                        onChange={(event) => {
                                            setPassword(event.target.value)
                                            setError('')
                                        }}
                                    />
                                    <button
                                        type="button"
                                        className="login-password-toggle"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                        aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                                    >
                                        {showPassword ? 'Ẩn' : 'Hiện'}
                                    </button>
                                </div>
                            </div>

                            <div className="login-modal-field">
                                <label htmlFor="register-confirm-password">Xác nhận mật khẩu</label>
                                <input
                                    id="register-confirm-password"
                                    type={showPassword ? 'text' : 'password'}
                                    autoComplete="new-password"
                                    minLength={8}
                                    maxLength={72}
                                    required
                                    placeholder="Nhập lại mật khẩu"
                                    value={confirmPassword}
                                    onChange={(event) => {
                                        setConfirmPassword(event.target.value)
                                        setError('')
                                    }}
                                />
                            </div>

                            {error && (
                                <p className="login-modal-error" role="alert">
                                    {error}
                                </p>
                            )}

                            <button className="login-modal-submit" type="submit" disabled={submitting}>
                                {submitting ? 'Đang gửi mã OTP…' : 'Tiếp tục — Gửi mã OTP'}
                            </button>
                        </form>
                    ) : (
                        <form className="login-modal-form" onSubmit={handleVerifyOtp}>
                            <div className="otp-step-banner">
                                Mã xác thực 6 chữ số đã được gửi tới{' '}
                                <strong>{verifiedPayload?.email}</strong>.
                                <br />
                                Tên đăng nhập: <strong>@{verifiedPayload?.username}</strong>
                            </div>

                            {deliveryMode === 'dev-console' && (
                                <p className="otp-dev-notice">
                                    Chế độ phát triển (chưa cấu hình Gmail SMTP trong{' '}
                                    <code>backend/.env</code>): vui lòng xem mã OTP 6 chữ số tại
                                    cửa sổ terminal backend.
                                </p>
                            )}

                            <div className="login-modal-field">
                                <label htmlFor="otp-digit-0">Mã OTP 6 chữ số</label>
                                <div className="otp-digit-grid" onPaste={handleOtpPaste}>
                                    {otpDigits.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            id={`otp-digit-${idx}`}
                                            ref={(el) => {
                                                digitRefs.current[idx] = el
                                            }}
                                            type="text"
                                            inputMode="numeric"
                                            autoComplete={idx === 0 ? 'one-time-code' : 'off'}
                                            maxLength={6}
                                            className="otp-digit-input"
                                            aria-label={`Chữ số OTP thứ ${idx + 1}`}
                                            value={digit}
                                            onChange={(event) =>
                                                handleOtpDigitChange(idx, event.target.value)
                                            }
                                            onKeyDown={(event) => handleOtpKeyDown(idx, event)}
                                        />
                                    ))}
                                </div>
                            </div>

                            <div className="otp-meta-row">
                                <span
                                    className={`otp-countdown ${
                                        secondsLeft <= 0 ? 'is-expired' : ''
                                    }`}
                                >
                                    {secondsLeft > 0
                                        ? `Hiệu lực còn lại: ${formatCountdown(secondsLeft)}`
                                        : 'Mã OTP đã hết hạn (quá 3 phút)'}
                                </span>

                                <button
                                    type="button"
                                    className="otp-link-btn"
                                    disabled={submitting || resendSecondsLeft > 0}
                                    onClick={handleResendOtp}
                                >
                                    {resendSecondsLeft > 0
                                        ? `Gửi lại sau ${resendSecondsLeft}s`
                                        : 'Gửi lại mã OTP'}
                                </button>
                            </div>

                            {statusMessage && (
                                <p className="login-modal-success" style={{ margin: 0 }} role="status">
                                    {statusMessage}
                                </p>
                            )}

                            {error && (
                                <p className="login-modal-error" role="alert">
                                    {error}
                                </p>
                            )}

                            <button
                                className="login-modal-submit"
                                type="submit"
                                disabled={submitting || secondsLeft <= 0}
                            >
                                {submitting ? 'Đang xác thực…' : 'Xác thực & Tạo tài khoản'}
                            </button>

                            <button
                                type="button"
                                className="otp-back-btn"
                                disabled={submitting}
                                onClick={() => {
                                    setStep('form')
                                    setError('')
                                    setStatusMessage('')
                                }}
                            >
                                ← Quay lại sửa thông tin
                            </button>
                        </form>
                    )}

                    <p className="login-modal-register">
                        Đã có tài khoản?{' '}
                        <button type="button" onClick={onSwitchToLogin}>
                            Đăng nhập
                        </button>
                    </p>
                </div>
            </div>
        </div>
    )
}

export default RegisterModal
