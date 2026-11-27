import { useState } from 'react'
import { useLocation, useParams, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCustomerOrder } from '../hooks/useCustomerOrder.js'
import { payOrderApi } from '../services/orderApi.js'
import { acquireActionKey, clearActionKey } from '../services/requestKeys.js'
import PaymentQrBox from '../components/PaymentQrBox'
import {
    OrderStatus,
    PaymentResult,
    PAYMENT_RESULT_LABELS,
    getOrderStatusLabel,
    formatCurrency,
    formatDateTime,
} from '../constants/order'
import './OrderResultPage.css'

function OrderResultPage() {
    const location = useLocation()
    const { orderId: orderIdFromUrl } = useParams()
    const { currentUser, token, authLoading } = useAuth()
    const [feedback, setFeedback] = useState(null)
    const [busy, setBusy] = useState(false)
    const [needsReconciliation, setNeedsReconciliation] = useState(false)
    const targetOrderId = orderIdFromUrl || location.state?.orderId || null
    const { order, loading, error, reload } = useCustomerOrder(token, targetOrderId)

    if (authLoading) {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state">Đang kiểm tra phiên...</div>
                </div>
            </div>
        )
    }

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state">
                        <h2>Không có quyền truy cập</h2>
                        <p>Trang kết quả đặt hàng chỉ dành cho khách hàng.</p>
                    </div>
                </div>
            </div>
        )
    }

    if (!targetOrderId) {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state">
                        <h2>Kết quả đơn hàng</h2>
                        <p>Không tìm thấy thông tin đơn hàng vừa tạo.</p>
                        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginTop: '16px' }}>
                            <Link to="/orders" className="order-btn order-btn--primary">
                                Xem lịch sử mua hàng
                            </Link>
                            <Link to="/products" className="order-btn order-btn--ghost">
                                Tiếp tục mua hàng
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state">Đang tải thông tin đơn hàng...</div>
                </div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state" role="alert">
                        <p>
                            {error.status === 401
                                ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
                                : error.status === 404
                                    ? 'Không tìm thấy đơn hàng.'
                                    : error.message}
                        </p>
                        <Link to="/orders" className="order-btn order-btn--primary">
                            Quay về lịch sử đơn hàng
                        </Link>
                    </div>
                </div>
            </div>
        )
    }

    if (!order) {
        return (
            <div className="order-result-page">
                <div className="order-result-container">
                    <div className="order-empty-state">
                        <h2>Kết quả đơn hàng</h2>
                        <p>Không tìm thấy thông tin đơn hàng vừa tạo.</p>
                    </div>
                </div>
            </div>
        )
    }

    // Thực hiện thanh toán giả lập (Mock Payment - UC04: SR-PAY-01..04)
    const handleSimulatePayment = async (mode) => {
        if (!order || busy || !order.canPay || needsReconciliation || order.paymentInProgress) return
        const scope = `pay:${currentUser.id}:${order.id}:${mode}`
        setBusy(true)
        setFeedback(null)
        try {
            const key = acquireActionKey(scope)
            const result = await payOrderApi(token, order.id, mode, key)
            clearActionKey(scope) // kết quả đã xác định
            setNeedsReconciliation(false)
            const success = result.paymentStatus === 'SUCCEEDED'
            setFeedback({
                ok: success,
                isWarning: !success,
                message: success
                    ? 'Thanh toán thành công. Tồn kho đã được xác nhận trừ tại kho xuất hàng.'
                    : result.paymentStatus === 'INCOMPLETE'
                        ? 'Thanh toán chưa hoàn tất. Hàng giữ chỗ đã được giải phóng.'
                        : 'Thanh toán thất bại. Bạn có thể thử thanh toán lại nếu kho còn đủ hàng.',
            })
            reload() // phải GET /api/orders/:id lại sau mỗi thay đổi
        } catch (err) {
            // Giữ nguyên idempotency key khi timeout/không rõ kết quả.
            const unknown =
                ['REQUEST_OUTCOME_UNKNOWN', 'PAYMENT_IN_PROGRESS'].includes(err.code) ||
                err.status === 503
            if (unknown) {
                setNeedsReconciliation(true)
            }
            setFeedback({
                ok: false,
                isWarning: true,
                message: unknown
                    ? 'Kết quả chưa xác định/cần đối soát. Không thử thanh toán mới trước khi kiểm tra trạng thái đơn.'
                    : err.message || 'Không thể thanh toán.',
            })
            reload()
        } finally {
            setBusy(false)
        }
    }

    const isPendingPayment = order.status === OrderStatus.PENDING_PAYMENT
    const isPaid = order.status === OrderStatus.PAID
    const isCancelled = order.status === OrderStatus.CANCELLED
    const hasFailedBefore = (order.paymentAttempts?.length || 0) > 0 && isPendingPayment
    const paymentDisabled = busy || !order.canPay || order.paymentInProgress || needsReconciliation

    const statusPillClass = isPaid
        ? 'order-status-pill--paid'
        : isCancelled
            ? 'order-status-pill--cancelled'
            : 'order-status-pill--pending'

    const returnState = { returnToOrderResult: order.id }

    return (
        <div className="order-result-page">
            <div className="order-result-container">
                {/* Tiêu đề trang đồng bộ CheckoutPage */}
                <div className="order-result-header">
                    <div>
                        <h1>
                            {isPaid
                                ? `Đơn hàng #${order.id} — Đã thanh toán`
                                : isCancelled
                                    ? `Đơn hàng #${order.id} — Đã hủy`
                                    : `Thanh toán đơn hàng #${order.id}`}
                        </h1>
                        <p className="order-result-sub">
                            Ngày tạo: <strong>{formatDateTime(order.createdAt)}</strong> • Kho xuất:{' '}
                            <strong>{order.fulfillmentWarehouseName}</strong>
                        </p>
                    </div>
                    <span className={`order-status-pill ${statusPillClass}`}>
                        {getOrderStatusLabel(order.status)}
                    </span>
                </div>

                {feedback && (
                    <div
                        role="alert"
                        className={`order-result-feedback ${
                            feedback.ok
                                ? 'order-result-feedback--ok'
                                : feedback.isWarning
                                    ? 'order-result-feedback--warn'
                                    : 'order-result-feedback--err'
                        }`}
                    >
                        {feedback.message}
                    </div>
                )}

                <div className="order-result-grid">
                    {/* Cột trái: Thông tin kho, giao nhận, sản phẩm và lịch sử thanh toán */}
                    <div className="order-result-left">
                        <section className="order-card">
                            <h2 className="order-card-title">Thông tin đơn hàng & Giao nhận</h2>

                            <div className="order-info-grid">
                                <div className="order-info-block">
                                    <span className="order-info-label">Kho phụ trách xuất hàng</span>
                                    <span className="order-info-val">{order.fulfillmentWarehouseName}</span>
                                </div>

                                <div className="order-info-block">
                                    <span className="order-info-label">Tình trạng giữ hàng</span>
                                    <span className="order-info-val order-info-muted">
                                        {isPaid
                                            ? `Đã xuất kho tại ${order.fulfillmentWarehouseName}.`
                                            : isCancelled
                                                ? 'Đơn đã hủy, tồn kho đã được hoàn trả / giải phóng.'
                                                : order.reservationActive
                                                    ? `Đang giữ đủ toàn bộ sản phẩm tại ${order.fulfillmentWarehouseName}.`
                                                    : 'Chưa giữ hàng hoặc đã giải phóng. Khi thanh toán lại, hệ thống sẽ tự kiểm tra kho.'}
                                    </span>
                                </div>

                                {order.shippingAddress && (
                                    <>
                                        <div className="order-info-block">
                                            <span className="order-info-label">Người nhận</span>
                                            <span className="order-info-val">
                                                {order.shippingAddress.fullName} — {order.shippingAddress.phone}
                                            </span>
                                        </div>

                                        <div className="order-info-block">
                                            <span className="order-info-label">Địa chỉ giao hàng</span>
                                            <span className="order-info-val">
                                                {order.shippingAddress.addressLine}, {order.shippingAddress.province}
                                            </span>
                                        </div>

                                        {order.shippingAddress.note && (
                                            <div className="order-info-block order-info-block--full">
                                                <span className="order-info-label">Ghi chú giao hàng</span>
                                                <span className="order-info-val order-info-muted">
                                                    {order.shippingAddress.note}
                                                </span>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        </section>

                        <section className="order-card">
                            <h2 className="order-card-title">Chi tiết sản phẩm trong đơn</h2>

                            <div className="order-table-wrap">
                                <table className="order-table">
                                    <thead>
                                        <tr>
                                            <th>Sản phẩm</th>
                                            <th className="num">Đơn giá</th>
                                            <th className="num">SL</th>
                                            <th className="num">Thành tiền</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {order.items.map((item) => (
                                            <tr key={item.productId}>
                                                <td>
                                                    <strong>{item.productNameSnapshot}</strong>
                                                </td>
                                                <td className="num">{formatCurrency(item.unitPriceSnapshot)}</td>
                                                <td className="num">{item.quantity}</td>
                                                <td className="num">
                                                    <strong>{formatCurrency(item.lineTotal)}</strong>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="order-totals">
                                {order.voucherCode && Number(order.discountAmount) > 0 && (
                                    <div className="order-totals-discount">
                                        Mã giảm giá {order.voucherCode}: -{formatCurrency(order.discountAmount)}
                                    </div>
                                )}
                                <div className="order-totals-final">
                                    Tổng thanh toán: {formatCurrency(order.totalAmount)}
                                </div>
                            </div>
                        </section>

                        {order.paymentAttempts?.length > 0 && (
                            <section className="order-card">
                                <h2 className="order-card-title">
                                    Lịch sử giao dịch thanh toán ({order.paymentAttempts.length} lần)
                                </h2>

                                <div className="order-table-wrap">
                                    <table className="order-table">
                                        <thead>
                                            <tr>
                                                <th>Lần</th>
                                                <th>Kết quả</th>
                                                <th>Thời gian</th>
                                                <th>Ghi chú</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {order.paymentAttempts.map((att) => (
                                                <tr key={att.id ?? att.attemptNumber}>
                                                    <td>#{att.attemptNumber}</td>
                                                    <td
                                                        style={{
                                                            fontWeight: 700,
                                                            color:
                                                                att.result === PaymentResult.SUCCESS
                                                                    ? '#166534'
                                                                    : att.result === 'PENDING'
                                                                        ? '#92400e'
                                                                        : '#b91c1c',
                                                        }}
                                                    >
                                                        {att.result === 'PENDING'
                                                            ? 'Đang xử lý/đối soát'
                                                            : PAYMENT_RESULT_LABELS[att.result] || att.result}
                                                    </td>
                                                    <td>{formatDateTime(att.createdAt)}</td>
                                                    <td>{att.note}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </section>
                        )}
                    </div>

                    {/* Cột phải: Mã QR (tách biệt) + Demo giả lập 3 trường hợp + Điều hướng */}
                    <aside className="order-result-right">
                        {isPendingPayment && (
                            <>
                                {/* === MODULE MÃ QR THANH TOÁN (TÁCH BIỆT) === */}
                                <PaymentQrBox
                                    order={order}
                                    disabled={paymentDisabled}
                                    busy={busy}
                                    onConfirmQrPayment={() =>
                                        handleSimulatePayment(PaymentResult.SUCCESS)
                                    }
                                />

                                {/* === KHỐI DEMO GIẢ LẬP 3 TRƯỜNG HỢP === */}
                                <section className="order-card">
                                    <h2 className="order-card-title">
                                        {hasFailedBefore
                                            ? 'Thử lại thanh toán (Demo giả lập)'
                                            : 'Cổng thanh toán giả lập (Demo)'}
                                    </h2>

                                    <p className="order-demo-desc">
                                        Chọn nhanh kết quả thanh toán cho số tiền{' '}
                                        <strong>{formatCurrency(order.totalAmount)}</strong> để kiểm thử các kịch bản nghiệp vụ:
                                    </p>

                                    {(order.paymentInProgress || needsReconciliation) && (
                                        <p className="order-demo-warn">
                                            Đang có giao dịch chờ đối soát. Không thể tạo giao dịch mới lúc này.
                                        </p>
                                    )}

                                    <div className="order-demo-actions">
                                        <button
                                            type="button"
                                            className="order-btn order-btn--success"
                                            disabled={paymentDisabled}
                                            onClick={() => handleSimulatePayment(PaymentResult.SUCCESS)}
                                        >
                                            {busy ? 'Đang xử lý...' : 'Giả lập Thanh toán Thành công'}
                                        </button>

                                        <button
                                            type="button"
                                            className="order-btn order-btn--outline-danger"
                                            disabled={paymentDisabled}
                                            onClick={() => handleSimulatePayment(PaymentResult.FAILED)}
                                        >
                                            {busy ? 'Đang xử lý...' : 'Giả lập Thanh toán Thất bại'}
                                        </button>

                                        <button
                                            type="button"
                                            className="order-btn order-btn--outline-warn"
                                            disabled={paymentDisabled}
                                            onClick={() => handleSimulatePayment(PaymentResult.INCOMPLETE)}
                                        >
                                            {busy ? 'Đang xử lý...' : 'Giả lập Không hoàn tất'}
                                        </button>
                                    </div>
                                </section>
                            </>
                        )}

                        <section className="order-card">
                            <h2 className="order-card-title">Thao tác tiếp theo</h2>
                            <div className="order-nav-actions">
                                <Link
                                    to={`/orders/${order.id}`}
                                    className="order-btn order-btn--primary"
                                >
                                    Theo dõi & Chi tiết đơn hàng
                                </Link>
                                <Link
                                    to="/orders"
                                    state={returnState}
                                    className="order-btn order-btn--ghost"
                                >
                                    Xem lịch sử mua hàng
                                </Link>
                                <Link
                                    to="/products"
                                    state={returnState}
                                    className="order-btn order-btn--ghost"
                                >
                                    Tiếp tục mua hàng
                                </Link>
                            </div>
                        </section>
                    </aside>
                </div>
            </div>
        </div>
    )
}

export default OrderResultPage
