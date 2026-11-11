import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import {
    loadWarehouseAlerts,
    loadWarehouseInventory,
    loadWarehouses,
    saveWarehouseThreshold,
} from '../services/inventoryApi.js'
import ProductThumb from '../components/ProductThumb'
import ProductPagination from '../components/ProductPagination'
import {
    getInventoryPage,
    getInventoryPageHref,
    useNormalizeInventoryPages,
} from '../hooks/useInventoryPagination'

function ThresholdForm({ products, selectedProductId, currentThreshold, onProductChange, onSave, pending }) {
    const [input, setInput] = useState(String(currentThreshold))

    return (
        <div className="mgmt-toolbar" style={{ alignItems: 'center' }}>
            <label className="mgmt-field" htmlFor="low-stock-product-select">
                Sản phẩm
                <select
                    id="low-stock-product-select"
                    className="mgmt-select"
                    value={selectedProductId}
                    onChange={event => onProductChange(Number(event.target.value))}
                    disabled={pending || products.length === 0}
                >
                    {products.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}
                </select>
            </label>
            <label className="mgmt-field" htmlFor="low-stock-threshold">
                Ngưỡng
                <input
                    id="low-stock-threshold"
                    className="mgmt-input"
                    style={{ width: 100, flex: 'none', minWidth: 0 }}
                    type="number"
                    min="0"
                    step="1"
                    value={input}
                    disabled={pending}
                    onChange={event => setInput(event.target.value)}
                />
            </label>
            <button
                type="button"
                className="mgmt-btn mgmt-btn--primary"
                disabled={pending || products.length === 0}
                onClick={() => onSave(selectedProductId, input)}
            >
                {pending ? 'Đang lưu…' : 'Lưu ngưỡng'}
            </button>
        </div>
    )
}

function LowStockAlertsPage() {
    const { currentUser, token } = useAuth()
    const { products } = useProducts()
    const [searchParams, setSearchParams] = useSearchParams()
    const [data, setData] = useState({ warehouses: [], inventory: [], alerts: [], loading: true, error: null })
    const [reloadKey, setReloadKey] = useState(0)
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [keyword, setKeyword] = useState('')
    const [selectedProductId, setSelectedProductId] = useState(Number(products[0]?.id || 1))
    const [pending, setPending] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const isWarehouseManager = currentUser?.role === 'WAREHOUSE_MANAGER'
    const isAdmin = currentUser?.role === 'ADMIN'
    const assignedWarehouseId = currentUser?.assignedWarehouseId
    const canEditThreshold = isWarehouseManager && Boolean(assignedWarehouseId)

    useEffect(() => {
        if (!token || (!isAdmin && !isWarehouseManager)) return undefined
        const controller = new AbortController()

        async function loadAlertsData() {
            setData(previous => ({ ...previous, loading: true, error: null }))
            try {
                const warehouses = await loadWarehouses(token, controller.signal)
                const [inventoryPages, alerts] = await Promise.all([
                    Promise.all(warehouses.map(warehouse =>
                        loadWarehouseInventory(token, warehouse.id, controller.signal)
                    )),
                    loadWarehouseAlerts(token, undefined, controller.signal),
                ])
                if (!controller.signal.aborted) {
                    setData({ warehouses, inventory: inventoryPages.flat(), alerts, loading: false, error: null })
                }
            } catch (error) {
                if (!controller.signal.aborted) setData(previous => ({ ...previous, loading: false, error }))
            }
        }

        void loadAlertsData()
        return () => controller.abort()
    }, [token, isAdmin, isWarehouseManager, reloadKey])

    const warehouses = data.warehouses
    const warehouseParam = searchParams.get('warehouseId')
    const selectedWarehouseId = warehouses.some(warehouse => String(warehouse.id) === warehouseParam)
        ? warehouseParam
        : 'all'

    function handleAlertWarehouseChange(event) {
        const params = new URLSearchParams(searchParams)
        const value = event.target.value
        if (value === 'all') params.delete('warehouseId')
        else params.set('warehouseId', value)
        params.delete('page')
        setSearchParams(params)
    }

    const alerts = useMemo(() => {
        const inventoryByKey = new Map(data.inventory.map(item => [`${item.warehouseId}:${item.productId}`, item]))
        return data.alerts
            .filter(alert => selectedWarehouseId === 'all' || Number(alert.warehouseId) === Number(selectedWarehouseId))
            .map(alert => {
                const inventory = inventoryByKey.get(`${alert.warehouseId}:${alert.productId}`)
                const product = products.find(item => Number(item.id) === Number(alert.productId))
                const warehouse = warehouses.find(item => Number(item.id) === Number(alert.warehouseId))
                const available = Number(alert.currentAvailable)
                return {
                    ...alert,
                    product,
                    productName: alert.productName || product?.name || 'Không xác định',
                    warehouseName: warehouse?.name || 'Không xác định',
                    onHand: inventory?.onHand ?? available,
                    reserved: inventory?.reserved ?? 0,
                    available,
                    status: available <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
                }
            })
            .sort((a, b) => a.available - b.available)
    }, [data.alerts, data.inventory, products, selectedWarehouseId, warehouses])

    const selectedProductInventory = data.inventory.find(item =>
        Number(item.warehouseId) === Number(assignedWarehouseId) &&
        Number(item.productId) === Number(selectedProductId)
    )
    const currentThreshold = selectedProductInventory?.lowStockThreshold ?? 0

    async function handleSaveThreshold(productId, rawInput) {
        if (!canEditThreshold) {
            setFeedback({ error: true, text: 'Bạn không có quyền thiết lập ngưỡng cảnh báo.' })
            return
        }
        const threshold = Number(rawInput)
        if (rawInput.trim() === '' || !Number.isSafeInteger(threshold) || threshold < 0) {
            setFeedback({ error: true, text: 'Ngưỡng cảnh báo phải là số nguyên không âm (>= 0).' })
            return
        }

        setPending(true)
        setFeedback(null)
        try {
            await saveWarehouseThreshold(token, assignedWarehouseId, productId, threshold)
            setFeedback({ text: 'Đã lưu ngưỡng cảnh báo.' })
            setReloadKey(value => value + 1)
        } catch (error) {
            setFeedback({ error: true, text: error.message || 'Không thể lưu ngưỡng cảnh báo.' })
        } finally {
            setPending(false)
        }
    }

    const outOfStockCount = alerts.filter(item => item.status === 'OUT_OF_STOCK').length
    const lowStockCount = alerts.filter(item => item.status === 'LOW_STOCK').length
    const visibleAlerts = alerts.filter(item =>
        (statusFilter === 'ALL' || item.status === statusFilter) &&
        item.productName.toLowerCase().includes(keyword.trim().toLowerCase())
    )
    const alertsPage = getInventoryPage(visibleAlerts.length, searchParams.get('page'))
    const alertPageRows = visibleAlerts.slice(alertsPage.start, alertsPage.end)

    useNormalizeInventoryPages(searchParams, setSearchParams, { page: alertsPage.page }, isAdmin || isWarehouseManager)

    if (!currentUser) return <Navigate to="/" replace />
    if (!isWarehouseManager && !isAdmin) {
        return <div className="mgmt-page"><h1>Không có quyền truy cập</h1><p>Chức năng này chỉ dành cho nhân viên quản lý kho và quản trị viên.</p></div>
    }

    const assignedWarehouse = warehouses.find(warehouse => Number(warehouse.id) === Number(assignedWarehouseId))
    if (data.loading) return <div className="mgmt-page"><h1>Cảnh báo tồn kho</h1><p role="status">Đang tải cảnh báo từ máy chủ…</p></div>
    if (data.error) {
        return (
            <div className="mgmt-page">
                <h1>Cảnh báo tồn kho</h1>
                <p role="alert">{data.error.message || 'Không thể tải dữ liệu cảnh báo.'}</p>
                <button className="mgmt-btn mgmt-btn--primary" type="button" onClick={() => setReloadKey(value => value + 1)}>Thử tải lại</button>
            </div>
        )
    }

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Cảnh báo tồn kho</h1>
                    <p>Theo dõi các cảnh báo tồn kho đang mở trong phạm vi được phép xem.</p>
                </div>
                <div className="mgmt-head__actions">
                    {isAdmin ? (
                        <label className="mgmt-field" htmlFor="alerts-warehouse-filter">
                            Kho
                            <select id="alerts-warehouse-filter" className="mgmt-select" value={selectedWarehouseId} onChange={handleAlertWarehouseChange}>
                                <option value="all">Tất cả kho</option>
                                {warehouses.map(warehouse => <option key={warehouse.id} value={warehouse.id}>{warehouse.name}</option>)}
                            </select>
                        </label>
                    ) : (
                        <span className="mgmt-badge mgmt-badge--muted">Kho được phân công: {assignedWarehouse?.name || 'Chưa xác định'}</span>
                    )}
                </div>
            </div>

            <div className="mgmt-kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="mgmt-kpi"><h3>Tổng cảnh báo</h3><p>{alerts.length}</p></div>
                <div className="mgmt-kpi is-warning"><h3>Sắp hết hàng</h3><p>{lowStockCount}</p></div>
                <div className="mgmt-kpi is-danger"><h3>Đã hết hàng</h3><p>{outOfStockCount}</p></div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head"><h2>Thiết lập ngưỡng cảnh báo theo sản phẩm</h2></div>
                <p className="mgmt-note">Ngưỡng được lưu trong hệ thống riêng cho từng sản phẩm tại kho được phân công.</p>
                {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
                {canEditThreshold ? (
                    <ThresholdForm
                        key={`${assignedWarehouseId}-${selectedProductId}-${currentThreshold}`}
                        products={products}
                        selectedProductId={selectedProductId}
                        currentThreshold={currentThreshold}
                        onProductChange={setSelectedProductId}
                        onSave={handleSaveThreshold}
                        pending={pending}
                    />
                ) : (
                    <p className="mgmt-note" style={{ marginBottom: 0 }}>Chỉ Quản lý kho mới có quyền thiết lập ngưỡng cho kho được phân công.</p>
                )}
            </section>

            <section className="mgmt-card">
                <div className="mgmt-card__head"><h2>Danh sách cảnh báo đang mở</h2></div>
                <div className="mgmt-toolbar">
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm sản phẩm..."
                        value={keyword}
                        onChange={event => {
                            setKeyword(event.target.value)
                            if (searchParams.has('page')) {
                                const params = new URLSearchParams(searchParams)
                                params.delete('page')
                                setSearchParams(params, { replace: true })
                            }
                        }}
                        aria-label="Tìm sản phẩm trong cảnh báo"
                    />
                    <select
                        className="mgmt-select"
                        value={statusFilter}
                        onChange={event => {
                            setStatusFilter(event.target.value)
                            if (searchParams.has('page')) {
                                const params = new URLSearchParams(searchParams)
                                params.delete('page')
                                setSearchParams(params)
                            }
                        }}
                        aria-label="Lọc theo trạng thái"
                    >
                        <option value="ALL">Mọi trạng thái</option>
                        <option value="LOW_STOCK">Sắp hết hàng</option>
                        <option value="OUT_OF_STOCK">Đã hết hàng</option>
                    </select>
                </div>
                {visibleAlerts.length === 0 ? (
                    <div className="mgmt-empty"><strong>Không có cảnh báo</strong>{alerts.length === 0 ? 'Hiện không có cảnh báo đang mở.' : 'Không có cảnh báo nào khớp bộ lọc.'}</div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead><tr><th>Kho</th><th>Sản phẩm</th><th className="num">Tồn thực tế</th><th className="num">Đang giữ</th><th className="num">Có thể bán</th><th className="num">Ngưỡng</th><th>Trạng thái</th></tr></thead>
                                <tbody>
                                    {alertPageRows.map(item => (
                                        <tr key={`${item.warehouseId}-${item.productId}`}>
                                            <td>{item.warehouseName}</td>
                                            <td><div className="mgmt-product-cell">{item.product && <ProductThumb product={item.product} />}<span>{item.productName}</span></div></td>
                                            <td className="num">{item.onHand}</td>
                                            <td className="num">{item.reserved}</td>
                                            <td className="num">{item.available}</td>
                                            <td className="num">{item.threshold}</td>
                                            <td>{item.status === 'OUT_OF_STOCK' ? <span className="mgmt-badge mgmt-badge--danger">Hết hàng</span> : <span className="mgmt-badge mgmt-badge--warning">Tồn kho thấp</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ProductPagination page={alertsPage.page} totalPages={alertsPage.totalPages} getPageHref={page => getInventoryPageHref(searchParams, 'page', page)} ariaLabel="Phân trang cảnh báo tồn kho" />
                    </>
                )}
            </section>
        </div>
    )
}

export default LowStockAlertsPage
