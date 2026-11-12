import { useEffect, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import ProductPagination from '../components/ProductPagination'
import { useAuth } from '../context/AuthContext'
import { OrderStatus, formatCurrency, formatDateTime, getOrderStatusLabel } from '../constants/order'
import { adaptOrder } from '../services/orderAdapter'
import { getAdminOrdersApi, transitionAdminOrderToProcessingApi } from '../services/orderApi'

const PAGE_SIZE = 20

function loadAdminOrders(token, page, status, signal) {
    return getAdminOrdersApi(token, { page, limit: PAGE_SIZE, status, signal })
        .then(data => ({ ...data, orders: data.orders.map(adaptOrder) }))
}

function AdminOrderProcessingPage() {
    const { currentUser, token } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedStatus = searchParams.get('status')
    const status = requestedStatus === OrderStatus.PROCESSING
        ? OrderStatus.PROCESSING
        : OrderStatus.PAID
    const parsedPage = Number(searchParams.get('page') ?? 1)
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const [result, setResult] = useState(null)
    const [revision, setRevision] = useState(0)
    const [pendingOrderId, setPendingOrderId] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const submitting = useRef(false)
    const requestKey = `${token ?? ''}:${status}:${page}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const orders = currentResult?.data?.orders ?? []
    const pagination = currentResult?.data?.pagination

    useEffect(() => {
        if (!token || currentUser?.role !== 'ADMIN') return undefined
        const controller = new AbortController()
        loadAdminOrders(token, page, status, controller.signal)
            .then(data => {
                if (!controller.signal.aborted) setResult({ requestKey, data })
            })
            .catch(error => {
                if (!controller.signal.aborted) setResult({ requestKey, error })
            })
        return () => controller.abort()
    }, [token, currentUser?.role, page, status, requestKey])

    function changeStatus(nextStatus) {
        const params = new URLSearchParams(searchParams)
        params.set('status', nextStatus)
        params.delete('page')
        setSearchParams(params)
        setFeedback(null)
    }

    function getPageHref(nextPage) {
        const params = new URLSearchParams(searchParams)
        if (nextPage <= 1) params.delete('page')
        else params.set('page', String(nextPage))
        params.set('status', status)
        return `/admin/orders/processing?${params.toString()}`
    }

    async function handleStartProcessing(order) {
        if (submitting.current || order.status !== OrderStatus.PAID) return
        const confirmed = window.confirm(`Chuyển đơn #${order.id} sang trạng thái đang xử lý? Khách hàng sẽ không thể hủy đơn sau bước này.`)
        if (!confirmed) return

        submitting.current = true
        setPendingOrderId(order.id)
        setFeedback(null)
        try {
            await transitionAdminOrderToProcessingApi(token, order.id)
            setFeedback({ text: `Đơn hàng #${order.id} đã chuyển sang đang xử lý.` })
            setRevision(value => value + 1)
        } catch (error) {
            setFeedback({ error: true, text: error.message || 'Không thể cập nhật trạng thái đơn hàng.' })
            // Tải lại để đồng bộ nếu phản hồi bị mất nhưng backend đã xử lý yêu cầu.
            setRevision(value => value + 1)
        } finally {
            submitting.current = false
            setPendingOrderId(null)
        }
    }

    if (!currentUser) return <Navigate to="/login" replace />
    if (currentUser.role !== 'ADMIN') return <Navigate to="/" replace />

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Xử lý đơn hàng</h1>
                    <p>Kiểm tra đơn đã thanh toán và chuyển sang xử lý tại kho.</p>
                </div>
                <div className="mgmt-head__actions">
                    <button type="button" className="mgmt-btn mgmt-btn--ghost" onClick={() => setRevision(value => value + 1)}>
                        Tải lại
                    </button>
                </div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <div className="mgmt-head__actions" role="tablist" aria-label="Lọc trạng thái đơn hàng">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={status === OrderStatus.PAID}
                            className={`mgmt-btn ${status === OrderStatus.PAID ? 'mgmt-btn--primary' : 'mgmt-btn--ghost'}`}
                            onClick={() => changeStatus(OrderStatus.PAID)}
                        >
                            Chờ xử lý
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={status === OrderStatus.PROCESSING}
                            className={`mgmt-btn ${status === OrderStatus.PROCESSING ? 'mgmt-btn--primary' : 'mgmt-btn--ghost'}`}
                            onClick={() => changeStatus(OrderStatus.PROCESSING)}
                        >
                            Đang xử lý
                        </button>
                    </div>
                    {pagination && <span>{pagination.total} đơn hàng</span>}
                </div>

                {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
                {currentResult?.error ? (
                    <div className="mgmt-empty" role="alert">
                        <strong>Không tải được danh sách đơn hàng</strong>
                        {currentResult.error.message}
                        <button type="button" className="mgmt-btn mgmt-btn--ghost" onClick={() => setRevision(value => value + 1)}>
                            Thử lại
                        </button>
                    </div>
                ) : !currentResult ? (
                    <div className="mgmt-empty" role="status">Đang tải danh sách đơn hàng…</div>
                ) : orders.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>{status === OrderStatus.PAID ? 'Không có đơn chờ xử lý' : 'Chưa có đơn đang xử lý'}</strong>
                        {status === OrderStatus.PAID
                            ? 'Các đơn đã thanh toán sẽ xuất hiện ở đây.'
                            : 'Đơn sẽ xuất hiện ở đây sau khi Admin bắt đầu xử lý.'}
                    </div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Mã đơn</th>
                                        <th>Khách hàng</th>
                                        <th>Kho xử lý</th>
                                        <th className="num">Số lượng</th>
                                        <th className="num">Tổng tiền</th>
                                        <th>Ngày đặt</th>
                                        <th>Trạng thái</th>
                                        {status === OrderStatus.PAID && <th>Thao tác</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {orders.map(order => (
                                        <tr key={order.id}>
                                            <td>#{order.id}</td>
                                            <td>{order.customerUsername || '—'}</td>
                                            <td>{order.fulfillmentWarehouseName}</td>
                                            <td className="num">{order.itemCount}</td>
                                            <td className="num">{formatCurrency(order.totalAmount)}</td>
                                            <td>{formatDateTime(order.createdAt)}</td>
                                            <td><span className={`mgmt-badge ${status === OrderStatus.PAID ? 'mgmt-badge--warning' : 'mgmt-badge--success'}`}>{getOrderStatusLabel(order.status)}</span></td>
                                            {status === OrderStatus.PAID && (
                                                <td>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                                                        disabled={pendingOrderId !== null}
                                                        onClick={() => handleStartProcessing(order)}
                                                    >
                                                        {pendingOrderId === order.id ? 'Đang cập nhật…' : 'Bắt đầu xử lý'}
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pagination && (
                            <ProductPagination
                                page={pagination.page}
                                totalPages={pagination.totalPages}
                                getPageHref={getPageHref}
                                ariaLabel="Phân trang đơn hàng"
                            />
                        )}
                    </>
                )}
            </section>
        </div>
    )
}

export default AdminOrderProcessingPage
