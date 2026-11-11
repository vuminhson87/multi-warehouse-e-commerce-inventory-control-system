import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { loadWarehouseAlerts, loadWarehouseInventory, loadWarehouses } from '../services/inventoryApi.js'
import ProductThumb from '../components/ProductThumb'
import LucideIcon from '../components/LucideIcon'
import { formatNumber, formatPrice } from '../utils/format'
import { getStockStatus } from '../utils/stockThresholds'
import { buildWarehouseDistribution, summarizeDashboardInventory } from '../utils/adminDashboardData.js'

function AdminDashboardPage() {
    const { currentUser, token, authLoading } = useAuth()
    const { products, loading: productsLoading, error: productsError } = useProducts()
    const [reloadKey, setReloadKey] = useState(0)
    const [dashboardData, setDashboardData] = useState({ requestKey: null, warehouses: [], inventory: [], alerts: [], error: null })
    const requestKey = `${token ?? ''}:${reloadKey}`

    useEffect(() => {
        if (!token || currentUser?.role !== 'ADMIN') return undefined
        const controller = new AbortController()

        async function loadDashboard() {
            try {
                const [warehouses, alerts] = await Promise.all([
                    loadWarehouses(token, controller.signal),
                    loadWarehouseAlerts(token, undefined, controller.signal),
                ])
                const inventoryPages = await Promise.all(warehouses.map(warehouse =>
                    loadWarehouseInventory(token, warehouse.id, controller.signal)
                ))
                if (!controller.signal.aborted) {
                    setDashboardData({
                        requestKey,
                        warehouses,
                        inventory: inventoryPages.flat(),
                        alerts,
                        error: null,
                    })
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    setDashboardData({ requestKey, warehouses: [], inventory: [], alerts: [], error })
                }
            }
        }

        void loadDashboard()
        return () => controller.abort()
    }, [token, currentUser?.role, requestKey])

    const dashboardLoading = authLoading || productsLoading || dashboardData.requestKey !== requestKey
    const dashboardError = productsError || (dashboardData.requestKey === requestKey ? dashboardData.error : null)
    const warehouses = useMemo(
        () => dashboardData.requestKey === requestKey ? dashboardData.warehouses : [],
        [dashboardData, requestKey]
    )
    const inventory = useMemo(
        () => dashboardData.requestKey === requestKey ? dashboardData.inventory : [],
        [dashboardData, requestKey]
    )
    const rawAlerts = useMemo(
        () => dashboardData.requestKey === requestKey ? dashboardData.alerts : [],
        [dashboardData, requestKey]
    )

    const stats = useMemo(() => {
        const activeCount = products.filter(
            (p) => (p.status ?? 'ACTIVE') === 'ACTIVE'
        ).length
        const discontinuedCount = products.length - activeCount
        const inventorySummary = summarizeDashboardInventory(inventory)

        return {
            totalProducts: products.length,
            activeCount,
            discontinuedCount,
            ...inventorySummary,
        }
    }, [products, inventory])

    const alerts = useMemo(() => {
        const inventoryByKey = new Map(inventory.map(item => [`${item.warehouseId}:${item.productId}`, item]))
        return rawAlerts.map(alert => {
            const inventoryRow = inventoryByKey.get(`${alert.warehouseId}:${alert.productId}`)
            const product = products.find(item => Number(item.id) === Number(alert.productId))
            const warehouse = warehouses.find(item => Number(item.id) === Number(alert.warehouseId))
            const available = Number(alert.currentAvailable)
            const threshold = Number(alert.threshold)
            return {
                ...alert,
                product,
                warehouse,
                onHand: inventoryRow?.onHand ?? available,
                reserved: inventoryRow?.reserved ?? 0,
                available,
                threshold,
                status: getStockStatus(available, threshold),
            }
        }).filter(row => row.product && row.status !== 'NORMAL')
            .sort((a, b) => a.available - b.available)
    }, [inventory, products, rawAlerts, warehouses])

    const distribution = useMemo(() => {
        return buildWarehouseDistribution(warehouses, inventory)
    }, [inventory, warehouses])

    if (currentUser?.role !== 'ADMIN') {
        return <Navigate to="/" replace />
    }

    if (dashboardLoading) {
        return <div className="mgmt-page"><h1>Tổng quan hệ thống</h1><p role="status">Đang tải dữ liệu từ máy chủ…</p></div>
    }

    if (dashboardError) {
        return (
            <div className="mgmt-page">
                <h1>Tổng quan hệ thống</h1>
                <p role="alert">{dashboardError.message || 'Không thể tải dữ liệu dashboard.'}</p>
                <button className="mgmt-btn mgmt-btn--primary" type="button" onClick={() => setReloadKey(value => value + 1)}>Thử tải lại</button>
            </div>
        )
    }

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Tổng quan hệ thống</h1>
                    <p>
                        Số liệu tổng hợp trực tiếp từ danh mục sản phẩm và tồn kho
                        thực tế tại {warehouses.length} kho.
                    </p>
                </div>

                <div className="mgmt-head__actions">
                    <Link
                        to="/admin/products/add"
                        className="mgmt-btn mgmt-btn--primary"
                    >
                        <LucideIcon name="plus" size={16} />
                        Thêm sản phẩm
                    </Link>
                </div>
            </div>

            <div className="mgmt-kpis">
                <div className="mgmt-kpi">
                    <h3>Tổng sản phẩm</h3>
                    <p>{formatNumber(stats.totalProducts)}</p>
                    <small>
                        {stats.activeCount} đang bán · {stats.discontinuedCount}{' '}
                        ngừng bán
                    </small>
                </div>

                <div className="mgmt-kpi">
                    <h3>Đang kinh doanh</h3>
                    <p>{formatNumber(stats.activeCount)}</p>
                    <small>Hiển thị trên cửa hàng khách</small>
                </div>

                <div className="mgmt-kpi">
                    <h3>Có thể bán (tổng các kho)</h3>
                    <p>{formatNumber(stats.totalAvailable)}</p>
                    <small>
                        Tồn thực tế {formatNumber(stats.totalOnHand)} · Giữ{' '}
                        {formatNumber(stats.totalReserved)}
                    </small>
                </div>

                <div
                    className={`mgmt-kpi ${
                        alerts.length > 0 ? 'is-warning' : ''
                    }`}
                >
                    <h3>Cảnh báo tồn kho</h3>
                    <p>{formatNumber(alerts.length)}</p>
                    <small>Cặp sản phẩm – kho dưới ngưỡng</small>
                </div>
            </div>

            <div className="mgmt-grid-2">
                <section className="mgmt-card">
                    <div className="mgmt-card__head">
                        <h2>Sản phẩm cần chú ý tồn kho</h2>
                        <Link to="/inventory/alerts" className="mgmt-link">
                            Xem cảnh báo
                            <LucideIcon name="arrow-right" size={14} />
                        </Link>
                    </div>

                    {alerts.length === 0 ? (
                        <div className="mgmt-empty">
                            <strong>Không có cảnh báo</strong>
                            Tất cả sản phẩm tại các kho đều trên ngưỡng an toàn.
                        </div>
                    ) : (
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Sản phẩm</th>
                                        <th>Kho</th>
                                        <th className="num">Có thể bán</th>
                                        <th className="num">Ngưỡng</th>
                                        <th>Trạng thái</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {alerts.slice(0, 5).map((row) => (
                                        <tr
                                            key={`${row.warehouseId}-${row.productId}`}
                                        >
                                            <td>
                                                <div className="mgmt-product-cell">
                                                    <ProductThumb
                                                        product={row.product}
                                                    />
                                                    <span>{row.product.name}</span>
                                                </div>
                                            </td>
                                            <td>
                                                {row.warehouse?.name ?? '—'}
                                            </td>
                                            <td className="num">
                                                {row.available}
                                            </td>
                                            <td className="num">
                                                {row.threshold}
                                            </td>
                                            <td>
                                                {row.status ===
                                                'OUT_OF_STOCK' ? (
                                                    <span className="mgmt-badge mgmt-badge--danger">
                                                        Hết hàng
                                                    </span>
                                                ) : (
                                                    <span className="mgmt-badge mgmt-badge--warning">
                                                        Sắp hết
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

                <section className="mgmt-card">
                    <div className="mgmt-card__head">
                        <h2>Phân bổ tồn kho theo kho</h2>
                        <Link to="/inventory" className="mgmt-link">
                            Chi tiết kho
                            <LucideIcon name="arrow-right" size={14} />
                        </Link>
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
                                    <strong>
                                        {formatNumber(distribution.total)}
                                    </strong>
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
                    <h2>Danh sách sản phẩm gần đây</h2>
                    <Link to="/admin/products" className="mgmt-link">
                        Quản lý sản phẩm
                        <LucideIcon name="arrow-right" size={14} />
                    </Link>
                </div>

                {products.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Chưa có sản phẩm</strong>
                        Hãy thêm sản phẩm đầu tiên vào hệ thống.
                    </div>
                ) : (
                    <div className="mgmt-table-wrap">
                        <table className="mgmt-table">
                            <thead>
                                <tr>
                                    <th>Mã SP</th>
                                    <th>Sản phẩm</th>
                                    <th>Danh mục</th>
                                    <th className="num">Giá bán</th>
                                    <th className="num">Tối đa 1 đơn</th>
                                    <th className="num">Tổng khả dụng</th>
                                    <th>Trạng thái</th>
                                </tr>
                            </thead>
                            <tbody>
                                {products.slice(0, 6).map((product) => {
                                    const productInventory = inventory.filter(
                                        item => Number(item.productId) === Number(product.id)
                                    )
                                    const maxSingleOrder = Math.max(
                                        0,
                                        ...productInventory.map(item => Number(item.available))
                                    )
                                    const totalAvail = productInventory.reduce(
                                        (sum, item) => sum + Number(item.available),
                                        0
                                    )
                                    const isDiscontinued =
                                        product.status === 'DISCONTINUED'

                                    return (
                                        <tr key={product.id}>
                                            <td>#{product.id}</td>
                                            <td>
                                                <div className="mgmt-product-cell">
                                                    <ProductThumb
                                                        product={product}
                                                    />
                                                    <span>{product.name}</span>
                                                </div>
                                            </td>
                                            <td>{product.category}</td>
                                            <td className="num">
                                                {formatPrice(product.price)}
                                            </td>
                                            <td className="num">
                                                {formatNumber(maxSingleOrder)}
                                            </td>
                                            <td className="num">
                                                {formatNumber(totalAvail)}
                                            </td>
                                            <td>
                                                <span
                                                    className={`mgmt-badge ${
                                                        isDiscontinued
                                                            ? 'mgmt-badge--muted'
                                                            : 'mgmt-badge--success'
                                                    }`}
                                                >
                                                    {isDiscontinued
                                                        ? 'Ngừng kinh doanh'
                                                        : 'Đang kinh doanh'}
                                                </span>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Truy cập nhanh</h2>
                </div>
                <div className="mgmt-links">
                    <Link to="/admin/products">
                        <span>Quản lý sản phẩm</span>
                        <LucideIcon name="arrow-right" size={16} />
                    </Link>
                    <Link to="/admin/products/add">
                        <span>Thêm sản phẩm mới</span>
                        <LucideIcon name="plus" size={16} />
                    </Link>
                    <Link to="/inventory">
                        <span>Tổng quan tồn kho</span>
                        <LucideIcon name="arrow-right" size={16} />
                    </Link>
                    <Link to="/inventory/alerts">
                        <span>Cảnh báo tồn kho</span>
                        <LucideIcon name="arrow-right" size={16} />
                    </Link>
                </div>
            </section>
        </div>
    )
}

export default AdminDashboardPage
