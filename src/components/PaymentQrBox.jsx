import { useEffect, useState } from 'react'
import { formatCurrency } from '../constants/order'
import './PaymentQrBox.css'

// Component thanh toán mã QR tách biệt hoàn toàn với 3 nút demo giả lập.
// Nếu sau này không giữ phần QR, chỉ cần xóa PaymentQrBox.jsx + PaymentQrBox.css + backend/src/modules/payment/payment-qr.js.

function formatCountdown(ms) {
    if (ms <= 0) return '00:00'
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function PaymentQrBox({
    order,
    disabled,
    busy,
    onConfirmQrPayment,
}) {
    const qr = order?.paymentQr
    const expiresAtMs = order?.reservationExpiresAt
        ? new Date(order.reservationExpiresAt).getTime()
        : null

    const [nowMs, setNowMs] = useState(() => Date.now())
    const [imgFailed, setImgFailed] = useState(false)
    const [copiedField, setCopiedField] = useState('')

    useEffect(() => {
        if (!expiresAtMs) return undefined
        const timer = setInterval(() => {
            setNowMs(Date.now())
        }, 1000)
        return () => clearInterval(timer)
    }, [expiresAtMs])

    if (!qr) return null

    const remainingMs = expiresAtMs ? Math.max(0, expiresAtMs - nowMs) : 0
    const isExpired = !expiresAtMs || remainingMs <= 0

    function handleCopy(field, value) {
        if (!value) return
        navigator.clipboard?.writeText(String(value)).catch(() => {})
        setCopiedField(field)
        setTimeout(() => {
            setCopiedField((curr) => (curr === field ? '' : curr))
        }, 1800)
    }

    return (
        <section className="payment-qr-card">
            <div className="payment-qr-head">
                <h2 className="payment-qr-title">Quét mã QR chuyển khoản</h2>
                <span className={`payment-qr-timer${isExpired ? ' is-expired' : ''}`}>
                    {isExpired ? 'Hết hạn giữ hàng' : `Giữ hàng: ${formatCountdown(remainingMs)}`}
                </span>
            </div>

            <div className="payment-qr-body">
                <div className="payment-qr-frame">
                    {!imgFailed ? (
                        <img
                            src={qr.qrImageUrl}
                            alt={`Mã QR thanh toán đơn hàng #${order.id}`}
                            onError={() => setImgFailed(true)}
                        />
                    ) : (
                        <div className="payment-qr-fallback">
                            Không tải được ảnh VietQR. Vui lòng chuyển khoản thủ công theo thông tin bên cạnh.
                        </div>
                    )}
                </div>

                <div className="payment-qr-meta">
                    <div className="payment-qr-row">
                        <span className="payment-qr-label">Ngân hàng</span>
                        <span className="payment-qr-value">{qr.bankName}</span>
                    </div>

                    <div className="payment-qr-row">
                        <span className="payment-qr-label">Số tài khoản</span>
                        <div className="payment-qr-value-line">
                            <span className="payment-qr-value payment-qr-value--mono">
                                {qr.accountNo}
                            </span>
                            <button
                                type="button"
                                className="payment-qr-copy"
                                onClick={() => handleCopy('acc', qr.accountNo)}
                            >
                                {copiedField === 'acc' ? 'Đã chép' : 'Sao chép'}
                            </button>
                        </div>
                    </div>

                    <div className="payment-qr-row">
                        <span className="payment-qr-label">Chủ tài khoản</span>
                        <span className="payment-qr-value">{qr.accountName}</span>
                    </div>

                    <div className="payment-qr-row">
                        <span className="payment-qr-label">Số tiền</span>
                        <span className="payment-qr-value">{formatCurrency(qr.amount)}</span>
                    </div>

                    <div className="payment-qr-row">
                        <span className="payment-qr-label">Nội dung chuyển khoản</span>
                        <div className="payment-qr-value-line">
                            <span className="payment-qr-value payment-qr-value--mono">
                                {qr.transferContent}
                            </span>
                            <button
                                type="button"
                                className="payment-qr-copy"
                                onClick={() => handleCopy('note', qr.transferContent)}
                            >
                                {copiedField === 'note' ? 'Đã chép' : 'Sao chép'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <p className="payment-qr-note">
                {isExpired
                    ? 'Hết thời gian giữ chỗ kho 15 phút. Khi bấm xác nhận, hệ thống sẽ tự kiểm tra tồn kho và giữ lại hàng nếu kho còn đủ.'
                    : 'Mở ứng dụng ngân hàng để quét mã VietQR (tự điền đúng số tiền & nội dung). Sau khi quét, bấm nút bên dưới để xác nhận.'}
            </p>

            <button
                type="button"
                className="payment-qr-confirm-btn"
                disabled={disabled}
                onClick={onConfirmQrPayment}
            >
                {busy ? 'Đang xác nhận thanh toán...' : 'Tôi đã quét QR & Thanh toán'}
            </button>
        </section>
    )
}

export default PaymentQrBox
