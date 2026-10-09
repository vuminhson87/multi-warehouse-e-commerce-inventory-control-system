
import { warehouses, inventory } from '../data/inventory'
import { useState } from 'react'
import products from '../data/products'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './WarehouseInventoryPage.css'

function WarehouseInventoryPage() {
    const { currentUser } = useAuth()
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(1)
    const [inventoryData, setInventoryData] = useState(inventory)
    const [editingProductId, setEditingProductId] = useState(null)
    const [editedOnHand, setEditedOnHand] = useState('')

    const canEditInventory =
        currentUser?.role === 'ADMIN' ||
        (
            currentUser?.role === 'WAREHOUSE_MANAGER' &&
            currentUser?.warehouseId === selectedWarehouseId
        )

    const warehouseInventory = inventoryData.filter(
        (item) => item.warehouseId === selectedWarehouseId
    )

    const handleSaveInventory = (productId) => {
        // Kiểm tra quyền chỉnh sửa kho
        if (!canEditInventory) {
            alert('Bạn không có quyền chỉnh sửa tồn kho này.')
            return
        }

        const item = inventoryData.find(
            (item) =>
                item.productId === productId &&
                item.warehouseId === selectedWarehouseId
        )

        if (!item) {
            alert('Không tìm thấy dữ liệu tồn kho.')
            return
        }

        const newOnHand = Number(editedOnHand)

        // Kiểm tra số lượng hợp lệ
        if (
            editedOnHand.trim() === '' ||
            !Number.isSafeInteger(newOnHand) ||
            newOnHand < item.reserved
        ) {
            alert(
                `Số lượng tồn thực tế phải là số nguyên và không nhỏ hơn ${item.reserved}.`
            )
            return
        }

        // Cập nhật đúng sản phẩm tại đúng kho
        setInventoryData((prevInventory) =>
            prevInventory.map((inventoryItem) =>
                inventoryItem.productId === productId &&
                    inventoryItem.warehouseId === selectedWarehouseId
                    ? { ...inventoryItem, onHand: newOnHand }
                    : inventoryItem
            )
        )

        // Thoát chế độ chỉnh sửa
        setEditingProductId(null)
        setEditedOnHand('')
    }

    if (!currentUser) {
        return <Navigate to="/login" replace />
    }

    if (
        currentUser.role !== 'WAREHOUSE_MANAGER' &&
        currentUser.role !== 'ADMIN'
    ) {
        return (
            <div className="warehouse-page">
                <h1>Không có quyền truy cập</h1>
                <p>
                    Chức năng này chỉ dành cho nhân viên quản lý kho
                    và quản trị viên.
                </p>
            </div>
        )
    }

    return (
        <div className="warehouse-page">
            <h1>Warehouse Inventory</h1>
            <p>Xem và quản lý tồn kho sản phẩm theo từng kho.</p>

            <h2>Danh sách kho</h2>

            <div className="warehouse-filter">
                <select
                    value={selectedWarehouseId}
                    onChange={(event) => {
                        setSelectedWarehouseId(Number(event.target.value))
                        setEditingProductId(null)
                        setEditedOnHand('')
                    }}
                >
                    {warehouses.map((warehouse) => (
                        <option
                            key={warehouse.id}
                            value={warehouse.id}
                        >
                            {warehouse.name}
                        </option>
                    ))}
                </select>
            </div>

            <h2>Chi tiết tồn kho</h2>

            <div className="warehouse-table-wrapper">
                <table className="warehouse-table">
                    <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th>Tồn thực tế</th>
                            <th>Đang giữ</th>
                            <th>Có thể bán</th>
                            <th>Thao tác</th>
                        </tr>
                    </thead>

                    <tbody>
                        {warehouseInventory.map((item) => {
                            const product = products.find(
                                (p) => p.id === item.productId
                            )

                            return (
                                <tr key={item.productId}>
                                    <td>
                                        {product?.name || 'Không xác định'}
                                    </td>
                                    <td>
                                        {editingProductId === item.productId && canEditInventory ? (
                                            <input
                                                type="number"
                                                min={item.reserved}
                                                step="1"
                                                value={editedOnHand}
                                                onChange={(event) => setEditedOnHand(event.target.value)}
                                                style={{ width: '90px', padding: '8px' }}
                                            />
                                        ) : (
                                            item.onHand
                                        )}
                                    </td>
                                    <td>{item.reserved}</td>
                                    <td>{item.onHand - item.reserved}</td>
                                    <td>
                                        {canEditInventory ? (
                                            editingProductId === item.productId ? (
                                                <>
                                                    <button
                                                        type="button"
                                                        className="warehouse-btn-save"
                                                        onClick={() => handleSaveInventory(item.productId)}
                                                    >
                                                        Lưu
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="warehouse-btn-cancel"
                                                        onClick={() => {
                                                            setEditingProductId(null)
                                                            setEditedOnHand('')
                                                        }}
                                                    >
                                                        Hủy
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="warehouse-btn-edit"
                                                    onClick={() => {
                                                        setEditingProductId(item.productId)
                                                        setEditedOnHand(String(item.onHand))
                                                    }}
                                                >
                                                    Chỉnh sửa
                                                </button>
                                            )
                                        ) : (
                                            <span>Chỉ xem</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default WarehouseInventoryPage
