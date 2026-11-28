import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useWishlist } from '../context/WishlistContext'
import { getWheelVouchersApi } from '../services/wheelApi.js'
import LucideIcon from './LucideIcon'
import './VoucherWalletModal.css'

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000

function VoucherWalletModal({ onClose, onRequireLogin }) {
    const { currentUser, token } = useAuth()
    const { cartItems } = useCart()
    const { showToast } = useWishlist()
    const navigate = useNavigate()

    const [vouchers, setVouchers] = useState([])
    const [loading, setLoading] = useState(Boolean(token && currentUser?.role === 'CUSTOMER'))
    const [error, setError] = useState('')
    const [tab, setTab] = useState('ACTIVE') // 'ACTIVE' | 'HISTORY'
    const [copiedId, setCopiedId] = useState(null)
    const [nowMs] = useState(() => Date.now())

    useEffect(() => {
        if (!token || currentUser?.role !== 'CUSTOMER') {
            return undefined
        }
        const controller = new AbortController()
        getWheelVouchersApi(token, { signal: controller.signal })
            .then((data) => {
                setVouchers(data?.vouchers || [])
                setError('')
            })
            .catch((err) => {
                if (!controller.signal.aborted) {
                    setError(err.message || 'Không thể tải danh sách mã giảm giá.')
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) {
                    setLoading(false)
                }
            })
        return () => controller.abort()
    }, [token, currentUser?.role])

    useEffect(() => {
        const handleKey = (e) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleKey)
        return () => window.removeEventListener('keydown', handleKey)
    }, [onClose])

    const activeVouchers = vouchers.filter((v) => v.isUsable)
    const historyVouchers = vouchers.filter((v) => !v.isUsable)
    const visibleList = tab === 'ACTIVE' ? activeVouchers : historyVouchers

    function handleReopenWheel() {
        const dismissKey = currentUser
            ? `mw_wheel_hidden_${currentUser.id}`
            : 'mw_wheel_hidden_guest'
        sessionStorage.removeItem(dismissKey)
        window.dispatchEvent(new CustomEvent('mw:open-lucky-wheel'))
        onClose()
    }

    function handleCopy(voucher) {
        navigator.clipboard?.writeText(voucher.code).catch(() => {})
        setCopiedId(voucher.id)
        showToast(`Đã sao chép mã ${voucher.code}`)
        setTimeout(() => {
            setCopiedId((curr) => (curr === voucher.id ? null : curr))
        }, 1800)
    }

    function handleUseVoucher(voucher) {
        onClose()
        if (cartItems.length > 0) {
            navigate('/checkout', { state: { voucherCode: voucher.code } })
        } else {
            navigator.clipboard?.writeText(voucher.code).catch(() => {})
            showToast(`Đã sao chép mã ${voucher.code}. Hãy thêm sản phẩm vào giỏ để áp dụng!`)
            navigate('/products')
        }
    }

    return (
        <div
            className="vw-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="vw-modal-title"
            onClick={onClose}
        >
            <div className="vw-modal" onClick={(e) => e.stopPropagation()}>
                <div className="vw-head">
                    <div className="vw-head-left">
                        <LucideIcon name="ticket" size={20} strokeWidth={1.8} />
                        <h2 id="vw-modal-title" className="vw-title">
                            Ví mã giảm giá
                        </h2>
                        {currentUser?.role === 'CUSTOMER' && (
                            <span className="vw-count-pill">
                                {activeVouchers.length} khả dụng
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        className="vw-close-btn"
                        onClick={onClose}
                        aria-label="Đóng ví mã giảm giá"
                    >
                        <LucideIcon name="x" size={18} strokeWidth={1.8} />
                    </button>
                </div>

                <div className="vw-body">
                    {/* Banner bật lại Vòng quay may mắn nếu khách lỡ bấm tắt */}
                    {(!currentUser || currentUser.role === 'CUSTOMER') && (
                        <div className="vw-wheel-banner">
                            <div className="vw-wheel-banner-text">
                                <h3>Vòng quay may mắn 5% – 20%</h3>
                                <p>
                                    Lỡ tắt nút vòng quay ở góc màn hình hoặc chưa quay? Bấm để bật lại và quay ngay.
                                </p>
                            </div>
                            <button
                                type="button"
                                className="vw-wheel-reopen-btn"
                                onClick={handleReopenWheel}
                            >
                                Bật &amp; Mở vòng quay
                            </button>
                        </div>
                    )}

                    {!currentUser ? (
                        <div className="vw-empty">
                            <p>
                                Đăng nhập tài khoản khách hàng để xem và sử dụng các mã giảm giá bạn đã quay trúng.
                            </p>
                            <button
                                type="button"
                                className="vw-wheel-reopen-btn"
                                onClick={() => {
                                    onClose()
                                    onRequireLogin?.()
                                }}
                            >
                                Đăng nhập ngay
                            </button>
                        </div>
                    ) : currentUser.role !== 'CUSTOMER' ? (
                        <div className="vw-empty">
                            <p>Ví mã giảm giá chỉ áp dụng cho tài khoản khách hàng.</p>
                        </div>
                    ) : (
                        <>
                            <div className="vw-tabs" role="tablist">
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === 'ACTIVE'}
                                    className={`vw-tab${tab === 'ACTIVE' ? ' is-active' : ''}`}
                                    onClick={() => setTab('ACTIVE')}
                                >
                                    Có thể dùng ({activeVouchers.length})
                                </button>
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={tab === 'HISTORY'}
                                    className={`vw-tab${tab === 'HISTORY' ? ' is-active' : ''}`}
                                    onClick={() => setTab('HISTORY')}
                                >
                                    Đã dùng / Hết hạn ({historyVouchers.length})
                                </button>
                            </div>

                            {loading ? (
                                <div className="vw-empty">Đang tải danh sách mã giảm giá...</div>
                            ) : error ? (
                                <div className="vw-empty" role="alert">
                                    {error}
                                </div>
                            ) : visibleList.length === 0 ? (
                                <div className="vw-empty">
                                    <p>
                                        {tab === 'ACTIVE'
                                            ? 'Bạn chưa có mã giảm giá khả dụng nào.'
                                            : 'Chưa có mã nào đã sử dụng hoặc hết hạn.'}
                                    </p>
                                    {tab === 'ACTIVE' && (
                                        <button
                                            type="button"
                                            className="vw-wheel-reopen-btn"
                                            onClick={handleReopenWheel}
                                        >
                                            Quay nhận mã giảm giá ngay
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="vw-list">
                                    {visibleList.map((voucher) => {
                                        const expMs = new Date(voucher.expiresAt).getTime()
                                        const expiringSoon =
                                            voucher.isUsable && expMs - nowMs <= THREE_DAYS_MS
                                        return (
                                            <article
                                                key={voucher.id}
                                                className={`vw-ticket${
                                                    voucher.isUsable ? '' : ' is-inactive'
                                                }`}
                                            >
                                                <div className="vw-ticket-stub">
                                                    <span className="vw-ticket-percent">
                                                        -{voucher.discountPercent}%
                                                    </span>
                                                    <span className="vw-ticket-tag">Toàn đơn</span>
                                                </div>

                                                <div className="vw-ticket-main">
                                                    <div className="vw-ticket-top">
                                                        <span className="vw-ticket-code">
                                                            {voucher.code}
                                                        </span>
                                                        {voucher.isUsable && (
                                                            <button
                                                                type="button"
                                                                className="vw-copy-btn"
                                                                onClick={() => handleCopy(voucher)}
                                                            >
                                                                {copiedId === voucher.id
                                                                    ? 'Đã chép'
                                                                    : 'Sao chép'}
                                                            </button>
                                                        )}
                                                    </div>

                                                    <p className="vw-ticket-desc">
                                                        Giảm {voucher.discountPercent}% tổng giá trị đơn hàng • Áp dụng mọi kho xuất hàng
                                                    </p>

                                                    <div className="vw-ticket-foot">
                                                        <span className="vw-ticket-expiry">
                                                            HSD:{' '}
                                                            {new Date(voucher.expiresAt).toLocaleDateString('vi-VN')}
                                                            {expiringSoon && <strong>• Sắp hết hạn</strong>}
                                                        </span>

                                                        {voucher.isUsable ? (
                                                            <button
                                                                type="button"
                                                                className="vw-use-btn"
                                                                onClick={() => handleUseVoucher(voucher)}
                                                            >
                                                                Dùng ngay
                                                            </button>
                                                        ) : (
                                                            <span className="vw-status-badge">
                                                                {voucher.status === 'USED'
                                                                    ? voucher.usedOrderId
                                                                        ? `Đã dùng (#${voucher.usedOrderId})`
                                                                        : 'Đã sử dụng'
                                                                    : 'Đã hết hạn'}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </article>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

export default VoucherWalletModal
