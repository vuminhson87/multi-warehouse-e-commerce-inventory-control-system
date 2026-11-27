import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { formatDateTime } from '../constants/order'
import { useAuth } from '../context/AuthContext'
import { loadInventoryMovements, loadWarehouses } from '../services/inventoryApi'
import ProductPagination from '../components/ProductPagination'
import { getInventoryPageHref } from '../hooks/useInventoryPagination'

const PAGE_SIZE = 20

const MOVEMENT_LABELS = {
    RESERVE: { label: 'Giữ hàng', badge: 'mgmt-badge--warning' },
    RELEASE: { label: 'Giải phóng giữ', badge: 'mgmt-badge--muted' },
    CONSUME: { label: 'Xuất bán', badge: 'mgmt-badge--success' },
    RESTORE: { label: 'Hoàn kho hủy đơn', badge: 'mgmt-badge--warning' },
    RESTOCK: { label: 'Nhập thêm hàng', badge: 'mgmt-badge--success' },
    ADJUST: { label: 'Kiểm kê / Điều chỉnh', badge: 'mgmt-badge--muted' },
}

function readPage(value) {
    if (!/^[1-9]\d*$/.test(value ?? '')) return 1
    const parsed = Number(value)
    return Number.isSafeInteger(parsed) ? parsed : 1
}

function InventoryMovementsPage() {
    const { currentUser, token, refreshCurrentUser } = useAuth()
    const [searchParams, setSearchParams] = useSearchParams()
    const [warehouses, setWarehouses] = useState([])
    const [result, setResult] = useState(null)
    const [keyword, setKeyword] = useState(() => searchParams.get('search') ?? '')
    const [revision, setRevision] = useState(0)

    const isAdmin = currentUser?.role === 'ADMIN'
    const isWarehouseManager = currentUser?.role === 'WAREHOUSE_MANAGER'
    const canView = isAdmin || isWarehouseManager

    const warehouseParam = searchParams.get('warehouseId') || 'all'
    const typeFilter = searchParams.get('type') || 'ALL'
    const searchQuery = searchParams.get('search') || ''
    const page = readPage(searchParams.get('page'))

    const effectiveWarehouseId = isAdmin
        ? (warehouses.some((w) => String(w.id) === warehouseParam) ? warehouseParam : 'all')
        : undefined

    const requestKey = `${token ?? ''}:${currentUser?.role ?? ''}:${currentUser?.assignedWarehouseId ?? ''}:${effectiveWarehouseId ?? 'scoped'}:${typeFilter}:${searchQuery}:${page}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const items = currentResult?.data?.items ?? []
    const total = currentResult?.data?.total ?? 0
    const totalPages = currentResult?.data?.totalPages ?? 0

    useEffect(() => {
        if (!token || !canView) return undefined
        const controller = new AbortController()
        loadWarehouses(token, controller.signal)
            .then((list) => {
                if (controller.signal.aborted) return
                setWarehouses(list)
                if (
                    isWarehouseManager &&
                    list.length === 1 &&
                    list[0].id !== currentUser?.assignedWarehouseId
                ) {
                    void refreshCurrentUser?.()
                }
            })
            .catch(() => {
                if (!controller.signal.aborted) setWarehouses([])
            })
        return () => controller.abort()
    }, [token, canView, isWarehouseManager, currentUser?.assignedWarehouseId, refreshCurrentUser])

    useEffect(() => {
        if (!token || !canView) return undefined
        const controller = new AbortController()
        loadInventoryMovements(
            token,
            {
                warehouseId: effectiveWarehouseId,
                type: typeFilter,
                search: searchQuery,
                page,
                limit: PAGE_SIZE,
            },
            controller.signal
        )
            .then((data) => {
                if (!controller.signal.aborted) {
                    setResult({ requestKey, data })
                }
            })
            .catch((error) => {
                if (!controller.signal.aborted) {
                    setResult({ requestKey, error })
                }
            })
        return () => controller.abort()
    }, [token, canView, effectiveWarehouseId, typeFilter, searchQuery, page, requestKey])

    function updateFilter(nextParams) {
        const params = new URLSearchParams(searchParams)
        for (const [key, value] of Object.entries(nextParams)) {
            if (value === undefined || value === null || value === '' || value === 'all' || value === 'ALL') {
                params.delete(key)
            } else {
                params.set(key, String(value))
            }
        }
        params.delete('page')
        setSearchParams(params)
    }

    function handleSearchSubmit(event) {
        event.preventDefault()
        updateFilter({ search: keyword.trim() })
    }

    if (!currentUser) return <Navigate to="/" replace />
    if (!canView) {
        return (
            <div className="mgmt-page">
                <h1>Không có quyền truy cập</h1>
                <p>Chức năng này chỉ dành cho nhân viên quản lý kho và quản trị viên.</p>
            </div>
        )
    }

    const assignedWarehouse = warehouses.find(
        (w) => Number(w.id) === Number(currentUser?.assignedWarehouseId)
    )

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Lịch sử biến động tồn kho</h1>
                    <p>
                        Theo dõi chi tiết mọi lần nhập hàng, giữ hàng, xuất bán, hoàn kho và điều chỉnh kiểm kê.
                    </p>
                </div>
                <div className="mgmt-head__actions">
                    {isAdmin ? (
                        <label className="mgmt-field" htmlFor="movements-warehouse-filter">
                            Kho
                            <select
                                id="movements-warehouse-filter"
                                className="mgmt-select"
                                value={effectiveWarehouseId}
                                onChange={(event) => updateFilter({ warehouseId: event.target.value })}
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
                            Kho được phân công: {assignedWarehouse?.name || `Kho #${currentUser?.assignedWarehouseId ?? '?'}`}
                        </span>
                    )}
                    <button
                        type="button"
                        className="mgmt-btn mgmt-btn--ghost"
                        onClick={() => setRevision((value) => value + 1)}
                    >
                        Tải lại
                    </button>
                </div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Nhật ký thẻ kho</h2>
                    {currentResult?.data && <span>{total} bản ghi</span>}
                </div>

                <form className="mgmt-toolbar" onSubmit={handleSearchSubmit}>
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm theo tên hoặc SKU sản phẩm..."
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        aria-label="Tìm sản phẩm trong lịch sử biến động"
                    />
                    <select
                        className="mgmt-select"
                        aria-label="Lọc loại biến động"
                        value={typeFilter}
                        onChange={(event) => updateFilter({ type: event.target.value })}
                    >
                        <option value="ALL">Mọi loại biến động</option>
                        {Object.entries(MOVEMENT_LABELS).map(([key, info]) => (
                            <option key={key} value={key}>
                                {info.label}
                            </option>
                        ))}
                    </select>
                    <button type="submit" className="mgmt-btn mgmt-btn--primary">
                        Lọc
                    </button>
                    {searchQuery && (
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost"
                            onClick={() => {
                                setKeyword('')
                                updateFilter({ search: '' })
                            }}
                        >
                            Xóa lọc
                        </button>
                    )}
                </form>

                {currentResult?.error ? (
                    <div className="mgmt-empty" role="alert">
                        <strong>Không tải được lịch sử biến động tồn kho</strong>
                        {currentResult.error.message}
                        <div style={{ marginTop: 12 }}>
                            <button
                                type="button"
                                className="mgmt-btn mgmt-btn--ghost"
                                onClick={() => setRevision((value) => value + 1)}
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                ) : !currentResult ? (
                    <div className="mgmt-empty" role="status">
                        Đang tải lịch sử biến động tồn kho…
                    </div>
                ) : items.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Chưa có dữ liệu biến động</strong>
                        Không có bản ghi nào khớp với bộ lọc hiện tại.
                    </div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Thời gian</th>
                                        {isAdmin && <th>Kho</th>}
                                        <th>Sản phẩm</th>
                                        <th>Loại</th>
                                        <th className="num">SL biến động</th>
                                        <th className="num">Tồn sau</th>
                                        <th className="num">Giữ sau</th>
                                        <th className="num">Khả dụng sau</th>
                                        <th>Đơn hàng</th>
                                        <th>Người thực hiện &amp; Ghi chú</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((row) => {
                                        const meta = MOVEMENT_LABELS[row.type] ?? {
                                            label: row.type,
                                            badge: 'mgmt-badge--muted',
                                        }
                                        return (
                                            <tr key={row.id}>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {formatDateTime(row.createdAt)}
                                                </td>
                                                {isAdmin && <td>{row.warehouseName}</td>}
                                                <td>
                                                    <div>
                                                        <strong>{row.productName}</strong>
                                                        <div>
                                                            <small style={{ color: 'var(--ui-muted)' }}>
                                                                {row.sku}
                                                            </small>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`mgmt-badge ${meta.badge}`}>
                                                        {meta.label}
                                                    </span>
                                                </td>
                                                <td className="num">
                                                    <strong>{row.quantity}</strong>
                                                </td>
                                                <td className="num">{row.onHandAfter}</td>
                                                <td className="num">{row.reservedAfter}</td>
                                                <td className="num">{row.availableAfter}</td>
                                                <td>{row.orderId ? `#${row.orderId}` : '—'}</td>
                                                <td>
                                                    <div>
                                                        {row.actorUsername && (
                                                            <div>
                                                                <strong>{row.actorUsername}</strong>
                                                            </div>
                                                        )}
                                                        {row.note ? (
                                                            <small style={{ color: '#525252' }}>
                                                                {row.note}
                                                            </small>
                                                        ) : (
                                                            !row.actorUsername && '—'
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <ProductPagination
                            page={page}
                            totalPages={totalPages}
                            getPageHref={(nextPage) =>
                                getInventoryPageHref(searchParams, 'page', nextPage)
                            }
                            ariaLabel="Phân trang lịch sử biến động tồn kho"
                        />
                    </>
                )}
            </section>
        </div>
    )
}

export default InventoryMovementsPage
