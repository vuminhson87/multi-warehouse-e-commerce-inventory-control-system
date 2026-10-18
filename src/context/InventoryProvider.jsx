import { useEffect, useMemo, useRef, useState } from 'react'
import { inventory as initialInventory, warehouses } from '../data/inventory'
import { InventoryContext } from './InventoryContext'
import { useProducts } from './ProductContext'

// Dữ liệu demo dùng chung trong trình duyệt; khi có backend sẽ thay bằng API.
const STORAGE_KEY = 'warehouse_inventory'

// Các loại thao tác tồn kho (bảng mục 8 trong tài liệu tổng quan).
const StockOperation = Object.freeze({
    RESERVE: 'RESERVE', // Giữ hàng: reserved + q
    RELEASE: 'RELEASE', // Giải phóng hàng giữ: reserved - q
    CONSUME: 'CONSUME', // Thanh toán thành công: onHand - q, reserved - q
    RESTORE: 'RESTORE', // Hủy đơn đã thanh toán: onHand + q
})

function isValidInventoryRow(row) {
    return (
        Boolean(row) &&
        Number.isSafeInteger(row.onHand) &&
        Number.isSafeInteger(row.reserved) &&
        row.reserved >= 0 &&
        row.onHand >= row.reserved
    )
}

function getSavedInventoryRows() {
    try {
        const savedInventory = JSON.parse(localStorage.getItem(STORAGE_KEY))

        if (!Array.isArray(savedInventory)) {
            return initialInventory
        }

        return savedInventory.filter(isValidInventoryRow)
    } catch {
        return initialInventory
    }
}

function buildCompleteInventory(savedRows, products) {
    const rows = []

    for (const product of products) {
        const productId = Number(product.id)

        for (const warehouse of warehouses) {
            const warehouseId = Number(warehouse.id)

            const savedItem = savedRows.find(
                (item) =>
                    Number(item.warehouseId) === warehouseId &&
                    Number(item.productId) === productId
            )

            if (isValidInventoryRow(savedItem)) {
                rows.push({
                    productId,
                    warehouseId,
                    onHand: savedItem.onHand,
                    reserved: savedItem.reserved,
                })
                continue
            }

            const seedItem = initialInventory.find(
                (item) =>
                    Number(item.warehouseId) === warehouseId &&
                    Number(item.productId) === productId
            )

            if (seedItem) {
                rows.push({
                    productId,
                    warehouseId,
                    onHand: seedItem.onHand,
                    reserved: seedItem.reserved,
                })
                continue
            }

            rows.push({
                productId,
                warehouseId,
                onHand: 0,
                reserved: 0,
            })
        }
    }

    return rows
}

function findRow(rows, warehouseId, productId) {
    return rows.find(
        (row) =>
            Number(row.warehouseId) === Number(warehouseId) &&
            Number(row.productId) === Number(productId)
    )
}

function getAvailable(row) {
    return row ? Math.max(0, row.onHand - row.reserved) : 0
}

// Gộp các dòng trùng sản phẩm và kiểm tra số lượng hợp lệ.
// Trả về null nếu dữ liệu đầu vào sai.
function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return null
    }

    const merged = new Map()

    for (const item of items) {
        const productId = Number(item?.productId ?? item?.id)
        const quantity = Number(item?.quantity)

        if (
            !Number.isSafeInteger(productId) ||
            productId < 1 ||
            !Number.isSafeInteger(quantity) ||
            quantity < 1
        ) {
            return null
        }

        merged.set(productId, (merged.get(productId) ?? 0) + quantity)
    }

    return [...merged.entries()].map(([productId, quantity]) => ({
        productId,
        quantity,
    }))
}

// Tìm kho đủ TOÀN BỘ mặt hàng (BR-01, SR-ORD-02).
// Ưu tiên kho preferredWarehouseId (nếu có), sau đó theo warehouseId tăng dần
// giống backend/src/modules/inventory/inventory.policy.js.
function findWarehouseInRows(rows, items, preferredWarehouseId = null) {
    const normalized = normalizeItems(items)

    if (!normalized) {
        return null
    }

    const sorted = [...warehouses].sort((a, b) => Number(a.id) - Number(b.id))

    if (preferredWarehouseId !== null && preferredWarehouseId !== undefined) {
        const index = sorted.findIndex(
            (w) => Number(w.id) === Number(preferredWarehouseId)
        )

        if (index > 0) {
            const [preferred] = sorted.splice(index, 1)
            sorted.unshift(preferred)
        }
    }

    return (
        sorted.find((warehouse) =>
            normalized.every(
                (item) =>
                    getAvailable(findRow(rows, warehouse.id, item.productId)) >=
                    item.quantity
            )
        ) ?? null
    )
}

export default function InventoryProvider({ children }) {
    const { products } = useProducts()
    const [savedRows, setSavedRows] = useState(getSavedInventoryRows)

    const inventory = useMemo(
        () => buildCompleteInventory(savedRows, products),
        [savedRows, products]
    )

    // Ref luôn giữ dữ liệu tồn kho MỚI NHẤT để các thao tác chạy liên tiếp
    // trong cùng một lần bấm (ví dụ: giữ hàng rồi trừ kho) không đọc dữ liệu cũ.
    const rowsRef = useRef(inventory)

    useEffect(() => {
        rowsRef.current = inventory
    }, [inventory])

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory))
        } catch (error) {
            console.error('Không thể lưu tồn kho vào trình duyệt:', error)
        }
    }, [inventory])

    // Lấy bảng tồn kho đầy đủ mới nhất. rowsRef luôn là bảng đã đủ mọi cặp sản phẩm–kho,
    // không dựng lại từ biến products để tránh dùng danh sách sản phẩm cũ khi gọi từ bộ hẹn giờ.
    function getLatestRows() {
        return rowsRef.current
    }

    function commitRows(nextRows) {
        rowsRef.current = nextRows
        setSavedRows(nextRows)
    }

    function updateOnHand(warehouseId, productId, newOnHand) {
        if (!Number.isSafeInteger(newOnHand) || newOnHand < 0) {
            return { ok: false, message: 'Số lượng tồn thực tế không hợp lệ.' }
        }

        const rows = getLatestRows()
        const row = findRow(rows, warehouseId, productId)

        if (!row) {
            return { ok: false, message: 'Không tìm thấy dữ liệu tồn kho.' }
        }

        // Không cho tồn thực tế nhỏ hơn số lượng đang giữ.
        if (newOnHand < row.reserved) {
            return {
                ok: false,
                message: `Tồn thực tế không được nhỏ hơn số lượng đang giữ (${row.reserved}).`,
            }
        }

        commitRows(
            rows.map((item) =>
                item === row ? { ...item, onHand: newOnHand } : item
            )
        )

        return { ok: true }
    }

    // Thực hiện một thao tác tồn kho trên TẤT CẢ mặt hàng tại một kho.
    // Nguyên tắc all-or-nothing: chỉ cần một dòng không hợp lệ thì không đổi gì cả.
    function applyStockOperation(warehouseId, items, operation) {
        const normalized = normalizeItems(items)

        if (!normalized) {
            return { ok: false, message: 'Danh sách sản phẩm không hợp lệ.' }
        }

        const rows = getLatestRows()

        for (const item of normalized) {
            const row = findRow(rows, warehouseId, item.productId)

            if (!row) {
                return {
                    ok: false,
                    message: `Không tìm thấy tồn kho của sản phẩm #${item.productId} tại kho #${warehouseId}.`,
                }
            }

            if (
                operation === StockOperation.RESERVE &&
                getAvailable(row) < item.quantity
            ) {
                return {
                    ok: false,
                    message: `Sản phẩm #${item.productId} không đủ tồn khả dụng tại kho #${warehouseId}.`,
                }
            }

            if (
                (operation === StockOperation.RELEASE ||
                    operation === StockOperation.CONSUME) &&
                (row.reserved < item.quantity || row.onHand < item.quantity)
            ) {
                return {
                    ok: false,
                    message: `Dữ liệu hàng giữ của sản phẩm #${item.productId} không khớp, không thể xử lý.`,
                }
            }
        }

        const nextRows = rows.map((row) => {
            if (Number(row.warehouseId) !== Number(warehouseId)) {
                return row
            }

            const item = normalized.find(
                (i) => i.productId === Number(row.productId)
            )

            if (!item) {
                return row
            }

            switch (operation) {
                case StockOperation.RESERVE:
                    return { ...row, reserved: row.reserved + item.quantity }
                case StockOperation.RELEASE:
                    return { ...row, reserved: row.reserved - item.quantity }
                case StockOperation.CONSUME:
                    return {
                        ...row,
                        onHand: row.onHand - item.quantity,
                        reserved: row.reserved - item.quantity,
                    }
                case StockOperation.RESTORE:
                    return { ...row, onHand: row.onHand + item.quantity }
                default:
                    return row
            }
        })

        commitRows(nextRows)
        return { ok: true }
    }

    // Theo quy tắc Single-Warehouse Fulfillment (SRS BR-01, SR-ORD-02):
    // số lượng tối đa của một sản phẩm trong một đơn bị giới hạn bởi
    // tồn khả dụng lớn nhất của MỘT kho riêng lẻ (không cộng dồn các kho).
    function getProductAvailableStock(productId) {
        const availablePerWarehouse = warehouses.map((warehouse) =>
            getAvailable(findRow(inventory, warehouse.id, productId))
        )

        return Math.max(0, ...availablePerWarehouse)
    }

    // Tổng tồn khả dụng toàn hệ thống (chỉ dùng cho thống kê).
    function getTotalAvailableStock(productId) {
        return inventory
            .filter((item) => Number(item.productId) === Number(productId))
            .reduce((total, item) => total + getAvailable(item), 0)
    }

    // Dùng khi hiển thị (giỏ hàng, checkout): tìm kho đủ toàn bộ đơn.
    function findFulfillmentWarehouse(items, preferredWarehouseId = null) {
        return findWarehouseInRows(inventory, items, preferredWarehouseId)
    }

    // Chọn kho và giữ hàng trong cùng một bước (dùng khi tạo đơn / thử lại thanh toán).
    function reserveFromFulfillmentWarehouse(items, preferredWarehouseId = null) {
        const warehouse = findWarehouseInRows(
            getLatestRows(),
            items,
            preferredWarehouseId
        )

        if (!warehouse) {
            return {
                ok: false,
                message:
                    'Không có kho nào đủ hàng cho toàn bộ đơn hàng (quy tắc một kho đáp ứng toàn bộ đơn).',
            }
        }

        const result = applyStockOperation(
            warehouse.id,
            items,
            StockOperation.RESERVE
        )

        return result.ok ? { ok: true, warehouse } : result
    }

    const reserveOrderStock = (warehouseId, items) =>
        applyStockOperation(warehouseId, items, StockOperation.RESERVE)

    const releaseOrderStock = (warehouseId, items) =>
        applyStockOperation(warehouseId, items, StockOperation.RELEASE)

    const consumeReservedStock = (warehouseId, items) =>
        applyStockOperation(warehouseId, items, StockOperation.CONSUME)

    const restoreOrderStock = (warehouseId, items) =>
        applyStockOperation(warehouseId, items, StockOperation.RESTORE)

    return (
        <InventoryContext.Provider
            value={{
                inventory,
                updateOnHand,
                getProductAvailableStock,
                getTotalAvailableStock,
                findFulfillmentWarehouse,
                reserveFromFulfillmentWarehouse,
                reserveOrderStock,
                releaseOrderStock,
                consumeReservedStock,
                restoreOrderStock,
            }}
        >
            {children}
        </InventoryContext.Provider>
    )
}
