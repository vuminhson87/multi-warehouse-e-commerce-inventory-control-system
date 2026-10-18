import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { warehouses } from '../data/inventory'
import { useInventory } from '../context/InventoryContext'
import { useProducts } from '../context/ProductContext'
import './LowStockAlertsPage.css'

const STORAGE_KEY = 'productWarehouseLowStockThresholds'
const DEFAULT_LOW_STOCK_THRESHOLD = 10

function getStoredThresholds() {
    try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
        if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            return saved
        }
    } catch {
        // fallback
    }
    return {}
}

function getThreshold(thresholds, warehouseId, productId) {
    const key = `${warehouseId}_${productId}`
    const val = thresholds[key]
    return Number.isSafeInteger(val) && val >= 0
        ? val
        : DEFAULT_LOW_STOCK_THRESHOLD
}

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
        <div className="alerts-threshold-form">
            <label htmlFor="low-stock-product-select">Sản phẩm:</label>
            <select
                id="low-stock-product-select"
                value={selectedProductId}
                onChange={handleSelectProduct}
            >
                {products.map((p) => (
                    <option key={p.id} value={p.id}>
                        {p.name}
                    </option>
                ))}
            </select>

            <label htmlFor="low-stock-threshold">Ngưỡng:</label>
            <input
                id="low-stock-threshold"
                type="number"
                min="0"
                step="1"
                value={input}
                onChange={(event) => setInput(event.target.value)}
            />

            <button
                type="button"
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

    const initialProductId = Number(products[0]?.id || 1)
    const [selectedProductId, setSelectedProductId] = useState(initialProductId)

    const isWarehouseManager = currentUser?.role === 'WAREHOUSE_MANAGER'
    const isAdmin = currentUser?.role === 'ADMIN'
    const assignedWarehouseId = currentUser?.warehouseId

    const canEditThreshold = isWarehouseManager && Boolean(assignedWarehouseId)

    // Lưu bảng ngưỡng vào localStorage khi thay đổi
    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(thresholds))
        } catch (error) {
            console.error('Không thể lưu ngưỡng cảnh báo:', error)
        }
    }, [thresholds])

    // 2. KIỂM TRA ĐIỀU KIỆN ĐĂNG NHẬP & PHÂN QUYỀN SAU KHI ĐÃ GỌI XONG TẤT CẢ CÁC HOOKS
    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    if (!isWarehouseManager && !isAdmin) {
        return (
            <div className="alerts-page">
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
        const updatedThresholds = {
            ...thresholds,
            [key]: newThreshold,
        }

        setThresholds(updatedThresholds)
        alert('Lưu ngưỡng cảnh báo cho sản phẩm tại kho thành công!')
    }

    // Danh sách tồn kho theo quyền truy cập
    const visibleInventory = inventory.filter((item) => {
        if (!isAdmin) {
            return Number(item.warehouseId) === Number(assignedWarehouseId)
        }

        return (
            selectedWarehouseId === 'all' ||
            Number(item.warehouseId) === Number(selectedWarehouseId)
        )
    })

    // Tính toán danh sách cảnh báo tồn kho thấp theo từng sản phẩm tại từng kho
    const alerts = visibleInventory
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
                productName: product?.name || 'Không xác định',
                warehouseName: warehouse?.name || 'Không xác định',
                available,
                threshold,
                status:
                    available === 0
                        ? 'OUT_OF_STOCK'
                        : available > 0 && available <= threshold
                          ? 'LOW_STOCK'
                          : 'NORMAL',
            }
        })
        .filter((item) => item.status !== 'NORMAL')
        .sort((a, b) => a.available - b.available)

    const outOfStockCount = alerts.filter(
        (item) => item.status === 'OUT_OF_STOCK'
    ).length

    const lowStockCount = alerts.filter(
        (item) => item.status === 'LOW_STOCK'
    ).length

    const assignedWarehouse = warehouses.find(
        (w) => Number(w.id) === Number(assignedWarehouseId)
    )

    return (
        <div className="alerts-page">
            <h1>Low Stock Alerts</h1>
            <p>
                Theo dõi sản phẩm sắp hết hàng hoặc đã hết hàng tại các kho được
                phép quản lý.
            </p>

            <div className="alerts-summary">
                <div className="alerts-summary-card">
                    <h3>Tổng cảnh báo</h3>
                    <p>{alerts.length}</p>
                </div>

                <div className="alerts-summary-card">
                    <h3>Sắp hết hàng</h3>
                    <p className="alerts-number-warning">{lowStockCount}</p>
                </div>

                <div className="alerts-summary-card">
                    <h3>Đã hết hàng</h3>
                    <p className="alerts-number-danger">{outOfStockCount}</p>
                </div>
            </div>

            <div className="alerts-filter">
                {isAdmin ? (
                    <>
                        <label htmlFor="alerts-warehouse-filter">
                            Lọc theo kho:
                        </label>

                        <select
                            id="alerts-warehouse-filter"
                            value={selectedWarehouseId}
                            onChange={(event) =>
                                setSelectedWarehouseId(event.target.value)
                            }
                        >
                            <option value="all">Tất cả kho</option>

                            {warehouses.map((warehouse) => (
                                <option
                                    key={warehouse.id}
                                    value={warehouse.id}
                                >
                                    {warehouse.name}
                                </option>
                            ))}
                        </select>
                    </>
                ) : (
                    <p>
                        <strong>Kho được phân công:</strong>{' '}
                        {assignedWarehouse?.name || 'Chưa xác định'}
                    </p>
                )}
            </div>

            <p className="alerts-threshold">
                Ngưỡng cảnh báo được thiết lập riêng cho từng sản phẩm tại từng
                kho. Hết hàng khi tồn khả dụng bằng 0.
            </p>

            <div className="alerts-threshold-settings">
                <h2>Thiết lập ngưỡng cảnh báo theo sản phẩm</h2>

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
                    <p>
                        Chỉ Quản lý kho mới có quyền thiết lập ngưỡng cảnh báo
                        cho kho được phân công.
                    </p>
                )}
            </div>

            <h2>Danh sách cảnh báo tồn kho</h2>

            <div className="alerts-table-wrapper">
                <table className="alerts-table">
                    <thead>
                        <tr>
                            <th>Kho</th>
                            <th>Sản phẩm</th>
                            <th>Tồn thực tế</th>
                            <th>Đang giữ</th>
                            <th>Có thể bán</th>
                            <th>Ngưỡng</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>

                    <tbody>
                        {alerts.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="alerts-empty">
                                    Không có cảnh báo tồn kho thấp.
                                </td>
                            </tr>
                        ) : (
                            alerts.map((item) => (
                                <tr
                                    key={`${item.warehouseId}-${item.productId}`}
                                >
                                    <td>{item.warehouseName}</td>
                                    <td>{item.productName}</td>
                                    <td>{item.onHand}</td>
                                    <td>{item.reserved}</td>
                                    <td>{item.available}</td>
                                    <td>{item.threshold}</td>
                                    <td>
                                        {item.status === 'OUT_OF_STOCK' ? (
                                            <span className="alerts-badge alerts-badge-danger">
                                                Hết hàng
                                            </span>
                                        ) : (
                                            <span className="alerts-badge alerts-badge-warning">
                                                Tồn kho thấp
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default LowStockAlertsPage
