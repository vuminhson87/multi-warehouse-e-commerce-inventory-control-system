import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCustomerOrder } from '../hooks/useCustomerOrder.js'
import { cancelOrderApi, confirmOrderReceivedApi } from '../services/orderApi.js'
import { acquireActionKey, clearActionKey } from '../services/requestKeys.js'
import {
    OrderStatus,
    PaymentResult,
    PAYMENT_RESULT_LABELS,
    getDeliveryStageLabel,
    getOrderStatusLabel,
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
    const { currentUser, token, authLoading } = useAuth()
    const { order, loading, error, reload } = useCustomerOrder(token, orderId)
    const [feedback, setFeedback] = useState(null)
    const [busy, setBusy] = useState(false)
    const [needsReconciliation, setNeedsReconciliation] = useState(false)

    if (authLoading) {
        return (
            <div style={{ maxWidth: '860px', margin: '40px auto', padding: '24px' }}>
                Đang kiểm tra phiên...
            </div>
        )
    }

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

    if (loading) {
        return (
            <div style={{ maxWidth: '860px', margin: '40px auto', padding: '24px' }}>
                Đang tải chi tiết đơn hàng...
            </div>
        )
    }

    if (error || !order) {
        return (
            <>
                <div
                    role="alert"
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
                        {error?.status === 403
                            ? 'Từ chối truy cập đơn hàng'
                            : 'Không tìm thấy đơn hàng'}
                    </h1>
                    <p style={{ color: '#7f1d1d' }}>
                        {error?.status === 404
                            ? 'Không tìm thấy đơn hàng hoặc bạn không có quyền xem đơn hàng này.'
                            : error?.message || 'Không tìm thấy thông tin đơn hàng.'}
                    </p>
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

    const isPendingPayment = order.status === OrderStatus.PENDING_PAYMENT
    const isPaid = order.status === OrderStatus.PAID
    const isProcessing = order.status === OrderStatus.PROCESSING
    const isCancelled = order.status === OrderStatus.CANCELLED
    const isReconciling = Boolean(order.paymentInProgress) || needsReconciliation
    const canCancel = order.canCancel && !busy && !isReconciling
    const canConfirmReceipt = isProcessing && !busy

    const currentStepIndex = PROGRESS_STEPS.findIndex(
        (step) => step.key === order.status
    )

    // Xử lý hủy đơn hàng (UC11: SR-CAN-01..04, BR-05, BR-06)
    const handleCancelOrder = async () => {
        if (!order?.canCancel || busy || needsReconciliation || order.paymentInProgress) return
        const confirmMsg = order.status === OrderStatus.PAID
            ? `Hủy đơn #${order.id} đã thanh toán? Hàng sẽ hoàn về ${order.fulfillmentWarehouseName}.`
            : `Hủy đơn #${order.id} đang chờ thanh toán? Hàng giữ sẽ được giải phóng.`
        if (!window.confirm(confirmMsg)) return

        const scope = `cancel:${currentUser.id}:${order.id}`
        setBusy(true)
        try {
            await cancelOrderApi(token, order.id, acquireActionKey(scope))
            clearActionKey(scope)
            setFeedback({ ok: true, isWarning: false, message: 'Đã hủy đơn hàng.' })
            reload()
        } catch (err) {
            const unknown = err.status === 503 || err.code === 'REQUEST_OUTCOME_UNKNOWN'
            if (unknown) setNeedsReconciliation(true)
            setFeedback({
                ok: false,
                isWarning: unknown,
                message: unknown
                    ? 'Chưa rõ kết quả hủy. Kiểm tra lại trạng thái trước khi thử lại.'
                    : err.message,
            })
            reload()
        } finally {
            setBusy(false)
        }
    }

    const handleConfirmReceipt = async () => {
        if (!canConfirmReceipt) return
        const confirmed = window.confirm(
            `Xác nhận bạn đã nhận đơn hàng #${order.id}? Sau khi xác nhận, đơn sẽ chuyển sang Hoàn tất.`
        )
        if (!confirmed) return

        setBusy(true)
        setFeedback(null)
        try {
            await confirmOrderReceivedApi(token, order.id)
            setFeedback({
                ok: true,
                isWarning: false,
                message: 'Đã xác nhận nhận hàng. Đơn hàng đã được hoàn tất.',
            })
            reload()
        } catch (err) {
            setFeedback({
                ok: false,
                isWarning: err.status === 503 || err.isNetworkError,
                message: err.status === 503 || err.isNetworkError
                    ? 'Chưa rõ kết quả xác nhận. Đang tải lại trạng thái đơn hàng; bạn có thể xác nhận lại nếu đơn vẫn đang xử lý.'
                    : err.message,
            })
            reload()
        } finally {
            setBusy(false)
        }
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
                                fontSize: '13px',
                                fontWeight: 500,
                            }}
                        >
                            ← Quay lại lịch sử mua hàng
                        </Link>
                        <h1 style={{ margin: '6px 0 4px 0', fontSize: '24px', fontWeight: 700, color: '#0f172a' }}>
                            Chi tiết & Theo dõi đơn hàng: {order.id}
                        </h1>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
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
                            fontWeight: 600,
                            fontSize: '13px',
                        }}
                    >
                        {getOrderStatusLabel(order.status)}
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
                {order.shippingAddress && (
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            padding: '16px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                            color: '#334155',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '10px', color: '#0f172a' }}>
                            Thông tin giao hàng
                        </h2>
                        <p style={{ margin: '6px 0', fontSize: '14px', color: '#334155' }}>
                            <strong style={{ color: '#0f172a', fontWeight: 600 }}>Người nhận:</strong> {order.shippingAddress.fullName} — {order.shippingAddress.phone}
                        </p>
                        <p style={{ margin: '6px 0', fontSize: '14px', color: '#334155' }}>
                            <strong style={{ color: '#0f172a', fontWeight: 600 }}>Địa chỉ:</strong> {order.shippingAddress.addressLine}, {order.shippingAddress.province}
                        </p>
                        {order.shippingAddress.note && (
                            <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#334155' }}>
                                <strong style={{ color: '#0f172a', fontWeight: 600 }}>Ghi chú:</strong> {order.shippingAddress.note}
                            </p>
                        )}
                    </div>
                )}

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
                                        fontWeight: isActive ? 600 : 400,
                                        fontSize: '13px',
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
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '10px', color: '#0f172a' }}>
                        Thông tin kho xử lý đơn hàng
                    </h2>
                    <p style={{ margin: '6px 0', fontSize: '14px', color: '#334155' }}>
                        <strong style={{ color: '#0f172a', fontWeight: 600 }}>Kho thực hiện đơn:</strong>{' '}
                        {order.fulfillmentWarehouseName}
                    </p>
                    <p style={{ margin: '6px 0', fontSize: '14px', color: '#334155' }}>
                        <strong style={{ color: '#0f172a', fontWeight: 600 }}>Khách hàng:</strong>{' '}
                        {order.customerUsername}
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#334155' }}>
                        <strong style={{ color: '#0f172a', fontWeight: 600 }}>Trạng thái tồn kho của đơn:</strong>{' '}
                        {isPaid
                            ? `Đã xuất kho cho đơn hàng tại ${order.fulfillmentWarehouseName}.`
                            : isCancelled
                              ? `Đã giải phóng/hoàn trả tồn kho về ${order.fulfillmentWarehouseName}.`
                              : order.reservationActive
                                ? `Đang giữ đủ toàn bộ sản phẩm tại ${order.fulfillmentWarehouseName}.`
                                : 'Hàng giữ đã được giải phóng sau lần thanh toán chưa hoàn tất. Khi thử lại thanh toán sẽ kiểm tra và giữ hàng lại.'}
                    </p>
                </div>

                {/* Chi tiết tiến độ giao / nhận hàng */}
                <div
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '12px', color: '#0f172a' }}>
                        Tiến độ giao / nhận hàng chi tiết
                    </h2>
                    {order.trackingEvents?.length > 0 ? (
                        <ol
                            style={{
                                listStyle: 'none',
                                margin: 0,
                                padding: 0,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px',
                            }}
                        >
                            {[...order.trackingEvents].reverse().map((event, idx) => (
                                <li
                                    key={event.id ?? `${event.stage}-${idx}`}
                                    style={{
                                        borderLeft: `3px solid ${idx === 0 ? '#2563eb' : '#cbd5e1'}`,
                                        paddingLeft: '12px',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', fontSize: '14px' }}>
                                        <strong style={{ color: idx === 0 ? '#1e40af' : '#0f172a', fontWeight: 600 }}>
                                            {getDeliveryStageLabel(event.stage)}
                                        </strong>
                                        <span style={{ color: '#64748b', fontSize: '13px' }}>
                                            {formatDateTime(event.createdAt)}
                                        </span>
                                    </div>
                                    {event.note && (
                                        <p style={{ margin: '4px 0 0', color: '#334155', fontSize: '14px' }}>
                                            {event.note}
                                        </p>
                                    )}
                                    {(event.location || event.trackingCode) && (
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>
                                            {event.location ? `Địa điểm: ${event.location}` : ''}
                                            {event.location && event.trackingCode ? ' · ' : ''}
                                            {event.trackingCode ? `Mã vận đơn: ${event.trackingCode}` : ''}
                                        </p>
                                    )}
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
                            {isCancelled
                                ? 'Đơn hàng đã hủy trước khi chuyển sang giai đoạn giao nhận.'
                                : 'Chưa có cập nhật vận chuyển chi tiết. Tiến độ sẽ hiển thị sau khi kho bắt đầu xử lý đơn hàng.'}
                        </p>
                    )}
                </div>

                {/* Khu vực nhắc thanh toán một luồng duy nhất — điều hướng về /order-result/:id */}
                {isPendingPayment && (
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e4e4e7',
                            padding: '18px 20px',
                            borderRadius: '10px',
                            marginBottom: '20px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '14px',
                        }}
                    >
                        <div style={{ flex: '1 1 280px' }}>
                            <h2
                                style={{
                                    fontSize: '15.5px',
                                    fontWeight: 700,
                                    marginTop: 0,
                                    marginBottom: '6px',
                                    color: '#09090b',
                                }}
                            >
                                Đơn hàng đang chờ thanh toán
                            </h2>
                            <p style={{ margin: 0, color: '#52525b', fontSize: '13.5px', lineHeight: 1.5 }}>
                                {isReconciling
                                    ? 'Đơn hàng đang có giao dịch chờ đối soát kết quả. Vui lòng kiểm tra lại sau giây lát.'
                                    : 'Vui lòng quay lại màn hình thanh toán để quét mã QR hoặc chọn phương thức thanh toán hoàn tất đơn hàng.'}
                            </p>
                        </div>

                        {!isReconciling && (
                            <Link
                                to={`/order-result/${order.id}`}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#09090b',
                                    color: '#ffffff',
                                    padding: '10px 20px',
                                    borderRadius: '9999px',
                                    fontWeight: 700,
                                    fontSize: '13px',
                                    textDecoration: 'none',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                Quay lại trang thanh toán →
                            </Link>
                        )}
                    </div>
                )}

                {/* Bảng danh sách mặt hàng trong đơn */}
                <div
                    style={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        padding: '16px 20px',
                        borderRadius: '8px',
                        marginBottom: '20px',
                    }}
                >
                    <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '12px', color: '#0f172a' }}>
                        Danh sách sản phẩm trong đơn
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
                                fontSize: '14px',
                                color: '#334155',
                            }}
                        >
                            <thead>
                                <tr
                                    style={{
                                        background: '#f8fafc',
                                        borderBottom: '1px solid #e2e8f0',
                                        color: '#475569',
                                        fontSize: '13px',
                                    }}
                                >
                                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>Mã SP</th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600 }}>
                                        Tên sản phẩm
                                    </th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>
                                        Đơn giá lúc đặt
                                    </th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>
                                        Số lượng
                                    </th>
                                    <th style={{ padding: '8px 12px', fontWeight: 600, textAlign: 'right' }}>
                                        Thành tiền
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {order.items.map((item) => (
                                    <tr
                                        key={item.productId}
                                        style={{ borderBottom: '1px solid #f1f5f9' }}
                                    >
                                        <td style={{ padding: '8px 12px', color: '#64748b' }}>
                                            #{item.productId}
                                        </td>
                                        <td style={{ padding: '8px 12px', fontWeight: 500, color: '#0f172a' }}>
                                            {item.productNameSnapshot}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            {formatCurrency(item.unitPriceSnapshot)}
                                        </td>
                                        <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                                            {item.quantity}
                                        </td>
                                        <td
                                            style={{
                                                padding: '8px 12px',
                                                textAlign: 'right',
                                                fontWeight: 600,
                                                color: '#0f172a',
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
                            marginTop: '12px',
                            paddingTop: '12px',
                            borderTop: '1px solid #e2e8f0',
                        }}
                    >
                        {order.voucherCode && Number(order.discountAmount) > 0 && (
                            <div style={{ fontSize: '13px', fontWeight: 600, color: '#15803d', marginBottom: '4px' }}>
                                Đã áp dụng mã {order.voucherCode}: -{formatCurrency(order.discountAmount)}
                            </div>
                        )}
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                            Tổng cộng: {formatCurrency(order.totalAmount)}
                        </div>
                    </div>
                </div>

                {/* Lịch sử các lần thanh toán */}
                {order.paymentAttempts?.length > 0 && (
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            padding: '16px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 600, marginTop: 0, marginBottom: '12px', color: '#0f172a' }}>
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
                                    fontSize: '14px',
                                    color: '#334155',
                                }}
                            >
                                <thead>
                                    <tr
                                        style={{
                                            background: '#f8fafc',
                                            borderBottom: '1px solid #e2e8f0',
                                            color: '#475569',
                                            fontSize: '13px',
                                        }}
                                    >
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Lần</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Kết quả</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Thời gian</th>
                                        <th style={{ padding: '8px 12px', fontWeight: 600 }}>Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.paymentAttempts.map((att) => (
                                        <tr
                                            key={att.id ?? att.attemptNumber}
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
                                                            : att.result === 'PENDING'
                                                                ? '#b45309'
                                                                : '#b91c1c',
                                                }}
                                            >
                                                {att.result === 'PENDING'
                                                    ? 'Đang xử lý/đối soát'
                                                    : PAYMENT_RESULT_LABELS[att.result] ||
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

                {isProcessing && (
                    <div
                        style={{
                            background: '#f0fdf4',
                            border: '1px solid #86efac',
                            padding: '16px 20px',
                            borderRadius: '8px',
                            marginBottom: '20px',
                        }}
                    >
                        <h2 style={{ fontSize: '16px', fontWeight: 600, margin: '0 0 8px', color: '#166534' }}>
                            Bạn đã nhận được hàng?
                        </h2>
                        <p style={{ margin: '0 0 12px', color: '#166534', fontSize: '14px' }}>
                            Chỉ xác nhận sau khi bạn đã nhận đơn hàng. Xác nhận sẽ chuyển trạng thái đơn sang Hoàn tất.
                        </p>
                        <button
                            type="button"
                            disabled={!canConfirmReceipt}
                            onClick={handleConfirmReceipt}
                            style={{
                                background: canConfirmReceipt ? '#166534' : '#94a3b8',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                fontWeight: 600,
                                fontSize: '14px',
                                cursor: canConfirmReceipt ? 'pointer' : 'not-allowed',
                            }}
                        >
                            {busy ? 'Đang xác nhận…' : 'Xác nhận đã nhận hàng'}
                        </button>
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
                    <div style={{ color: '#475569', fontSize: '14px' }}>
                        {isReconciling ? (
                            <span>
                                Đơn hàng đang có giao dịch <strong>Đang đối soát</strong> nên
                                tạm khóa hủy đơn.
                            </span>
                        ) : canCancel ? (
                            <span>
                                Bạn có thể hủy đơn hàng này. Khi hủy, tồn kho tại{' '}
                                <strong>{order.fulfillmentWarehouseName}</strong>{' '}
                                sẽ được{' '}
                                {isPaid
                                    ? 'hoàn trả lại vào kho.'
                                    : 'hủy giữ chỗ tại kho.'}
                            </span>
                        ) : (
                            <span>
                                Đơn hàng đang ở trạng thái{' '}
                                <strong>{getOrderStatusLabel(order.status)}</strong>{' '}
                                nên không thể hủy (chỉ có thể hủy khi đơn đang Chờ thanh toán hoặc Đã thanh toán).
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
                        {busy ? 'Đang xử lý...' : isReconciling ? 'Đang đối soát' : 'Hủy đơn hàng'}
                    </button>
                </div>
            </div>
        </>
    )
}

export default OrderTrackingPage
