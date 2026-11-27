import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import LucideIcon from '../components/LucideIcon'
import ProductPagination from '../components/ProductPagination'
import { useAuth } from '../context/AuthContext'
import {
    ADMIN_TRACKABLE_STAGES,
    DELIVERY_STAGE_RANK,
    DeliveryStage,
    OrderStatus,
    formatCurrency,
    formatDateTime,
    getDeliveryStageLabel,
    getOrderStatusLabel,
} from '../constants/order'
import { loadWarehouses } from '../services/inventoryApi'
import { adaptOrder } from '../services/orderAdapter'
import {
    addAdminOrderTrackingApi,
    getAdminOrdersApi,
    transitionAdminOrderToProcessingApi,
} from '../services/orderApi'

const PAGE_SIZE = 20

function loadAdminOrders(token, page, status, signal) {
    return getAdminOrdersApi(token, { page, limit: PAGE_SIZE, status, signal })
        .then(data => ({ ...data, orders: data.orders.map(adaptOrder) }))
}

function AdminOrderProcessingPage() {
    const { currentUser, token, refreshCurrentUser } = useAuth()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const requestedStatus = searchParams.get('status')
    const status = requestedStatus === OrderStatus.PROCESSING
        ? OrderStatus.PROCESSING
        : OrderStatus.PAID
    const parsedPage = Number(searchParams.get('page') ?? 1)
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1
    const [result, setResult] = useState(null)
    const [assignedWarehouse, setAssignedWarehouse] = useState(null)
    const [pickingOrder, setPickingOrder] = useState(null)
    const [revision, setRevision] = useState(0)
    const [pendingOrderId, setPendingOrderId] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const [trackingStage, setTrackingStage] = useState(DeliveryStage.PACKED)
    const [trackingNote, setTrackingNote] = useState('')
    const [trackingLocation, setTrackingLocation] = useState('')
    const [trackingCode, setTrackingCode] = useState('')
    const [trackingBusy, setTrackingBusy] = useState(false)
    const [trackingError, setTrackingError] = useState('')
    const submitting = useRef(false)
    const canManageOrders = ['ADMIN', 'WAREHOUSE_MANAGER'].includes(currentUser?.role)
    const isWarehouseManager = currentUser?.role === 'WAREHOUSE_MANAGER'
    const requestKey = `${token ?? ''}:${currentUser?.role ?? ''}:${currentUser?.assignedWarehouseId ?? ''}:${status}:${page}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const orders = currentResult?.data?.orders ?? []
    const pagination = currentResult?.data?.pagination

    useEffect(() => {
        if (!token || !canManageOrders) return undefined
        const controller = new AbortController()
        loadAdminOrders(token, page, status, controller.signal)
            .then(data => {
                if (!controller.signal.aborted) setResult({ requestKey, data })
            })
            .catch(error => {
                if (!controller.signal.aborted) setResult({ requestKey, error })
            })
        return () => controller.abort()
    }, [token, canManageOrders, page, status, requestKey])

    useEffect(() => {
        if (!token || !isWarehouseManager) return undefined
        const controller = new AbortController()
        loadWarehouses(token, controller.signal)
            .then(warehouses => {
                if (!controller.signal.aborted) {
                    const matched = warehouses.find(
                        warehouse => Number(warehouse.id) === Number(currentUser?.assignedWarehouseId)
                    ) ?? null
                    setAssignedWarehouse(matched)
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setAssignedWarehouse(null)
            })
        return () => controller.abort()
    }, [token, isWarehouseManager, currentUser?.assignedWarehouseId])

    useEffect(() => {
        if (!pickingOrder) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKeyDown = (event) => {
            if (event.key === 'Escape') setPickingOrder(null)
        }
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
        }
    }, [pickingOrder])

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
        return `${location.pathname}?${params.toString()}`
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
            setPickingOrder((current) => (current?.id === order.id ? null : current))
            setFeedback({ text: `Đơn hàng #${order.id} đã chuyển sang đang xử lý.` })
            setRevision(value => value + 1)
        } catch (error) {
            if (error.status === 403 && isWarehouseManager) {
                void refreshCurrentUser?.()
            }
            setFeedback({ error: true, text: error.message || 'Không thể cập nhật trạng thái đơn hàng.' })
            // Tải lại để đồng bộ nếu phản hồi bị mất nhưng backend đã xử lý yêu cầu.
            setRevision(value => value + 1)
        } finally {
            submitting.current = false
            setPendingOrderId(null)
        }
    }

    function openOrderModal(order) {
        const events = order.trackingEvents ?? []
        const maxRank = events.reduce(
            (max, event) => Math.max(max, DELIVERY_STAGE_RANK[event.stage] ?? 0),
            0
        )
        const nextSuggested =
            ADMIN_TRACKABLE_STAGES.find((s) => DELIVERY_STAGE_RANK[s] > maxRank) ??
            ADMIN_TRACKABLE_STAGES.find((s) => DELIVERY_STAGE_RANK[s] >= maxRank) ??
            DeliveryStage.OUT_FOR_DELIVERY
        const latestCode = [...events].reverse().find((e) => e.trackingCode)?.trackingCode ?? ''

        setPickingOrder(order)
        setTrackingStage(nextSuggested)
        setTrackingNote('')
        setTrackingLocation('')
        setTrackingCode(latestCode)
        setTrackingError('')
    }

    async function handleAddTrackingEvent(event) {
        event.preventDefault()
        if (!pickingOrder || trackingBusy || pickingOrder.status !== OrderStatus.PROCESSING) return

        setTrackingBusy(true)
        setTrackingError('')
        try {
            const created = await addAdminOrderTrackingApi(token, pickingOrder.id, {
                stage: trackingStage,
                note: trackingNote,
                location: trackingLocation,
                trackingCode,
            })
            setPickingOrder((current) =>
                current && current.id === pickingOrder.id
                    ? {
                          ...current,
                          trackingEvents: [...(current.trackingEvents ?? []), created],
                      }
                    : current
            )
            setTrackingNote('')
            setFeedback({
                text: `Đã cập nhật tiến độ đơn #${pickingOrder.id}: ${getDeliveryStageLabel(created.stage)}.`,
            })
            setRevision((value) => value + 1)
        } catch (err) {
            setTrackingError(err.message || 'Không thể cập nhật tiến độ giao hàng.')
        } finally {
            setTrackingBusy(false)
        }
    }

    if (!currentUser) return <Navigate to="/login" replace />
    if (!canManageOrders) return <Navigate to="/" replace />

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Xử lý đơn hàng</h1>
                    <p>
                        {isWarehouseManager
                            ? `Kiểm tra đơn đã thanh toán tại ${assignedWarehouse?.name || `Kho #${currentUser.assignedWarehouseId ?? '?'}`} và chuyển sang đang xử lý.`
                            : 'Kiểm tra đơn đã thanh toán và chuyển sang xử lý tại kho.'}
                    </p>
                </div>
                <div className="mgmt-head__actions">
                    {isWarehouseManager && (
                        <span className="mgmt-badge mgmt-badge--muted">
                            Kho phụ trách: {assignedWarehouse?.name || `Kho #${currentUser.assignedWarehouseId ?? '?'}`}
                        </span>
                    )}
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
                            : 'Đơn sẽ xuất hiện ở đây sau khi được bắt đầu xử lý.'}
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
                                        <th>Thao tác</th>
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
                                            <td>
                                                <div className="mgmt-head__actions">
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        onClick={() => openOrderModal(order)}
                                                    >
                                                        {status === OrderStatus.PROCESSING ? 'Sản phẩm & Tiến độ' : 'Xem sản phẩm'}
                                                    </button>
                                                    {status === OrderStatus.PAID && (
                                                        <button
                                                            type="button"
                                                            className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                                                            disabled={pendingOrderId !== null}
                                                            onClick={() => handleStartProcessing(order)}
                                                        >
                                                            {pendingOrderId === order.id ? 'Đang cập nhật…' : 'Bắt đầu xử lý'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
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

            {pickingOrder && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget) {
                            setPickingOrder(null)
                        }
                    }}
                >
                    <div
                        className="mgmt-modal mgmt-modal--wide"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="picking-list-title"
                    >
                        <div className="mgmt-modal__head">
                            <h2 id="picking-list-title" className="mgmt-modal__title">
                                Phiếu soạn hàng — Đơn #{pickingOrder.id}
                            </h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => setPickingOrder(null)}
                                aria-label="Đóng phiếu soạn hàng"
                            >
                                <LucideIcon name="x" size={18} strokeWidth={1.75} />
                            </button>
                        </div>

                        <p className="mgmt-note" style={{ marginTop: 10 }}>
                            Kho xuất: <strong>{pickingOrder.fulfillmentWarehouseName}</strong> · Khách hàng:{' '}
                            <strong>{pickingOrder.customerUsername || '—'}</strong> · Ngày đặt:{' '}
                            <strong>{formatDateTime(pickingOrder.createdAt)}</strong>
                        </p>

                        {pickingOrder.shippingAddress && (
                            <div
                                style={{
                                    background: '#f8fafc',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '8px',
                                    padding: '10px 14px',
                                    marginBottom: '12px',
                                    fontSize: '13px',
                                    color: '#334155',
                                }}
                            >
                                <div>
                                    <strong>Người nhận:</strong> {pickingOrder.shippingAddress.fullName} ·{' '}
                                    <strong>SĐT:</strong> {pickingOrder.shippingAddress.phone}
                                </div>
                                <div>
                                    <strong>Địa chỉ giao:</strong> {pickingOrder.shippingAddress.addressLine},{' '}
                                    {pickingOrder.shippingAddress.province}
                                </div>
                                {pickingOrder.shippingAddress.note && (
                                    <div style={{ color: '#64748b' }}>
                                        <strong>Ghi chú:</strong> {pickingOrder.shippingAddress.note}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="mgmt-table-wrap" style={{ marginBottom: 16 }}>
                            <table className="mgmt-table" style={{ minWidth: 460 }}>
                                <thead>
                                    <tr>
                                        <th>Mã SP</th>
                                        <th>Sản phẩm</th>
                                        <th className="num">SL cần lấy</th>
                                        <th className="num">Đơn giá</th>
                                        <th className="num">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pickingOrder.items.map((item) => (
                                        <tr key={item.productId}>
                                            <td>#{item.productId}</td>
                                            <td>{item.productNameSnapshot}</td>
                                            <td className="num">
                                                <strong>{item.quantity}</strong>
                                            </td>
                                            <td className="num">{formatCurrency(item.unitPriceSnapshot)}</td>
                                            <td className="num">{formatCurrency(item.lineTotal)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {pickingOrder.status === OrderStatus.PROCESSING && (
                            <div
                                style={{
                                    border: '1px solid #e5e5e5',
                                    borderRadius: '8px',
                                    padding: '14px 16px',
                                    marginBottom: '16px',
                                    background: '#fafafa',
                                }}
                            >
                                <h3 style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 700 }}>
                                    Tiến độ giao / nhận hàng
                                </h3>

                                {(pickingOrder.trackingEvents?.length ?? 0) > 0 ? (
                                    <ul
                                        style={{
                                            listStyle: 'none',
                                            margin: '0 0 12px',
                                            padding: 0,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
                                        }}
                                    >
                                        {pickingOrder.trackingEvents.map((ev, index) => (
                                            <li
                                                key={ev.id ?? `${ev.stage}-${index}`}
                                                style={{
                                                    fontSize: 13,
                                                    paddingLeft: 10,
                                                    borderLeft: '2px solid #171717',
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                                    <strong>{getDeliveryStageLabel(ev.stage)}</strong>
                                                    <span style={{ color: '#737373' }}>{formatDateTime(ev.createdAt)}</span>
                                                </div>
                                                {ev.note && <div style={{ color: '#404040' }}>{ev.note}</div>}
                                                {(ev.location || ev.trackingCode) && (
                                                    <div style={{ color: '#737373' }}>
                                                        {ev.location ? `Địa điểm: ${ev.location}` : ''}
                                                        {ev.location && ev.trackingCode ? ' · ' : ''}
                                                        {ev.trackingCode ? `Mã vận đơn: ${ev.trackingCode}` : ''}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="mgmt-note" style={{ marginTop: 0 }}>Chưa có mốc vận chuyển bổ sung.</p>
                                )}

                                <form onSubmit={handleAddTrackingEvent} style={{ display: 'grid', gap: 10 }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label htmlFor="tracking-stage-select" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                                Mốc tiến độ mới
                                            </label>
                                            <select
                                                id="tracking-stage-select"
                                                className="mgmt-select"
                                                style={{ width: '100%' }}
                                                value={trackingStage}
                                                onChange={(e) => setTrackingStage(e.target.value)}
                                            >
                                                {ADMIN_TRACKABLE_STAGES.map((stageOption) => {
                                                    const currentMax = (pickingOrder.trackingEvents ?? []).reduce(
                                                        (max, ev) => Math.max(max, DELIVERY_STAGE_RANK[ev.stage] ?? 0),
                                                        0
                                                    )
                                                    const disabled = DELIVERY_STAGE_RANK[stageOption] < currentMax
                                                    return (
                                                        <option key={stageOption} value={stageOption} disabled={disabled}>
                                                            {getDeliveryStageLabel(stageOption)}
                                                        </option>
                                                    )
                                                })}
                                            </select>
                                        </div>
                                        <div>
                                            <label htmlFor="tracking-code-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                                Mã vận đơn (tuỳ chọn)
                                            </label>
                                            <input
                                                id="tracking-code-input"
                                                type="text"
                                                className="mgmt-input"
                                                style={{ width: '100%' }}
                                                maxLength={64}
                                                placeholder="VD: GHN-884120"
                                                value={trackingCode}
                                                onChange={(e) => setTrackingCode(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                                        <div>
                                            <label htmlFor="tracking-location-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                                Địa điểm (tuỳ chọn)
                                            </label>
                                            <input
                                                id="tracking-location-input"
                                                type="text"
                                                className="mgmt-input"
                                                style={{ width: '100%' }}
                                                maxLength={160}
                                                placeholder="VD: Kho phân loại HCM"
                                                value={trackingLocation}
                                                onChange={(e) => setTrackingLocation(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label htmlFor="tracking-note-input" style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                                                Ghi chú (tuỳ chọn)
                                            </label>
                                            <input
                                                id="tracking-note-input"
                                                type="text"
                                                className="mgmt-input"
                                                style={{ width: '100%' }}
                                                maxLength={255}
                                                placeholder="Mô tả chi tiết..."
                                                value={trackingNote}
                                                onChange={(e) => setTrackingNote(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    {trackingError && (
                                        <p role="alert" style={{ margin: 0, color: '#dc2626', fontSize: 13 }}>
                                            {trackingError}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                        <button
                                            type="submit"
                                            className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                                            disabled={trackingBusy}
                                        >
                                            {trackingBusy ? 'Đang lưu tiến độ…' : 'Cập nhật tiến độ'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        <div className="mgmt-modal__actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 14, fontWeight: 700 }}>
                                Tổng ({pickingOrder.itemCount} sản phẩm): {formatCurrency(pickingOrder.totalAmount)}
                            </span>
                            <div className="mgmt-head__actions">
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--ghost"
                                    onClick={() => setPickingOrder(null)}
                                >
                                    Đóng
                                </button>
                                {pickingOrder.status === OrderStatus.PAID && (
                                    <button
                                        type="button"
                                        className="mgmt-btn mgmt-btn--primary"
                                        disabled={pendingOrderId !== null}
                                        onClick={() => handleStartProcessing(pickingOrder)}
                                    >
                                        {pendingOrderId === pickingOrder.id ? 'Đang cập nhật…' : 'Bắt đầu xử lý'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminOrderProcessingPage
