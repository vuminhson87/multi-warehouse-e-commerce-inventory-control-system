
import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { inventory, warehouses } from '../data/inventory'
import products from '../data/products'
import './LowStockAlertsPage.css'

const DEFAULT_LOW_STOCK_THRESHOLD = 10

const DEFAULT_WAREHOUSE_THRESHOLDS = {
    1: DEFAULT_LOW_STOCK_THRESHOLD,
    2: DEFAULT_LOW_STOCK_THRESHOLD,
    3: DEFAULT_LOW_STOCK_THRESHOLD,
}

function LowStockAlertsPage() {
    const { currentUser } = useAuth()
    const [selectedWarehouseId, setSelectedWarehouseId] = useState('all')
    const [thresholdInput, setThresholdInput] = useState('')
    const [warehouseThresholds, setWarehouseThresholds] = useState(() => {
        try {
            const saved = JSON.parse(
                localStorage.getItem('warehouseLowStockThresholds') || 'null'
            )

            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                return DEFAULT_WAREHOUSE_THRESHOLDS
            }

            return Object.fromEntries(
                warehouses.map((warehouse) => {
                    const value = saved[warehouse.id]

                    return [
                        warehouse.id,
                        Number.isSafeInteger(value) && value >= 0
                            ? value
                            : DEFAULT_LOW_STOCK_THRESHOLD,
                    ]
                })
            )
        } catch {
            return DEFAULT_WAREHOUSE_THRESHOLDS
        }
    })

    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    if (
        currentUser.role !== 'WAREHOUSE_MANAGER' &&
        currentUser.role !== 'ADMIN'
    ) {
        return (
            <div className="alerts-page">
                <h1>Không có quyền truy cập</h1>
                <p>
                    Chức năng này chỉ dành cho nhân viên quản lý kho
                    và quản trị viên.
                </p>
            </div>
        )
    }

    const isAdmin = currentUser.role === 'ADMIN'
    const editableWarehouseId = isAdmin
        ? selectedWarehouseId
        : currentUser.warehouseId

    const canEditThreshold =
        editableWarehouseId !== 'all' &&
        warehouses.some(
            (warehouse) => warehouse.id === Number(editableWarehouseId)
        )

    useEffect(() => {
        if (canEditThreshold) {
            setThresholdInput(
                String(
                    warehouseThresholds[editableWarehouseId] ??
                    DEFAULT_LOW_STOCK_THRESHOLD
                )
            )
        } else {
            setThresholdInput('')
        }
    }, [editableWarehouseId, canEditThreshold])

    const handleSaveThreshold = () => {
        if (!canEditThreshold) {
            alert('Bạn không có quyền thiết lập ngưỡng cho kho này.')
            return
        }

        const newThreshold = Number(thresholdInput)

        if (
            thresholdInput.trim() === '' ||
            !Number.isSafeInteger(newThreshold) ||
            newThreshold < 0
        ) {
            alert('Ngưỡng cảnh báo phải là số nguyên không âm.')
            return
        }

        const updatedThresholds = {
            ...warehouseThresholds,
            [editableWarehouseId]: newThreshold,
        }

        setWarehouseThresholds(updatedThresholds)

        try {
            localStorage.setItem(
                'warehouseLowStockThresholds',
                JSON.stringify(updatedThresholds)
            )
            alert('Lưu ngưỡng cảnh báo thành công!')
        } catch {
            alert(
                'Đã cập nhật ngưỡng trong phiên hiện tại, nhưng không thể lưu vào trình duyệt.'
            )
        }
    }

    const visibleInventory = inventory.filter((item) => {
        if (!isAdmin) {
            return item.warehouseId === currentUser.warehouseId
        }

        return (
            selectedWarehouseId === 'all' ||
            item.warehouseId === Number(selectedWarehouseId)
        )
    })

    const alerts = visibleInventory
        .map((item) => {
            const product = products.find(
                (p) => p.id === item.productId
            )

            const warehouse = warehouses.find(
                (w) => w.id === item.warehouseId
            )

            const available = item.onHand - item.reserved
            const threshold = warehouseThresholds[item.warehouseId] ?? DEFAULT_LOW_STOCK_THRESHOLD
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
        (warehouse) => warehouse.id === currentUser.warehouseId
    )

    return (
        <div className="alerts-page">
            <h1>Low Stock Alerts</h1>
            <p>
                Theo dõi sản phẩm sắp hết hàng hoặc đã hết hàng
                tại các kho được phép quản lý.
            </p>

            <div className="alerts-summary">
                <div className="alerts-summary-card">
                    <h3>Tổng cảnh báo</h3>
                    <p>{alerts.length}</p>
                </div>

                <div className="alerts-summary-card">
                    <h3>Sắp hết hàng</h3>
                    <p className="alerts-number-warning">
                        {lowStockCount}
                    </p>
                </div>

                <div className="alerts-summary-card">
                    <h3>Đã hết hàng</h3>
                    <p className="alerts-number-danger">
                        {outOfStockCount}
                    </p>
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
                Ngưỡng cảnh báo được thiết lập riêng cho từng kho.
                Hết hàng khi tồn khả dụng bằng 0.
            </p>

            <div className="alerts-threshold-settings">
                <h2>Thiết lập ngưỡng cảnh báo</h2>

                {canEditThreshold ? (
                    <div className="alerts-threshold-form">
                        <label htmlFor="low-stock-threshold">
                            Ngưỡng cảnh báo của kho:
                        </label>

                        <input
                            id="low-stock-threshold"
                            type="number"
                            min="0"
                            step="1"
                            value={thresholdInput}
                            onChange={(event) =>
                                setThresholdInput(event.target.value)
                            }
                        />

                        <button
                            type="button"
                            onClick={handleSaveThreshold}
                        >
                            Lưu ngưỡng
                        </button>
                    </div>
                ) : (
                    <p>
                        Vui lòng chọn một kho cụ thể để thiết lập ngưỡng cảnh báo.
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
                            <th>Trạng thái</th>
                        </tr>
                    </thead>

                    <tbody>
                        {alerts.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="alerts-empty">
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
