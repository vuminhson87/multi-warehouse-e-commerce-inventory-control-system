import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { warehouses as allWarehouses } from '../data/inventory'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { useProducts } from '../context/ProductContext'
import ProductThumb from '../components/ProductThumb'
import ProductPagination from '../components/ProductPagination'
import {
    getInventoryPage,
    getInventoryPageHref,
    useNormalizeInventoryPages,
} from '../hooks/useInventoryPagination'

function WarehouseInventoryPage() {
    const { currentUser } = useAuth()
    const { inventory, updateOnHand } = useInventory()
    const { products } = useProducts()

    const [searchParams, setSearchParams] = useSearchParams()
    const warehouses = currentUser?.role === 'ADMIN'
        ? allWarehouses
        : allWarehouses.filter(warehouse => warehouse.id === currentUser?.assignedWarehouseId)
    const warehouseParam = searchParams.get('warehouseId')
    const selectedWarehouse = warehouses.find((warehouse) => String(warehouse.id) === warehouseParam)
    const selectedWarehouseId = selectedWarehouse?.id ?? warehouses[0]?.id

    const [editingWarehouseId, setEditingWarehouseId] = useState(null)
    const [editingProductId, setEditingProductId] = useState(null)
    const [editedOnHand, setEditedOnHand] = useState('')

    const canEditInventory =
        currentUser?.role === 'WAREHOUSE_MANAGER' &&
        selectedWarehouseId !== undefined &&
        currentUser?.assignedWarehouseId === selectedWarehouseId

    const warehouseInventory = inventory.filter(
        (item) => item.warehouseId === selectedWarehouseId
    )

    const warehousePage = getInventoryPage(warehouseInventory.length, searchParams.get('page'))
    const warehousePageRows = warehouseInventory.slice(warehousePage.start, warehousePage.end)
    const canViewInventory = currentUser?.role === 'ADMIN'
        || currentUser?.role === 'WAREHOUSE_MANAGER'

    useNormalizeInventoryPages(
        searchParams,
        setSearchParams,
        { page: warehousePage.page },
        canViewInventory,
    )

    const handleSaveInventory = (productId) => {
        // Kiểm tra quyền chỉnh sửa kho
        if (!canEditInventory) {
            alert('Bạn không có quyền chỉnh sửa tồn kho này.')
            return
        }

        if (editingWarehouseId !== selectedWarehouseId || editingProductId !== productId) return

        const item = inventory.find(
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

        // Cập nhật nguồn tồn kho dùng chung cho cả ba trang.
        updateOnHand(selectedWarehouseId, productId, newOnHand)

        // Thoát chế độ chỉnh sửa
        setEditingWarehouseId(null)
        setEditingProductId(null)
        setEditedOnHand('')
    }

    if (!currentUser) {
        return <Navigate to="/" replace />
    }

    if (
        currentUser.role !== 'WAREHOUSE_MANAGER' &&
        currentUser.role !== 'ADMIN'
    ) {
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

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Tồn kho theo kho</h1>
                    <p>Xem và quản lý tồn kho sản phẩm theo từng kho.</p>
                </div>

                <div className="mgmt-head__actions">
                    <label className="mgmt-field" htmlFor="warehouse-select">
                        Kho
                        <select
                            id="warehouse-select"
                            className="mgmt-select"
                            value={selectedWarehouseId ?? ''}
                            onChange={(event) => {
                                const params = new URLSearchParams(searchParams)
                                params.set('warehouseId', event.target.value)
                                params.delete('page')
                                setSearchParams(params)
                                setEditingWarehouseId(null)
                                setEditingProductId(null)
                                setEditedOnHand('')
                            }}
                        >
                            {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            {!canEditInventory && (
                <p className="mgmt-note">
                    Bạn chỉ có quyền xem kho này. Chỉ quản lý kho được phân công
                    mới chỉnh sửa được tồn thực tế.
                </p>
            )}

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Chi tiết tồn kho</h2>
                </div>

                {warehouseInventory.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Chưa có dữ liệu</strong>
                        Kho này chưa có sản phẩm nào.
                    </div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Sản phẩm</th>
                                        <th className="num">Tồn thực tế</th>
                                        <th className="num">Đang giữ</th>
                                        <th className="num">Có thể bán</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {warehousePageRows.map((item) => {
                                        const product = products.find(
                                            (p) => p.id === item.productId
                                        )
                                        const isEditingRow =
                                            canEditInventory &&
                                            editingWarehouseId === selectedWarehouseId &&
                                            editingProductId === item.productId

                                        return (
                                            <tr key={item.productId}>
                                                <td>
                                                    <div className="mgmt-product-cell">
                                                        {product && (
                                                            <ProductThumb product={product} />
                                                        )}
                                                        <span>
                                                            {product?.name || 'Không xác định'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">
                                                    {isEditingRow ? (
                                                        <input
                                                            type="number"
                                                            className="mgmt-input"
                                                            style={{ width: 100 }}
                                                            min={item.reserved}
                                                            step="1"
                                                            value={editedOnHand}
                                                            onChange={(event) =>
                                                                setEditedOnHand(event.target.value)
                                                            }
                                                            aria-label={`Tồn thực tế của ${product?.name ?? 'sản phẩm'}`}
                                                        />
                                                    ) : (
                                                        item.onHand
                                                    )}
                                                </td>
                                                <td className="num">{item.reserved}</td>
                                                <td className="num">
                                                    {item.onHand - item.reserved}
                                                </td>
                                                <td>
                                                    {canEditInventory ? (
                                                        isEditingRow ? (
                                                            <div className="mgmt-head__actions">
                                                                <button
                                                                    type="button"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--primary"
                                                                    onClick={() =>
                                                                        handleSaveInventory(item.productId)
                                                                    }
                                                                >
                                                                    Lưu
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                                    onClick={() => {
                                                                        setEditingWarehouseId(null)
                                                                        setEditingProductId(null)
                                                                        setEditedOnHand('')
                                                                    }}
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                                onClick={() => {
                                                                    setEditingWarehouseId(selectedWarehouseId)
                                                                    setEditingProductId(item.productId)
                                                                    setEditedOnHand(String(item.onHand))
                                                                }}
                                                            >
                                                                Chỉnh sửa
                                                            </button>
                                                        )
                                                    ) : (
                                                        <span className="mgmt-badge mgmt-badge--muted">
                                                            Chỉ xem
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ProductPagination
                            page={warehousePage.page}
                            totalPages={warehousePage.totalPages}
                            getPageHref={(page) => getInventoryPageHref(searchParams, 'page', page)}
                            ariaLabel="Phân trang sản phẩm trong kho"
                        />
                    </>
                )}
            </section>
        </div>
    )
}

export default WarehouseInventoryPage
