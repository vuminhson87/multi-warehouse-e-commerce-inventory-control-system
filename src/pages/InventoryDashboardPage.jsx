import { useMemo } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { warehouses as allWarehouses } from '../data/inventory'
import { useAuth } from '../context/AuthContext'
import { useInventory } from '../context/InventoryContext'
import { useProducts } from '../context/ProductContext'
import ProductThumb from '../components/ProductThumb'
import ProductPagination from '../components/ProductPagination'
import LucideIcon from '../components/LucideIcon'
import { formatNumber } from '../utils/format'
import {
    getStockStatus,
    getStoredThresholds,
    getThreshold,
} from '../utils/stockThresholds'
import {
    getInventoryPage,
    getInventoryPageHref,
    useNormalizeInventoryPages,
} from '../hooks/useInventoryPagination'

const WAREHOUSE_COLORS = ['#2f6fed', '#2fa866', '#f08a3c', '#9b8cf0', '#e0b341']

function StatusBadge({ status }) {
    if (status === 'OUT_OF_STOCK') {
        return <span className="mgmt-badge mgmt-badge--danger">Hết hàng</span>
    }
    return <span className="mgmt-badge mgmt-badge--warning">Sắp hết</span>
}

function InventoryDashboardPage() {
    const { currentUser } = useAuth()
    const { inventory } = useInventory()
    const { products } = useProducts()

    const [searchParams, setSearchParams] = useSearchParams()
    const isAdmin = currentUser?.role === 'ADMIN'
    const assignedWarehouseId = currentUser?.assignedWarehouseId
    const warehouses = useMemo(() => isAdmin ? allWarehouses : allWarehouses.filter(
        warehouse => warehouse.id === assignedWarehouseId
    ), [isAdmin, assignedWarehouseId])
    const warehouseParam = searchParams.get('warehouseId')
    const selectedWarehouse = warehouses.some((warehouse) => String(warehouse.id) === warehouseParam)
        ? warehouseParam
        : 'all'

    function handleWarehouseChange(event) {
        const params = new URLSearchParams(searchParams)
        const value = event.target.value

        if (value === 'all') {
            params.delete('warehouseId')
        } else {
            params.set('warehouseId', value)
        }

        params.delete('detailPage')
        setSearchParams(params)
    }

    const thresholds = useMemo(() => getStoredThresholds(), [])

    const scopedInventory = useMemo(
        () =>
            inventory.filter(
                (item) =>
                    warehouses.some(warehouse => warehouse.id === Number(item.warehouseId)) &&
                    (selectedWarehouse === 'all' || Number(item.warehouseId) === Number(selectedWarehouse))
            ),
        [inventory, selectedWarehouse, warehouses]
    )

    const totals = useMemo(() => {
        const onHand = scopedInventory.reduce((sum, i) => sum + i.onHand, 0)
        const reserved = scopedInventory.reduce((sum, i) => sum + i.reserved, 0)
        return { onHand, reserved, available: onHand - reserved }
    }, [scopedInventory])

    const productSummary = useMemo(
        () =>
            products.map((product) => {
                const rows = scopedInventory.filter(
                    (i) => Number(i.productId) === Number(product.id)
                )
                const onHand = rows.reduce((sum, i) => sum + i.onHand, 0)
                const reserved = rows.reduce((sum, i) => sum + i.reserved, 0)
                return { product, onHand, reserved, available: onHand - reserved }
            }),
        [products, scopedInventory]
    )

    // Phân bổ tồn theo các kho được phép xem.
    const distribution = useMemo(() => {
        const rows = warehouses.map((warehouse, index) => ({
            warehouse,
            color: WAREHOUSE_COLORS[index % WAREHOUSE_COLORS.length],
            onHand: inventory
                .filter((i) => Number(i.warehouseId) === Number(warehouse.id))
                .reduce((sum, i) => sum + i.onHand, 0),
        }))
        const total = rows.reduce((sum, r) => sum + r.onHand, 0)
        const { stops } = rows
            .filter((r) => r.onHand > 0)
            .reduce(
                (acc, r) => {
                    const start = acc.cursor
                    const nextCursor = start + (r.onHand / total) * 100
                    return {
                        cursor: nextCursor,
                        stops: [...acc.stops, `${r.color} ${start}% ${nextCursor}%`],
                    }
                },
                { cursor: 0, stops: [] }
            )
        return {
            total,
            rows: rows.map((r) => ({
                ...r,
                percent: total > 0 ? Math.round((r.onHand / total) * 100) : 0,
            })),
            gradient: stops.length ? `conic-gradient(${stops.join(', ')})` : null,
        }
    }, [inventory, warehouses])

    // Sản phẩm sắp hết / hết hàng theo ngưỡng thực tế của từng kho.
    const lowStock = useMemo(
        () =>
            scopedInventory
                .map((item) => {
                    const product = products.find(
                        (p) => Number(p.id) === Number(item.productId)
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
                        available,
                        threshold,
                        status: getStockStatus(available, threshold),
                    }
                })
                .filter((row) => row.product && row.status !== 'NORMAL')
                .sort((a, b) => a.available - b.available),
        [scopedInventory, products, thresholds]
    )

    const productPage = getInventoryPage(productSummary.length, searchParams.get('productPage'))
    const detailPage = getInventoryPage(scopedInventory.length, searchParams.get('detailPage'))
    const productPageRows = productSummary.slice(productPage.start, productPage.end)
    const detailPageRows = scopedInventory.slice(detailPage.start, detailPage.end)

    const canViewInventory = currentUser?.role === 'ADMIN'
        || currentUser?.role === 'WAREHOUSE_MANAGER'

    useNormalizeInventoryPages(
        searchParams,
        setSearchParams,
        { productPage: productPage.page, detailPage: detailPage.page },
        canViewInventory,
    )

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
                <p>Chức năng này chỉ dành cho nhân viên quản lý và quản trị viên.</p>
            </div>
        )
    }

    const scopeLabel =
        selectedWarehouse === 'all'
            ? 'tất cả kho'
            : warehouses.find((w) => Number(w.id) === Number(selectedWarehouse))
                  ?.name

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Tổng quan tồn kho</h1>
                    <p>Theo dõi tồn kho của {scopeLabel}.</p>
                </div>

                <div className="mgmt-head__actions">
                    <label className="mgmt-field" htmlFor="warehouse-filter">
                        Kho
                        <select
                            id="warehouse-filter"
                            className="mgmt-select"
                            value={selectedWarehouse}
                            onChange={handleWarehouseChange}
                        >
                            <option value="all">Các kho được phép xem</option>
                            {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                    {warehouse.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
            </div>

            <div className="mgmt-kpis">
                <div className="mgmt-kpi">
                    <h3>Sản phẩm theo dõi</h3>
                    <p>{formatNumber(products.length)}</p>
                </div>
                <div className="mgmt-kpi">
                    <h3>Tổng tồn thực tế</h3>
                    <p>{formatNumber(totals.onHand)}</p>
                </div>
                <div className="mgmt-kpi">
                    <h3>Đang giữ</h3>
                    <p>{formatNumber(totals.reserved)}</p>
                </div>
                <div className="mgmt-kpi">
                    <h3>Có thể bán</h3>
                    <p>{formatNumber(totals.available)}</p>
                </div>
            </div>

            <div className="mgmt-grid-2">
                <section className="mgmt-card">
                    <div className="mgmt-card__head">
                        <h2>Sản phẩm sắp hết hàng</h2>
                        <Link to="/inventory/alerts" className="mgmt-link">
                            Xem tất cả
                            <LucideIcon name="arrow-right" size={14} />
                        </Link>
                    </div>

                    {lowStock.length === 0 ? (
                        <div className="mgmt-empty">
                            <strong>Mọi thứ đều ổn</strong>
                            Hiện không có sản phẩm dưới ngưỡng cảnh báo.
                        </div>
                    ) : (
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Sản phẩm</th>
                                        {selectedWarehouse === 'all' && <th>Kho</th>}
                                        <th className="num">Có thể bán</th>
                                        <th className="num">Ngưỡng</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lowStock.slice(0, 6).map((row) => (
                                        <tr key={`${row.warehouseId}-${row.productId}`}>
                                            <td>
                                                <div className="mgmt-product-cell">
                                                    <ProductThumb product={row.product} />
                                                    <span>{row.product.name}</span>
                                                </div>
                                            </td>
                                            {selectedWarehouse === 'all' && (
                                                <td>
                                                    {warehouses.find(
                                                        (w) =>
                                                            Number(w.id) ===
                                                            Number(row.warehouseId)
                                                    )?.name ?? '—'}
                                                </td>
                                            )}
                                            <td className="num">{row.available}</td>
                                            <td className="num">{row.threshold}</td>
                                            <td>
                                                <StatusBadge status={row.status} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="mgmt-card">
                    <div className="mgmt-card__head">
                        <h2>Phân bổ tồn kho theo kho</h2>
                    </div>

                    {distribution.total <= 0 ? (
                        <div className="mgmt-empty">
                            <strong>Chưa có dữ liệu tồn</strong>
                            Các kho hiện chưa có hàng tồn.
                        </div>
                    ) : (
                        <div className="mgmt-dist">
                            <div
                                className="mgmt-donut"
                                style={{ background: distribution.gradient }}
                                role="img"
                                aria-label="Biểu đồ phân bổ tồn kho theo kho"
                            >
                                <div className="mgmt-donut__center">
                                    <strong>{formatNumber(distribution.total)}</strong>
                                    <small>đơn vị tồn</small>
                                </div>
                            </div>

                            <ul className="mgmt-legend">
                                {distribution.rows.map((row) => (
                                    <li key={row.warehouse.id}>
                                        <span
                                            className="mgmt-legend__dot"
                                            style={{ background: row.color }}
                                        />
                                        <span className="mgmt-legend__text">
                                            {row.warehouse.name}
                                            <small>
                                                {formatNumber(row.onHand)} sản phẩm
                                            </small>
                                        </span>
                                        <span className="mgmt-legend__pct">
                                            {row.percent}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Tồn kho theo sản phẩm</h2>
                </div>
                {productSummary.length === 0 ? (
                    <div className="mgmt-empty">Chưa có sản phẩm nào.</div>
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
                                    </tr>
                                </thead>
                                <tbody>
                                    {productPageRows.map(({ product, onHand, reserved, available }) => (
                                        <tr key={product.id}>
                                            <td>
                                                <div className="mgmt-product-cell">
                                                    <ProductThumb product={product} />
                                                    <span>{product.name}</span>
                                                </div>
                                            </td>
                                            <td className="num">{onHand}</td>
                                            <td className="num">{reserved}</td>
                                            <td className="num">{available}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <ProductPagination
                            page={productPage.page}
                            totalPages={productPage.totalPages}
                            getPageHref={(page) => getInventoryPageHref(searchParams, 'productPage', page)}
                            ariaLabel="Phân trang tồn kho theo sản phẩm"
                        />
                    </>
                )}
            </section>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Chi tiết tồn kho theo kho</h2>
                    <Link to="/inventory/warehouses" className="mgmt-link">
                        Quản lý tồn kho
                        <LucideIcon name="arrow-right" size={14} />
                    </Link>
                </div>
                {scopedInventory.length === 0 ? (
                    <div className="mgmt-empty">Không có dữ liệu tồn kho.</div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Kho</th>
                                        <th>Sản phẩm</th>
                                        <th className="num">Tồn thực tế</th>
                                        <th className="num">Đang giữ</th>
                                        <th className="num">Có thể bán</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {detailPageRows.map((item) => {
                                        const warehouse = warehouses.find(
                                            (w) => Number(w.id) === Number(item.warehouseId)
                                        )
                                        const product = products.find(
                                            (p) => Number(p.id) === Number(item.productId)
                                        )
                                        return (
                                            <tr key={`${item.productId}-${item.warehouseId}`}>
                                                <td>{warehouse?.name || 'Không xác định'}</td>
                                                <td>{product?.name || 'Không xác định'}</td>
                                                <td className="num">{item.onHand}</td>
                                                <td className="num">{item.reserved}</td>
                                                <td className="num">
                                                    {item.onHand - item.reserved}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ProductPagination
                            page={detailPage.page}
                            totalPages={detailPage.totalPages}
                            getPageHref={(page) => getInventoryPageHref(searchParams, 'detailPage', page)}
                            ariaLabel="Phân trang chi tiết tồn kho theo kho"
                        />
                    </>
                )}
            </section>
        </div>
    )
}

export default InventoryDashboardPage
