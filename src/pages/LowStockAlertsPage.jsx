import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { warehouses } from '../data/inventory'
import { useInventory } from '../context/InventoryContext'
import { useProducts } from '../context/ProductContext'
import ProductThumb from '../components/ProductThumb'
import {
    THRESHOLD_STORAGE_KEY,
    getStockStatus,
    getStoredThresholds,
    getThreshold,
} from '../utils/stockThresholds'

function ThresholdForm({
    assignedWarehouseId,
    products,
    selectedProductId,
    onProductChange,
    onSave,
    thresholds,
}) {
    const currentThreshold = getThreshold(
        thresholds,
        assignedWarehouseId,
        selectedProductId
    )
    const [input, setInput] = useState(String(currentThreshold))

    const handleSelectProduct = (event) => {
        const nextId = Number(event.target.value)
        onProductChange(nextId)
        setInput(String(getThreshold(thresholds, assignedWarehouseId, nextId)))
    }

    return (
        <div className="mgmt-toolbar" style={{ alignItems: 'center' }}>
            <label className="mgmt-field" htmlFor="low-stock-product-select">
                Sản phẩm
                <select
                    id="low-stock-product-select"
                    className="mgmt-select"
                    value={selectedProductId}
                    onChange={handleSelectProduct}
                >
                    {products.map((p) => (
                        <option key={p.id} value={p.id}>
                            {p.name}
                        </option>
                    ))}
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
                    onChange={(event) => setInput(event.target.value)}
                />
            </label>

            <button
                type="button"
                className="mgmt-btn mgmt-btn--primary"
                onClick={() => onSave(selectedProductId, input)}
            >
                Lưu ngưỡng
            </button>
        </div>
    )
}

function LowStockAlertsPage() {
    // 1. TẤT CẢ CÁC HOOKS PHẢI ĐƯỢC GỌI Ở ĐẦU COMPONENT THEO RULES OF HOOKS
    const { currentUser } = useAuth()
    const { inventory } = useInventory()
    const { products } = useProducts()

    const [thresholds, setThresholds] = useState(getStoredThresholds)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all')
    const [statusFilter, setStatusFilter] = useState('ALL')
    const [keyword, setKeyword] = useState('')

    const initialProductId = Number(products[0]?.id || 1)
    const [selectedProductId, setSelectedProductId] = useState(initialProductId)

    const isWarehouseManager = currentUser?.role === 'WAREHOUSE_MANAGER'
    const isAdmin = currentUser?.role === 'ADMIN'
    const assignedWarehouseId = currentUser?.warehouseId

    const canEditThreshold = isWarehouseManager && Boolean(assignedWarehouseId)

    // Lưu bảng ngưỡng vào localStorage khi thay đổi
    useEffect(() => {
        try {
            localStorage.setItem(THRESHOLD_STORAGE_KEY, JSON.stringify(thresholds))
        } catch (error) {
            console.error('Không thể lưu ngưỡng cảnh báo:', error)
        }
    }, [thresholds])

    // Danh sách cảnh báo theo quyền truy cập
    const alerts = useMemo(() => {
        const visibleInventory = inventory.filter((item) => {
            if (!isAdmin) {
                return Number(item.warehouseId) === Number(assignedWarehouseId)
            }
            return (
                selectedWarehouseId === 'all' ||
                Number(item.warehouseId) === Number(selectedWarehouseId)
            )
        })

        return visibleInventory
            .map((item) => {
                const product = products.find(
                    (p) => Number(p.id) === Number(item.productId)
                )
                const warehouse = warehouses.find(
                    (w) => Number(w.id) === Number(item.warehouseId)
                )
                const available = item.onHand - item.reserved
                const threshold = getThreshold(
                    thresholds,
                    item.warehouseId,
                    item.productId
                )

                return {
                    ...item,
                    product,
                    productName: product?.name || 'Không xác định',
                    warehouseName: warehouse?.name || 'Không xác định',
                    available,
                    threshold,
                    status: getStockStatus(available, threshold),
                }
            })
            .filter((item) => item.status !== 'NORMAL')
            .sort((a, b) => a.available - b.available)
    }, [
        inventory,
        products,
        thresholds,
        isAdmin,
        assignedWarehouseId,
        selectedWarehouseId,
    ])

    // 2. KIỂM TRA ĐIỀU KIỆN ĐĂNG NHẬP & PHÂN QUYỀN SAU KHI ĐÃ GỌI XONG TẤT CẢ CÁC HOOKS
    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (!isWarehouseManager && !isAdmin) {
        return (
            <div className="mgmt-page">
                <h1>Không có quyền truy cập</h1>
                <p>
                    Chức năng này chỉ dành cho nhân viên quản lý kho và quản trị
                    viên.
                </p>
            </div>
        )
    }

    const handleSaveThreshold = (productId, rawInput) => {
        if (!canEditThreshold) {
            alert('Bạn không có quyền thiết lập ngưỡng cảnh báo.')
            return
        }

        const newThreshold = Number(rawInput)

        if (
            rawInput.trim() === '' ||
            !Number.isSafeInteger(newThreshold) ||
            newThreshold < 0
        ) {
            alert('Ngưỡng cảnh báo phải là số nguyên không âm (>= 0).')
            return
        }

        const key = `${assignedWarehouseId}_${productId}`
        setThresholds({
            ...thresholds,
            [key]: newThreshold,
        })
        alert('Lưu ngưỡng cảnh báo cho sản phẩm tại kho thành công!')
    }

    const outOfStockCount = alerts.filter(
        (item) => item.status === 'OUT_OF_STOCK'
    ).length
    const lowStockCount = alerts.filter(
        (item) => item.status === 'LOW_STOCK'
    ).length

    const visibleAlerts = alerts.filter(
        (item) =>
            (statusFilter === 'ALL' || item.status === statusFilter) &&
            item.productName.toLowerCase().includes(keyword.trim().toLowerCase())
    )

    const assignedWarehouse = warehouses.find(
        (w) => Number(w.id) === Number(assignedWarehouseId)
    )

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Cảnh báo tồn kho</h1>
                    <p>
                        Theo dõi sản phẩm sắp hết hoặc đã hết hàng tại các kho được
                        phép quản lý.
                    </p>
                </div>

                <div className="mgmt-head__actions">
                    {isAdmin ? (
                        <label className="mgmt-field" htmlFor="alerts-warehouse-filter">
                            Kho
                            <select
                                id="alerts-warehouse-filter"
                                className="mgmt-select"
                                value={selectedWarehouseId}
                                onChange={(event) =>
                                    setSelectedWarehouseId(event.target.value)
                                }
                            >
                                <option value="all">Tất cả kho</option>
                                {warehouses.map((warehouse) => (
                                    <option key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </option>
                                ))}
                            </select>
                        </label>
                    ) : (
                        <span className="mgmt-badge mgmt-badge--muted">
                            Kho được phân công:{' '}
                            {assignedWarehouse?.name || 'Chưa xác định'}
                        </span>
                    )}
                </div>
            </div>

            <div className="mgmt-kpis" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                <div className="mgmt-kpi">
                    <h3>Tổng cảnh báo</h3>
                    <p>{alerts.length}</p>
                </div>
                <div className="mgmt-kpi is-warning">
                    <h3>Sắp hết hàng</h3>
                    <p>{lowStockCount}</p>
                </div>
                <div className="mgmt-kpi is-danger">
                    <h3>Đã hết hàng</h3>
                    <p>{outOfStockCount}</p>
                </div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Thiết lập ngưỡng cảnh báo theo sản phẩm</h2>
                </div>
                <p className="mgmt-note">
                    Ngưỡng được thiết lập riêng cho từng sản phẩm tại từng kho. Hết
                    hàng khi tồn khả dụng bằng 0.
                </p>

                {canEditThreshold ? (
                    <ThresholdForm
                        key={`${assignedWarehouseId}_${selectedProductId}`}
                        assignedWarehouseId={assignedWarehouseId}
                        products={products}
                        selectedProductId={selectedProductId}
                        onProductChange={setSelectedProductId}
                        onSave={handleSaveThreshold}
                        thresholds={thresholds}
                    />
                ) : (
                    <p className="mgmt-note" style={{ marginBottom: 0 }}>
                        Chỉ Quản lý kho mới có quyền thiết lập ngưỡng cảnh báo cho kho
                        được phân công.
                    </p>
                )}
            </section>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Danh sách cảnh báo</h2>
                </div>

                <div className="mgmt-toolbar">
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm sản phẩm..."
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        aria-label="Tìm sản phẩm trong cảnh báo"
                    />
                    <select
                        className="mgmt-select"
                        value={statusFilter}
                        onChange={(event) => setStatusFilter(event.target.value)}
                        aria-label="Lọc theo trạng thái"
                    >
                        <option value="ALL">Mọi trạng thái</option>
                        <option value="LOW_STOCK">Sắp hết hàng</option>
                        <option value="OUT_OF_STOCK">Đã hết hàng</option>
                    </select>
                </div>

                {visibleAlerts.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Không có cảnh báo</strong>
                        {alerts.length === 0
                            ? 'Hiện không có sản phẩm dưới ngưỡng cảnh báo.'
                            : 'Không có cảnh báo nào khớp bộ lọc.'}
                    </div>
                ) : (
                    <div className="mgmt-table-wrap">
                        <table className="mgmt-table">
                            <thead>
                                <tr>
                                    <th>Kho</th>
                                    <th>Sản phẩm</th>
                                    <th className="num">Tồn thực tế</th>
                                    <th className="num">Đang giữ</th>
                                    <th className="num">Có thể bán</th>
                                    <th className="num">Ngưỡng</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>

                            <tbody>
                                {visibleAlerts.map((item) => (
                                    <tr key={`${item.warehouseId}-${item.productId}`}>
                                        <td>{item.warehouseName}</td>
                                        <td>
                                            <div className="mgmt-product-cell">
                                                {item.product && (
                                                    <ProductThumb product={item.product} />
                                                )}
                                                <span>{item.productName}</span>
                                            </div>
                                        </td>
                                        <td className="num">{item.onHand}</td>
                                        <td className="num">{item.reserved}</td>
                                        <td className="num">{item.available}</td>
                                        <td className="num">{item.threshold}</td>
                                        <td>
                                            {item.status === 'OUT_OF_STOCK' ? (
                                                <span className="mgmt-badge mgmt-badge--danger">
                                                    Hết hàng
                                                </span>
                                            ) : (
                                                <span className="mgmt-badge mgmt-badge--warning">
                                                    Tồn kho thấp
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    )
}

export default LowStockAlertsPage
