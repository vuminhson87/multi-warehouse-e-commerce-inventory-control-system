import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOrders } from '../context/OrderContext'
import {
    OrderStatus,
    PaymentResult,
    PAYMENT_RESULT_LABELS,
    getOrderStatusLabel,
    isCustomerCancellable,
    formatCurrency,
    formatDateTime,
} from '../constants/order'

const PROGRESS_STEPS = [
    { key: OrderStatus.PENDING_PAYMENT, label: 'Chờ thanh toán' },
    { key: OrderStatus.PAID, label: 'Đã thanh toán' },
    { key: OrderStatus.PROCESSING, label: 'Đang xử lý' },
    { key: OrderStatus.COMPLETED, label: 'Hoàn tất' },
]

function OrderTrackingPage() {
    const { orderId } = useParams()
    const { currentUser } = useAuth()
    const { getMyOrderById, processMockPayment, cancelOrder } = useOrders()
    const [feedback, setFeedback] = useState(null)

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (currentUser.role !== 'CUSTOMER') {
        return (
            <>
                <div style={{ maxWidth: '860px', margin: '40px auto', padding: '20px' }}>
                    <h1>Không có quyền truy cập</h1>
                    <p>Chức năng theo dõi đơn hàng chỉ dành cho khách hàng.</p>
                </div>
            </>
        )
    }

    // Kiểm tra đơn hàng và quyền sở hữu (UC09: SR-TRACK-01..02, SR-AUTH-04, T13)
    const lookup = getMyOrderById(orderId)

    if (!lookup.ok) {
        return (
            <>
                <div
                    style={{
                        maxWidth: '860px',
                        margin: '40px auto',
                        padding: '24px',
                        background: '#ffffff',
                        borderRadius: '8px',
                        border: '1px solid #fca5a5',
                    }}
                >
                    <h1 style={{ color: '#991b1b', marginTop: 0 }}>
                        {lookup.code === 'FORBIDDEN'
                            ? 'Từ chối truy cập đơn hàng'
                            : 'Không tìm thấy đơn hàng'}
                    </h1>
                    <p style={{ color: '#7f1d1d' }}>{lookup.message}</p>
                    <Link
                        to="/orders"
                        style={{
                            display: 'inline-block',
                            marginTop: '12px',
                            background: '#2563eb',
                            color: '#ffffff',
                            padding: '10px 18px',
                            borderRadius: '6px',
                            textDecoration: 'none',
                            fontWeight: '500',
                        }}
                    >
                        Quay về lịch sử đơn hàng của tôi
                    </Link>
                </div>
            </>
        )
    }

    const { order } = lookup
    const isPendingPayment = order.status === OrderStatus.PENDING_PAYMENT
    const isPaid = order.status === OrderStatus.PAID
    const isCancelled = order.status === OrderStatus.CANCELLED
    const canCancel = isCustomerCancellable(order.status)

    const currentStepIndex = PROGRESS_STEPS.findIndex(
        (step) => step.key === order.status
    )

    // Thực hiện thanh toán giả lập hoặc thử lại thanh toán ngay trên trang chi tiết đơn (UC04)
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

    // Xử lý hủy đơn hàng (UC11: SR-CAN-01..04, BR-05, BR-06)
    const handleCancelOrder = () => {
        const confirmMsg = isPaid
            ? `Xác nhận hủy đơn hàng ${order.id} (Đã thanh toán)?\nSố lượng hàng đã trừ sẽ được hoàn trả lại kho ${order.fulfillmentWarehouseName}.`
            : `Xác nhận hủy đơn hàng ${order.id} (Chờ thanh toán)?\nLượng hàng đang giữ tại ${order.fulfillmentWarehouseName} (nếu có) sẽ được giải phóng.`

        if (!window.confirm(confirmMsg)) {
            return
        }

        const res = cancelOrder(order.id)
        setFeedback({
            ok: res.ok,
            isWarning: false,
            message: res.message,
        })
    }

    return (
        <>
            <div
                style={{
                    maxWidth: '900px',
                    margin: '30px auto',
                    padding: '24px',
                    background: '#ffffff',
                    borderRadius: '8px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                        marginBottom: '20px',
                    }}
                >
                    <div>
                        <Link
                            to="/orders"
                            style={{
                                color: '#2563eb',
                                textDecoration: 'none',
                                fontSize: '0.9rem',
                            }}
                        >
                            ← Quay lại lịch sử mua hàng
                        </Link>
                        <h1 style={{ margin: '6px 0 4px 0', fontSize: '1.6rem' }}>
                            Chi tiết & Theo dõi đơn hàng: {order.id}
                        </h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.92rem' }}>
                            Ngày đặt: {formatDateTime(order.createdAt)} | Cập nhật
                            lần cuối: {formatDateTime(order.updatedAt)}
                        </p>
                    </div>

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
                            padding: '6px 14px',
                            borderRadius: '999px',
                            fontWeight: 'bold',
                            fontSize: '0.95rem',
                        }}
                    >
                        {getOrderStatusLabel(order.status)} ({order.status})
                    </span>
                </div>

                {feedback && (
                    <div
                        role="alert"
                        style={{
                            background: feedback.ok
                                ? '#f0fdf4'
                                : feedback.isWarning
                                  ? '#fffbeb'
                                  : '#fef2f2',
                            border: `1px solid ${
                                feedback.ok
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

                {/* Thanh tiến trình trạng thái đơn hàng (State Machine BR-11) */}
                {isCancelled ? (
                    <div
                        style={{
                            background: '#fef2f2',
                            border: '1px solid #fca5a5',
                            padding: '14px 18px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            color: '#991b1b',
                        }}
                    >
                        <strong>Đơn hàng đã bị hủy</strong> vào lúc{' '}
                        {formatDateTime(order.cancelledAt)}. Tồn kho tại{' '}
                        <strong>{order.fulfillmentWarehouseName}</strong> đã được
                        cập nhật hoàn trả đúng quy định.
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '8px',
                            marginBottom: '24px',
                        }}
                    >
                        {PROGRESS_STEPS.map((step, index) => {
                            const isActive = index <= currentStepIndex
                            return (
                                <div
                                    key={step.key}
                                    style={{
                                        padding: '10px 12px',
                                        borderRadius: '6px',
                                        textAlign: 'center',
                                        background: isActive
                                            ? '#eff6ff'
                                            : '#f8fafc',
                                        border: `2px solid ${
                                            isActive ? '#2563eb' : '#e2e8f0'
                                        }`,
                                        color: isActive ? '#1e40af' : '#94a3b8',
                                        fontWeight: isActive ? 'bold' : 'normal',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    <div>Bước {index + 1}</div>
                                    <div>{step.label}</div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Thông tin kho xuất hàng và giữ chỗ */}
                <div
                    style={{
                        background: '#f8fafc',
                        border: '1px solid #e2e8f0',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ fontSize: '1.1rem', marginTop: 0 }}>
                        Thông tin kho xử lý đơn hàng (Single-Warehouse Fulfillment)
                    </h2>
                    <p style={{ margin: '6px 0' }}>
                        <strong>Kho thực hiện đơn:</strong>{' '}
                        {order.fulfillmentWarehouseName} (Mã kho #
                        {order.fulfillmentWarehouseId})
                    </p>
                    <p style={{ margin: '6px 0' }}>
                        <strong>Khách hàng sở hữu:</strong>{' '}
                        {order.customerUsername}
                    </p>
                    <p style={{ margin: '6px 0', color: '#475569' }}>
                        <strong>Trạng thái tồn kho của đơn:</strong>{' '}
                        {isPaid
                            ? `Đã khấu trừ hàng thực tế (onHand) và hàng giữ (reserved) tại ${order.fulfillmentWarehouseName}.`
                            : isCancelled
                              ? `Đã giải phóng/hoàn trả tồn kho về ${order.fulfillmentWarehouseName}.`
                              : order.reservationActive
                                ? `Đang giữ chỗ (reserved) toàn bộ sản phẩm tại ${order.fulfillmentWarehouseName}.`
                                : 'Hàng giữ đã được giải phóng sau lần thanh toán chưa hoàn tất. Khi thử lại thanh toán sẽ kiểm tra và giữ hàng lại.'}
                    </p>
                </div>

                {/* Khu vực Thanh toán giả lập / Thử lại thanh toán nếu đơn đang PendingPayment */}
                {isPendingPayment && (
                    <div
                        style={{
                            background: '#fffbeb',
                            border: '1px solid #fcd34d',
                            padding: '16px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                        }}
                    >
                        <h2
                            style={{
                                fontSize: '1.1rem',
                                marginTop: 0,
                                color: '#92400e',
                            }}
                        >
                            💳 Thanh toán / Thử lại thanh toán giả lập (UC04)
                        </h2>
                        <p style={{ margin: '6px 0 12px', color: '#78350f', fontSize: '0.92rem' }}>
                            Đơn hàng đang ở trạng thái <strong>Chờ thanh toán</strong>. Bạn có thể chọn kết quả giả lập bên dưới:
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                            <button
                                type="button"
                                onClick={() =>
                                    handleSimulatePayment(PaymentResult.SUCCESS)
                                }
                                style={{
                                    background: '#16a34a',
                                    color: '#ffffff',
                                    border: 'none',
                                    padding: '9px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ✓ Thanh toán Thành công
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
                                    padding: '9px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ✕ Thanh toán Thất bại
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
                                    padding: '9px 16px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                }}
                            >
                                ⏱ Không hoàn tất (Timeout)
                            </button>
                        </div>
                    </div>
                )}

                {/* Bảng danh sách mặt hàng trong đơn (Snapshot bảo toàn lịch sử - SR-PROD-03) */}
                <h2 style={{ fontSize: '1.15rem' }}>
                    Danh sách sản phẩm trong đơn
                </h2>
                <div
                    style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '6px',
                        overflow: 'hidden',
                        marginBottom: '16px',
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
                                <th style={{ padding: '10px 14px' }}>Mã SP</th>
                                <th style={{ padding: '10px 14px' }}>
                                    Tên sản phẩm (Snapshot)
                                </th>
                                <th style={{ padding: '10px 14px' }}>
                                    Đơn giá lúc đặt
                                </th>
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
                                        #{item.productId}
                                    </td>
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
                        marginBottom: '24px',
                    }}
                >
                    Tổng cộng: {formatCurrency(order.totalAmount)}
                </div>

                {/* Lịch sử các lần thanh toán */}
                {order.paymentAttempts?.length > 0 && (
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.15rem' }}>
                            Lịch sử các lần thanh toán ({order.paymentAttempts.length})
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
                                        <th style={{ padding: '8px 12px' }}>Chi tiết</th>
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

                {/* Khu vực Hủy đơn hàng (UC11: SR-CAN-01..04, BR-05, BR-06) */}
                <div
                    style={{
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '20px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '12px',
                    }}
                >
                    <div style={{ color: '#475569', fontSize: '0.92rem' }}>
                        {canCancel ? (
                            <span>
                                Bạn có thể hủy đơn hàng này. Khi hủy, tồn kho tại{' '}
                                <strong>{order.fulfillmentWarehouseName}</strong>{' '}
                                sẽ được{' '}
                                {isPaid
                                    ? 'cộng hoàn trả lại vào tồn thực tế (onHand).'
                                    : 'giải phóng khỏi lượng hàng đang giữ (reserved).'}
                            </span>
                        ) : (
                            <span>
                                Đơn hàng đang ở trạng thái{' '}
                                <strong>{getOrderStatusLabel(order.status)}</strong>{' '}
                                nên không thể hủy (Theo quy tắc SR-CAN-01: chỉ cho
                                phép hủy khi Chờ thanh toán hoặc Đã thanh toán).
                            </span>
                        )}
                    </div>

                    <button
                        type="button"
                        disabled={!canCancel}
                        onClick={handleCancelOrder}
                        style={{
                            background: canCancel ? '#dc2626' : '#cbd5e1',
                            color: '#ffffff',
                            border: 'none',
                            padding: '10px 20px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            cursor: canCancel ? 'pointer' : 'not-allowed',
                        }}
                    >
                        Hủy đơn hàng
                    </button>
                </div>
            </div>
        </>
    )
}

export default OrderTrackingPage