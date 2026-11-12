import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCustomerOrders } from '../hooks/useCustomerOrders.js'
import { cancelOrderApi } from '../services/orderApi.js'
import { acquireActionKey, clearActionKey } from '../services/requestKeys.js'
import {
    OrderStatus,
    getOrderStatusLabel,
    formatCurrency,
    formatDateTime,
} from '../constants/order'

function PurchaseHistoryPage() {
    const { currentUser, token, authLoading } = useAuth()
    const navigate = useNavigate()
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [page, setPage] = useState(1)
    const [feedback, setFeedback] = useState(null)
    const [busyOrderId, setBusyOrderId] = useState(null)
    const { orders: myOrders, pagination, loading, error, reload } =
        useCustomerOrders(token, statusFilter, page)
    const filteredOrders = myOrders // backend đã lọc status

    if (authLoading) {
        return (
            <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
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
                <div style={{ maxWidth: '900px', margin: '40px auto', padding: '20px' }}>
                    <h1>Không có quyền truy cập</h1>
                    <p>Chức năng lịch sử mua hàng chỉ dành cho khách hàng.</p>
                </div>
            </>
        )
    }

    // Xử lý hủy đơn hàng ngay tại danh sách lịch sử (UC11: SR-CAN-01..04)
    const handleCancelOrder = async (order) => {
        if (busyOrderId || !order.canCancel) return
        if (!window.confirm(`Bạn chắc chắn muốn hủy đơn #${order.id}?`)) return
        const scope = `cancel:${currentUser.id}:${order.id}`
        setBusyOrderId(order.id)
        try {
            await cancelOrderApi(token, order.id, acquireActionKey(scope))
            clearActionKey(scope)
            setFeedback({ ok: true, message: `Đã hủy đơn #${order.id}.` })
            if (
                statusFilter !== 'ALL' &&
                statusFilter !== OrderStatus.CANCELLED &&
                myOrders.length === 1 &&
                page > 1
            ) {
                setPage((p) => Math.max(1, p - 1))
            } else {
                reload()
            }
        } catch (err) {
            setFeedback({
                ok: false,
                message: err.status === 503
                    ? 'Chưa xác định được kết quả hủy. Hãy tải lại lịch sử để kiểm tra, không gửi lệnh hủy mới ngay.'
                    : err.message,
            })
            reload()
        } finally {
            setBusyOrderId(null)
        }
    }

    return (
        <>
            <div style={{ maxWidth: '960px', margin: '30px auto', padding: '0 20px' }}>
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
                        <h1 style={{ margin: '0 0 6px 0' }}>Lịch sử mua hàng</h1>
                        <p style={{ margin: 0, color: '#64748b' }}>
                            Danh sách các đơn hàng của tài khoản{' '}
                            <strong>{currentUser.username}</strong> ({pagination.total}{' '}
                            đơn)
                        </p>
                    </div>

                    {/* Bộ lọc theo trạng thái đơn hàng */}
                    <div>
                        <label
                            htmlFor="order-status-filter"
                            style={{ marginRight: '8px', fontWeight: '500' }}
                        >
                            Trạng thái:
                        </label>
                        <select
                            id="order-status-filter"
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value)
                                setPage(1)
                            }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                            }}
                        >
                            <option value="ALL">Tất cả trạng thái</option>
                            <option value={OrderStatus.PENDING_PAYMENT}>
                                Chờ thanh toán (PendingPayment)
                            </option>
                            <option value={OrderStatus.PAID}>
                                Đã thanh toán (Paid)
                            </option>
                            <option value={OrderStatus.PROCESSING}>
                                Đang xử lý (Processing)
                            </option>
                            <option value={OrderStatus.COMPLETED}>
                                Hoàn tất (Completed)
                            </option>
                            <option value={OrderStatus.CANCELLED}>
                                Đã hủy (Cancelled)
                            </option>
                        </select>
                    </div>
                </div>

                {feedback && (
                    <div
                        role="alert"
                        style={{
                            background: feedback.ok ? '#f0fdf4' : '#fef2f2',
                            border: `1px solid ${
                                feedback.ok ? '#86efac' : '#fca5a5'
                            }`,
                            color: feedback.ok ? '#166534' : '#991b1b',
                            padding: '12px 16px',
                            borderRadius: '6px',
                            marginBottom: '20px',
                            fontWeight: '500',
                        }}
                    >
                        {feedback.message}
                    </div>
                )}

                {loading ? (
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '32px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ color: '#475569', margin: 0 }}>
                            Đang tải danh sách đơn hàng...
                        </p>
                    </div>
                ) : error ? (
                    <div
                        role="alert"
                        style={{
                            background: '#fef2f2',
                            border: '1px solid #fca5a5',
                            borderRadius: '8px',
                            padding: '24px',
                            color: '#991b1b',
                        }}
                    >
                        <p style={{ margin: '0 0 12px 0', fontWeight: '500' }}>
                            {error.message || 'Không thể tải danh sách đơn hàng.'}
                        </p>
                        <button
                            type="button"
                            onClick={reload}
                            style={{
                                background: '#2563eb',
                                color: '#ffffff',
                                border: 'none',
                                padding: '8px 16px',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontWeight: '500',
                            }}
                        >
                            Thử lại
                        </button>
                    </div>
                ) : filteredOrders.length === 0 ? (
                    <div
                        style={{
                            background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            borderRadius: '8px',
                            padding: '32px',
                            textAlign: 'center',
                        }}
                    >
                        <p style={{ color: '#475569', marginBottom: '16px' }}>
                            {statusFilter === 'ALL'
                                ? 'Bạn chưa có đơn hàng nào.'
                                : 'Không có đơn hàng nào khớp với bộ lọc trạng thái.'}
                        </p>
                        <Link
                            to="/products"
                            style={{
                                background: '#2563eb',
                                color: '#ffffff',
                                padding: '10px 18px',
                                borderRadius: '6px',
                                textDecoration: 'none',
                                fontWeight: '500',
                            }}
                        >
                            Khám phá sản phẩm
                        </Link>
                    </div>
                ) : (
                    <div
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px',
                        }}
                    >
                        {filteredOrders.map((order) => {
                            const isPaid = order.status === OrderStatus.PAID
                            const isCancelled =
                                order.status === OrderStatus.CANCELLED
                            const isPending =
                                order.status === OrderStatus.PENDING_PAYMENT
                            const canCancel = order.canCancel && !busyOrderId

                            return (
                                <div
                                    key={order.id}
                                    style={{
                                        background: '#ffffff',
                                        border: '1px solid #e2e8f0',
                                        borderRadius: '8px',
                                        padding: '20px',
                                        boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '10px',
                                            borderBottom: '1px solid #f1f5f9',
                                            paddingBottom: '12px',
                                            marginBottom: '12px',
                                        }}
                                    >
                                        <div>
                                            <strong style={{ fontSize: '1.1rem' }}>
                                                Mã đơn: {order.id}
                                            </strong>
                                            <span
                                                style={{
                                                    color: '#64748b',
                                                    marginLeft: '12px',
                                                    fontSize: '0.9rem',
                                                }}
                                            >
                                                Ngày đặt:{' '}
                                                {formatDateTime(order.createdAt)}
                                            </span>
                                        </div>

                                        <div>
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
                                                    padding: '4px 12px',
                                                    borderRadius: '999px',
                                                    fontWeight: 'bold',
                                                    fontSize: '0.88rem',
                                                }}
                                            >
                                                {getOrderStatusLabel(order.status)} (
                                                {order.status})
                                            </span>
                                        </div>
                                    </div>

                                    <p
                                        style={{
                                            margin: '0 0 10px 0',
                                            color: '#334155',
                                            fontSize: '0.95rem',
                                        }}
                                    >
                                        <strong>Kho phụ trách:</strong>{' '}
                                        {order.fulfillmentWarehouseName}
                                        {isPending && (
                                            <span
                                                style={{
                                                    marginLeft: '10px',
                                                    color: order.reservationActive
                                                        ? '#15803d'
                                                        : '#b45309',
                                                    fontSize: '0.88rem',
                                                }}
                                            >
                                                (
                                                {order.reservationActive
                                                    ? 'Đang giữ hàng tại kho'
                                                    : 'Hàng giữ đã giải phóng — có thể thử lại thanh toán'}
                                                )
                                            </span>
                                        )}
                                    </p>

                                    {/* Danh sách sản phẩm snapshot */}
                                    <div
                                        style={{
                                            background: '#f8fafc',
                                            padding: '10px 14px',
                                            borderRadius: '6px',
                                            marginBottom: '12px',
                                        }}
                                    >
                                        {order.items.map((item) => (
                                            <div
                                                key={item.productId}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent:
                                                        'space-between',
                                                    padding: '4px 0',
                                                    fontSize: '0.95rem',
                                                }}
                                            >
                                                <span>
                                                    {item.productNameSnapshot} ×{' '}
                                                    <strong>
                                                        {item.quantity}
                                                    </strong>
                                                </span>
                                                <span>
                                                    {formatCurrency(
                                                        item.lineTotal
                                                    )}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            flexWrap: 'wrap',
                                            gap: '12px',
                                        }}
                                    >
                                        <div
                                            style={{
                                                fontSize: '1.1rem',
                                                fontWeight: 'bold',
                                            }}
                                        >
                                            Tổng tiền:{' '}
                                            {formatCurrency(order.totalAmount)}
                                        </div>

                                        <div
                                            style={{
                                                display: 'flex',
                                                flexWrap: 'wrap',
                                                gap: '10px',
                                            }}
                                        >
                                            <Link
                                                to={`/orders/${order.id}`}
                                                style={{
                                                    background: '#eff6ff',
                                                    color: '#1d4ed8',
                                                    border: '1px solid #bfdbfe',
                                                    padding: '8px 14px',
                                                    borderRadius: '6px',
                                                    textDecoration: 'none',
                                                    fontWeight: '500',
                                                    fontSize: '0.9rem',
                                                }}
                                            >
                                                Xem chi tiết & Theo dõi
                                            </Link>

                                            {isPending && (
                                                <button
                                                    type="button"
                                                    disabled={Boolean(order.paymentInProgress)}
                                                    onClick={() =>
                                                        navigate(
                                                            `/order-result/${order.id}`
                                                        )
                                                    }
                                                    style={{
                                                        background: order.paymentInProgress
                                                            ? '#94a3b8'
                                                            : '#16a34a',
                                                        color: '#ffffff',
                                                        border: 'none',
                                                        padding: '8px 14px',
                                                        borderRadius: '6px',
                                                        fontWeight: '500',
                                                        fontSize: '0.9rem',
                                                        cursor: order.paymentInProgress
                                                            ? 'not-allowed'
                                                            : 'pointer',
                                                    }}
                                                >
                                                    {order.paymentInProgress
                                                        ? 'Đang đối soát'
                                                        : order.paymentAttempts
                                                            ?.length > 0
                                                            ? 'Thử lại thanh toán'
                                                            : 'Thanh toán ngay'}
                                                </button>
                                            )}

                                            {order.canCancel && (
                                                <button
                                                    type="button"
                                                    disabled={Boolean(busyOrderId) || Boolean(order.paymentInProgress)}
                                                    onClick={() =>
                                                        handleCancelOrder(order)
                                                    }
                                                    style={{
                                                        background: '#fef2f2',
                                                        color: '#dc2626',
                                                        border: '1px solid #fca5a5',
                                                        padding: '8px 14px',
                                                        borderRadius: '6px',
                                                        fontWeight: '500',
                                                        fontSize: '0.9rem',
                                                        cursor: canCancel
                                                            ? 'pointer'
                                                            : 'not-allowed',
                                                        opacity: canCancel ? 1 : 0.6,
                                                    }}
                                                >
                                                    {busyOrderId === order.id
                                                        ? 'Đang hủy...'
                                                        : 'Hủy đơn hàng'}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                <div style={{ display: 'flex', gap: 12, marginTop: 20, alignItems: 'center' }}>
                    <button
                        type="button"
                        disabled={loading || page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: loading || page <= 1 ? '#f1f5f9' : '#ffffff',
                            cursor: loading || page <= 1 ? 'not-allowed' : 'pointer',
                        }}
                    >
                        Trang trước
                    </button>
                    <span>
                        Trang {pagination.page} / {Math.max(1, pagination.totalPages)} —{' '}
                        {pagination.total} đơn
                    </span>
                    <button
                        type="button"
                        disabled={loading || page >= pagination.totalPages}
                        onClick={() => setPage((p) => p + 1)}
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background:
                                loading || page >= pagination.totalPages
                                    ? '#f1f5f9'
                                    : '#ffffff',
                            cursor:
                                loading || page >= pagination.totalPages
                                    ? 'not-allowed'
                                    : 'pointer',
                        }}
                    >
                        Trang sau
                    </button>
                </div>
            </div>
        </>
    )
}

export default PurchaseHistoryPage
