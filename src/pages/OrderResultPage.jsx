import { useState } from 'react'
import { useLocation, Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrderContext'
import {
    OrderStatus,
    PaymentResult,
    PAYMENT_RESULT_LABELS,
    getOrderStatusLabel,
    formatCurrency,
    formatDateTime,
} from '../constants/order'

function OrderResultPage() {
    const location = useLocation()
    const { currentUser } = useAuth()
    const { getMyOrders, getMyOrderById, processMockPayment } = useOrders()
    const [feedback, setFeedback] = useState(null)

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <>
                <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
                    <h1>Không có quyền truy cập</h1>
                    <p>Trang kết quả đặt hàng chỉ dành cho khách hàng.</p>
                </div>
            </>
        )
    }

    // Lấy mã đơn hàng từ state điều hướng hoặc lấy đơn hàng mới nhất của khách hàng
    const stateOrderId = location.state?.orderId || location.state?.order?.id
    const myOrders = getMyOrders()
    const targetOrderId = stateOrderId || myOrders[0]?.id
    const lookup = targetOrderId ? getMyOrderById(targetOrderId) : null
    const order = lookup?.ok ? lookup.order : null

    if (!order) {
        return (
            <>
                <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px' }}>
                    <h1>Kết quả đơn hàng</h1>
                    <p>Không tìm thấy thông tin đơn hàng vừa tạo.</p>
                    <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                        <Link
                            to="/orders"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                            Xem lịch sử đơn hàng
                        </Link>
                        <Link
                            to="/products"
                            style={{ color: '#2563eb', textDecoration: 'underline' }}
                        >
                            Quay lại danh sách sản phẩm
                        </Link>
                    </div>
                </div>
            </>
        )
    }

    // Thực hiện thanh toán giả lập (Mock Payment - UC04: SR-PAY-01..04)
    const handleSimulatePayment = (mode) => {
        const res = processMockPayment(order.id, mode)
        setFeedback({
            ok: res.ok && res.paymentResult === PaymentResult.SUCCESS,
            isWarning:
                res.ok &&
                (res.paymentResult === PaymentResult.FAILED ||
                    res.paymentResult === PaymentResult.INCOMPLETE),
            message: res.message,
        })
    }

    const isPendingPayment = order.status === OrderStatus.PENDING_PAYMENT
    const isPaid = order.status === OrderStatus.PAID
    const isCancelled = order.status === OrderStatus.CANCELLED
    const hasFailedBefore = (order.paymentAttempts?.length || 0) > 0 && isPendingPayment

    return (
        <>
            <div
                style={{
                    maxWidth: '860px',
                    margin: '30px auto',
                    padding: '24px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
                }}
            >
                {/* Tiêu đề trạng thái đơn hàng */}
                <div
                    style={{
                        background: isPaid
                            ? '#f0fdf4'
                            : isCancelled
                                ? '#fef2f2'
                                : '#eff6ff',
                        border: `1px solid ${isPaid
                                ? '#86efac'
                                : isCancelled
                                    ? '#fca5a5'
                                    : '#93c5fd'
                            }`,
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h1
                        style={{
                            color: isPaid
                                ? '#166534'
                                : isCancelled
                                    ? '#991b1b'
                                    : '#1e40af',
                            margin: '0 0 8px 0',
                            fontSize: '1.5rem',
                        }}
                    >
                        {isPaid
                            ? '✓ Đơn hàng đã thanh toán thành công!'
                            : isCancelled
                                ? '✕ Đơn hàng đã bị hủy'
                                : 'Đơn hàng đã được khởi tạo — Chờ thanh toán'}
                    </h1>
                    <p style={{ margin: 0, color: '#334155' }}>
                        Mã đơn hàng: <strong>{order.id}</strong> | Ngày tạo:{' '}
                        <strong>{formatDateTime(order.createdAt)}</strong>
                    </p>
                </div>

                {/* Thông báo kết quả sau khi bấm nút thanh toán giả lập */}
                {feedback && (
                    <div
                        role="alert"
                        style={{
                            background: feedback.ok
                                ? '#f0fdf4'
                                : feedback.isWarning
                                    ? '#fffbeb'
                                    : '#fef2f2',
                            border: `1px solid ${feedback.ok
                                    ? '#86efac'
                                    : feedback.isWarning
                                        ? '#fcd34d'
                                        : '#fca5a5'
                                }`,
                            color: feedback.ok
                                ? '#166534'
                                : feedback.isWarning
                                    ? '#92400e'
                                    : '#991b1b',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            marginBottom: '20px',
                            fontWeight: '500',
                        }}
                    >
                        {feedback.message}
                    </div>
                )}

                {/* Thông tin kho đáp ứng đơn hàng và trạng thái giữ hàng (BR-01, BR-02) */}
                <div
                    style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ fontSize: '1.15rem', marginTop: 0 }}>
                        Thông tin điều phối kho (Single-Warehouse Fulfillment)
                    </h2>
                    <p style={{ margin: '6px 0' }}>
                        <strong>Kho phụ trách xuất hàng:</strong>{' '}
                        {order.fulfillmentWarehouseName} (Kho #
                        {order.fulfillmentWarehouseId})
                    </p>
                    <p style={{ margin: '6px 0' }}>
                        <strong>Trạng thái đơn hàng:</strong>{' '}
                        <span
                            style={{
                                background: isPaid
                                    ? '#dcfce7'
                                    : isCancelled
                                        ? '#fee2e2'
                                        : '#fef3c7',
                                color: isPaid
                                    ? '#166534'
                                    : isCancelled
                                        ? '#991b1b'
                                        : '#92400e',
                                padding: '3px 10px',
                                borderRadius: '4px',
                                fontWeight: 'bold',
                            }}
                        >
                            {getOrderStatusLabel(order.status)} ({order.status})
                        </span>
                    </p>
                    <p style={{ margin: '6px 0', color: '#475569' }}>
                        <strong>Tình trạng giữ hàng (Reservation):</strong>{' '}
                        {isPaid
                            ? `Đã chuyển hàng giữ thành hàng đã bán (khấu trừ onHand & reserved) tại ${order.fulfillmentWarehouseName}.`
                            : isCancelled
                                ? 'Đơn đã hủy, tồn kho đã được hoàn trả / giải phóng.'
                                : order.reservationActive
                                    ? `Đang tạm giữ (reserved) đủ toàn bộ mặt hàng tại ${order.fulfillmentWarehouseName}.`
                                    : 'Đã giải phóng hàng giữ sau lần thanh toán chưa thành công. Khi bấm Thử lại thanh toán, hệ thống sẽ kiểm tra và giữ hàng lại.'}
                    </p>
                </div>

                {/* Cổng thanh toán giả lập (Mock Payment Gateway - UC04: SR-PAY-01..04) */}
                {isPendingPayment && (
                    <div
                        style={{
                            background: '#fffbeb',
                            border: '1px solid #fcd34d',
                            padding: '18px 20px',
                            borderRadius: '8px',
                            marginBottom: '24px',
                        }}
                    >
                        <h2
                            style={{
                                fontSize: '1.15rem',
                                marginTop: 0,
                                color: '#92400e',
                            }}
                        >
                            {hasFailedBefore
                                ? '🔄 Thử lại thanh toán (Retry Mock Payment)'
                                : '💳 Cổng thanh toán giả lập (Mock Payment Gateway)'}
                        </h2>
                        <p style={{ margin: '6px 0 14px', color: '#78350f', fontSize: '0.95rem' }}>
                            Chọn kịch bản phản hồi từ cổng thanh toán giả lập cho số tiền{' '}
                            <strong>{formatCurrency(order.totalAmount)}</strong>:
                        </p>

                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                            <button
                                type="button"
                                onClick={() =>
                                    handleSimulatePayment(PaymentResult.SUCCESS)
                                }
                                style={{
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ✓ Giả lập Thanh toán Thành công (Paid)
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    handleSimulatePayment(PaymentResult.FAILED)
                                }
                                style={{
                                    background: '#dc2626',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ✕ Giả lập Thanh toán Thất bại (Giải phóng hàng giữ)
                            </button>

                            <button
                                type="button"
                                onClick={() =>
                                    handleSimulatePayment(
                                        PaymentResult.INCOMPLETE
                                    )
                                }
                                style={{
                                    background: '#d97706',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '10px 18px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ⏱ Giả lập Không hoàn tất / Timeout
                            </button>
                        </div>
                    </div>
                )}

                {/* Lịch sử các lần giao dịch thanh toán của đơn */}
                {order.paymentAttempts?.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.15rem' }}>
                            Lịch sử giao dịch thanh toán ({order.paymentAttempts.length} lần)
                        </h2>
                        <div
                            style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '6px',
                                overflow: 'hidden',
                            }}
                        >
                            <table
                                style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    textAlign: 'left',
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            background: '#f1f5f9',
                                            borderBottom: '1px solid #cbd5e1',
                                        }}
                                    >
                                        <th style={{ padding: '8px 12px' }}>Lần</th>
                                        <th style={{ padding: '8px 12px' }}>Kết quả</th>
                                        <th style={{ padding: '8px 12px' }}>Thời gian</th>
                                        <th style={{ padding: '8px 12px' }}>Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.paymentAttempts.map((att) => (
                                        <tr
                                            key={att.attemptNumber}
                                            style={{
                                                borderBottom: '1px solid #f1f5f9',
                                            }}
                                        >
                                            <td style={{ padding: '8px 12px' }}>
                                                #{att.attemptNumber}
                                            </td>
                                            <td
                                                style={{
                                                    padding: '8px 12px',
                                                    fontWeight: 'bold',
                                                    color:
                                                        att.result ===
                                                            PaymentResult.SUCCESS
                                                            ? '#166534'
                                                            : '#b91c1c',
                                                }}
                                            >
                                                {PAYMENT_RESULT_LABELS[att.result] ||
                                                    att.result}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {formatDateTime(att.createdAt)}
                                            </td>
                                            <td style={{ padding: '8px 12px' }}>
                                                {att.note}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Bảng chi tiết sản phẩm (Snapshot tại thời điểm đặt hàng - SR-PROD-03) */}
                <h2 style={{ fontSize: '1.15rem' }}>Chi tiết sản phẩm trong đơn</h2>
                <div
                    style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                    }}
                >
                    <table
                        style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            textAlign: 'left',
                        }}
                    >
                        <thead>
                            <tr
                                style={{
                                    background: '#f1f5f9',
                                    borderBottom: '1px solid #cbd5e1',
                                }}
                            >
                                <th style={{ padding: '10px 14px' }}>Sản phẩm</th>
                                <th style={{ padding: '10px 14px' }}>Đơn giá chốt</th>
                                <th style={{ padding: '10px 14px' }}>Số lượng</th>
                                <th style={{ padding: '10px 14px' }}>Thành tiền</th>
                            </tr>
                        </thead>
                        <tbody>
                            {order.items.map((item) => (
                                <tr
                                    key={item.productId}
                                    style={{ borderBottom: '1px solid #f1f5f9' }}
                                >
                                    <td style={{ padding: '10px 14px' }}>
                                        {item.productNameSnapshot}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {formatCurrency(item.unitPriceSnapshot)}
                                    </td>
                                    <td style={{ padding: '10px 14px' }}>
                                        {item.quantity}
                                    </td>
                                    <td
                                        style={{
                                            padding: '10px 14px',
                                            fontWeight: '500',
                                        }}
                                    >
                                        {formatCurrency(item.lineTotal)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div
                    style={{
                        textAlign: 'right',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        margin: '20px 0',
                    }}
                >
                    Tổng thanh toán: {formatCurrency(order.totalAmount)}
                </div>

                <div
                    style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginTop: '24px',
                    }}
                >
                    <Link
                        to={`/orders/${order.id}`}
                        style={{
                            background: '#2563eb',
                            color: '#ffffff',
                            padding: '10px 18px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '500',
                        }}
                    >
                        Theo dõi & Chi tiết đơn hàng
                    </Link>

                    <Link
                        to="/orders"
                        style={{
                            background: '#f1f5f9',
                            color: '#1e293b',
                            padding: '10px 18px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '500',
                        }}
                    >
                        Xem lịch sử mua hàng
                    </Link>

                    <Link
                        to="/products"
                        style={{
                            background: '#f1f5f9',
                            color: '#1e293b',
                            padding: '10px 18px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '500',
                        }}
                    >
                        Tiếp tục mua hàng
                    </Link>
                </div>
            </div>
        </>
    )
}

export default OrderResultPage