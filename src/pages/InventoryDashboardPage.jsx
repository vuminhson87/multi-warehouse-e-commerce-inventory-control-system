
import { inventory, warehouses } from '../data/inventory'
import products from '../data/products'
import { useState } from 'react'
import './InventoryDashboardPage.css'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function InventoryDashboardPage() {
    const { currentUser } = useAuth()
    const [selectedWarehouse, setSelectedWarehouse] = useState('all')

    const filteredInventory = inventory.filter(
        (item) =>
            selectedWarehouse === 'all' ||
            item.warehouseId === Number(selectedWarehouse)
    )

    const totalOnHand = inventory.reduce(
        (total, item) => total + item.onHand,
        0
    )

    const totalReserved = inventory.reduce(
        (total, item) => total + item.reserved,
        0
    )

    const totalAvailable = totalOnHand - totalReserved


    const productSummary = products.map((product) => {
        const productInventory = inventory.filter(
            (item) => item.productId === product.id
        )

        const onHand = productInventory.reduce(
            (total, item) => total + item.onHand,
            0
        )

        const reserved = productInventory.reduce(
            (total, item) => total + item.reserved,
            0
        )

        return {
            id: product.id,
            name: product.name,
            onHand,
            reserved,
            available: onHand - reserved,
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
            <div className="inventory-page">
                <h1>Không có quyền truy cập</h1>
                <p>Chức năng này chỉ dành cho nhân viên quản lý và quản trị viên.</p>
            </div>
        )
    }
    return (
        <div className="inventory-page">
            <h1>Inventory Dashboard</h1>
            <p>Theo dõi tồn kho của tất cả kho trong hệ thống.</p>

            <h2>Tổng quan tồn kho toàn hệ thống</h2>

            <div className="inventory-summary">
                <div>
                    <h3>Tổng tồn thực tế</h3>
                    <p>{totalOnHand}</p>
                </div>

                <div>
                    <h3>Tổng đang giữ</h3>
                    <p>{totalReserved}</p>
                </div>

                <div>
                    <h3>Tổng có thể bán</h3>
                    <p>{totalAvailable}</p>
                </div>
            </div>

            <div className="inventory-filter">
                <label htmlFor="warehouse-filter">Lọc theo kho: </label>

                <select
                    id="warehouse-filter"
                    value={selectedWarehouse}
                    onChange={(event) => setSelectedWarehouse(event.target.value)}
                >
                    <option value="all">Tất cả kho</option>

                    {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                        </option>
                    ))}
                </select>
            </div>


            <h2>Tổng hợp tồn kho theo sản phẩm</h2>
            <div className="inventory-table-wrapper">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Sản phẩm</th>
                            <th>Tổng tồn thực tế</th>
                            <th>Tổng đang giữ</th>
                            <th>Tổng có thể bán</th>
                        </tr>
                    </thead>

                    <tbody>
                        {productSummary.map((product) => (
                            <tr key={product.id}>
                                <td>{product.name}</td>
                                <td>{product.onHand}</td>
                                <td>{product.reserved}</td>
                                <td>{product.available}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <h2>Chi tiết tồn kho theo kho</h2>
            <div className="inventory-table-wrapper">
                <table className="inventory-table">
                    <thead>
                        <tr>
                            <th>Kho</th>
                            <th>Sản phẩm</th>
                            <th>Tồn thực tế (onHand)</th>
                            <th>Đang giữ (reserved)</th>
                            <th>Có thể bán (available)</th>
                        </tr>
                    </thead>

                    <tbody>
                        {filteredInventory.map((item) => {
                            const warehouse = warehouses.find(
                                (w) => w.id === item.warehouseId
                            )
                            const product = products.find(
                                (p) => p.id === item.productId
                            )

                            const available = item.onHand - item.reserved

                            return (
                                <tr key={`${item.productId}-${item.warehouseId}`}>
                                    <td>{warehouse?.name || 'Không xác định'}</td>
                                    <td>{product?.name || 'Không xác định'}</td>
                                    <td>{item.onHand}</td>
                                    <td>{item.reserved}</td>
                                    <td>{available}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default InventoryDashboardPage