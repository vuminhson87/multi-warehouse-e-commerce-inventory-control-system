import { useEffect, useRef, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
    adjustWarehouseStock,
    loadWarehouses,
    loadWarehouseInventory,
    restockWarehouseProduct,
} from '../services/inventoryApi.js'
import { useProducts } from '../context/ProductContext'
import LucideIcon from '../components/LucideIcon'
import ProductThumb from '../components/ProductThumb'
import ProductPagination from '../components/ProductPagination'
import {
    getInventoryPage,
    getInventoryPageHref,
    useNormalizeInventoryPages,
} from '../hooks/useInventoryPagination'

function WarehouseInventoryPage() {
    const { currentUser, token, refreshCurrentUser } = useAuth()
    const { products } = useProducts()
    const [searchParams, setSearchParams] = useSearchParams()
    const [warehouseResult, setWarehouseResult] = useState(null)
    const [inventoryResult, setInventoryResult] = useState(null)
    const [editingProductId, setEditingProductId] = useState(null)
    const [quantity, setQuantity] = useState('')
    const [adjustItem, setAdjustItem] = useState(null)
    const [adjustOnHand, setAdjustOnHand] = useState('')
    const [adjustNote, setAdjustNote] = useState('')
    const [adjustError, setAdjustError] = useState('')
    const [feedback, setFeedback] = useState(null)
    const [pending, setPending] = useState(false)
    const [revision, setRevision] = useState(0)
    const submitting = useRef(false)
    const pendingRef = useRef(pending)
    const canViewInventory = ['ADMIN', 'WAREHOUSE_MANAGER'].includes(currentUser?.role)
    const warehouseData = warehouseResult?.token === token ? warehouseResult : null
    const warehouses = warehouseData?.items ?? []
    const selectedWarehouse = warehouses.find(
        warehouse => String(warehouse.id) === searchParams.get('warehouseId')
    ) ?? warehouses.find(
        warehouse => Number(warehouse.id) === Number(currentUser?.assignedWarehouseId)
    ) ?? warehouses[0]
    const selectedWarehouseId = selectedWarehouse?.id
    const inventoryData = inventoryResult?.token === token &&
        inventoryResult?.warehouseId === selectedWarehouseId &&
        inventoryResult?.revision === revision
        ? inventoryResult
        : null
    const inventory = inventoryData?.items ?? []
    const warehousePage = getInventoryPage(inventory.length, searchParams.get('page'))
    const warehousePageRows = inventory.slice(warehousePage.start, warehousePage.end)
    const canRestock = currentUser?.role === 'WAREHOUSE_MANAGER' &&
        selectedWarehouseId !== undefined &&
        selectedWarehouseId === currentUser.assignedWarehouseId

    useEffect(() => {
        if (!token || !canViewInventory) return
        const controller = new AbortController()
        loadWarehouses(token, controller.signal)
            .then(items => {
                if (controller.signal.aborted) return
                setWarehouseResult({ token, items })
                if (
                    currentUser?.role === 'WAREHOUSE_MANAGER' &&
                    items.length > 0 &&
                    !items.some(warehouse => Number(warehouse.id) === Number(currentUser.assignedWarehouseId))
                ) {
                    void refreshCurrentUser?.()
                }
            })
            .catch(error => {
                if (!controller.signal.aborted) setWarehouseResult({ token, error })
            })
        return () => controller.abort()
    }, [token, canViewInventory, currentUser?.role, currentUser?.assignedWarehouseId, refreshCurrentUser])

    useEffect(() => {
        if (!token || !canViewInventory || selectedWarehouseId === undefined) return
        const controller = new AbortController()
        const key = { token, warehouseId: selectedWarehouseId, revision }
        loadWarehouseInventory(token, selectedWarehouseId, controller.signal)
            .then(items => {
                if (!controller.signal.aborted) setInventoryResult({ ...key, items })
            })
            .catch(error => {
                if (!controller.signal.aborted) setInventoryResult({ ...key, error })
            })
        return () => controller.abort()
    }, [token, canViewInventory, selectedWarehouseId, revision])

    useNormalizeInventoryPages(
        searchParams,
        setSearchParams,
        { page: warehousePage.page },
        Boolean(inventoryData?.items),
    )

    function resetForm() {
        setEditingProductId(null)
        setQuantity('')
    }

    useEffect(() => {
        pendingRef.current = pending
    }, [pending])

    useEffect(() => {
        if (!adjustItem) return undefined
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !pendingRef.current) {
                setAdjustItem(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousOverflow
        }
    }, [adjustItem])

    function openAdjustModal(item) {
        resetForm()
        setFeedback(null)
        setAdjustItem(item)
        setAdjustOnHand(String(item.onHand))
        setAdjustNote('')
        setAdjustError('')
    }

    async function handleAdjustSubmit(event) {
        event.preventDefault()
        if (!canRestock || !adjustItem || submitting.current) return

        const nextOnHand = Number(adjustOnHand)
        const trimmedNote = adjustNote.trim()

        if (
            adjustOnHand.trim() === '' ||
            !Number.isSafeInteger(nextOnHand) ||
            nextOnHand < 0 ||
            nextOnHand > 1000000
        ) {
            setAdjustError('Tồn thực tế mới phải là số nguyên từ 0 đến 1.000.000.')
            return
        }

        if (nextOnHand < adjustItem.reserved) {
            setAdjustError(
                `Tồn thực tế mới (${nextOnHand}) không được nhỏ hơn số lượng đang giữ (${adjustItem.reserved}).`
            )
            return
        }

        if (nextOnHand === adjustItem.onHand) {
            setAdjustError('Tồn thực tế mới giống với số lượng hiện tại.')
            return
        }

        if (!trimmedNote || trimmedNote.length > 200) {
            setAdjustError('Vui lòng nhập lý do điều chỉnh (tối đa 200 ký tự).')
            return
        }

        submitting.current = true
        setPending(true)
        setAdjustError('')
        setFeedback(null)

        try {
            await adjustWarehouseStock(
                token,
                selectedWarehouseId,
                adjustItem.productId,
                nextOnHand,
                trimmedNote
            )
            const prevOnHand = adjustItem.onHand
            const productName = adjustItem.productName
            setAdjustItem(null)
            setFeedback({
                text: `Đã điều chỉnh kiểm kê "${productName}": ${prevOnHand} → ${nextOnHand} (${trimmedNote}).`,
            })
            setRevision((value) => value + 1)
        } catch (error) {
            if (error.status === 403) {
                setAdjustItem(null)
                void refreshCurrentUser?.()
                setRevision((value) => value + 1)
                setFeedback({
                    error: true,
                    text: `${error.message} Đã đồng bộ lại kho được phân công.`,
                })
            } else {
                setAdjustError(error.message || 'Không thể điều chỉnh tồn kho.')
            }
        } finally {
            submitting.current = false
            setPending(false)
        }
    }

    async function handleRestock(event, productId) {
        event.preventDefault()
        if (!canRestock || submitting.current || editingProductId !== productId) return

        const amount = Number(quantity)
        if (!Number.isSafeInteger(amount) || amount < 1 || amount > 2147483647) {
            setFeedback({ error: true, text: 'Số lượng nhập phải là số nguyên dương hợp lệ.' })
            return
        }

        submitting.current = true
        setPending(true)
        setFeedback(null)
        try {
            await restockWarehouseProduct(token, selectedWarehouseId, productId, amount)
            resetForm()
            setFeedback({ text: `Đã nhập thêm ${amount} sản phẩm.` })
            setRevision(value => value + 1)
        } catch (error) {
            if (error.status === 403) {
                resetForm()
                void refreshCurrentUser?.()
                setRevision(value => value + 1)
                setFeedback({
                    error: true,
                    text: `${error.message} Đã đồng bộ lại kho được phân công.`,
                })
            } else if (!error.status || error.status >= 500) {
                resetForm()
                setRevision(value => value + 1)
                setFeedback({ error: true, text: 'Chưa xác định được kết quả nhập hàng. Kiểm tra tồn kho vừa tải lại trước khi gửi lại.' })
            } else {
                setFeedback({ error: true, text: error.message })
            }
        } finally {
            submitting.current = false
            setPending(false)
        }
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
                    <Link
                        to="/inventory/movements"
                        className="mgmt-btn mgmt-btn--ghost"
                    >
                        <LucideIcon name="file-text" size={16} />
                        Lịch sử biến động
                    </Link>
                    <label className="mgmt-field" htmlFor="warehouse-select">
                        Kho
                        <select
                            id="warehouse-select"
                            className="mgmt-select"
                            value={selectedWarehouseId ?? ''}
                            disabled={pending || warehouses.length === 0}
                            onChange={(event) => {
                                const params = new URLSearchParams(searchParams)
                                params.set('warehouseId', event.target.value)
                                params.delete('page')
                                setSearchParams(params)
                                resetForm()
                                setFeedback(null)
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

            {selectedWarehouse && !canRestock && (
                <p className="mgmt-note">
                    Bạn chỉ có quyền xem kho này. Chỉ quản lý kho được phân công
                    mới được nhập thêm hàng.
                </p>
            )}

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Chi tiết tồn kho</h2>
                </div>

                {feedback && <p role={feedback.error ? 'alert' : 'status'}>{feedback.text}</p>}
                {warehouseData?.error || inventoryData?.error ? (
                    <p role="alert">{(warehouseData?.error ?? inventoryData.error).message}</p>
                ) : !warehouseData || (selectedWarehouse && !inventoryData) ? (
                    <p role="status">Đang tải dữ liệu tồn kho…</p>
                ) : !selectedWarehouse ? (
                    <p className="mgmt-empty">Không có kho được phép xem.</p>
                ) : inventory.length === 0 ? (
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
                                        const isEditingRow = canRestock && editingProductId === item.productId

                                        return (
                                            <tr key={item.productId}>
                                                <td>
                                                    <div className="mgmt-product-cell">
                                                        {product && (
                                                            <ProductThumb product={product} />
                                                        )}
                                                        <span>
                                                            {item.productName}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="num">{item.onHand}</td>
                                                <td className="num">{item.reserved}</td>
                                                <td className="num">{item.available}</td>
                                                <td>
                                                    {canRestock ? (
                                                        isEditingRow ? (
                                                            <form className="mgmt-head__actions" onSubmit={event => handleRestock(event, item.productId)}>
                                                                <input
                                                                    type="number"
                                                                    className="mgmt-input"
                                                                    style={{ width: 100 }}
                                                                    min="1"
                                                                    max="2147483647"
                                                                    step="1"
                                                                    required
                                                                    value={quantity}
                                                                    disabled={pending}
                                                                    onChange={event => setQuantity(event.target.value)}
                                                                    aria-label={`Số lượng nhập thêm cho ${item.productName}`}
                                                                />
                                                                <button
                                                                    type="submit"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--primary"
                                                                    disabled={pending}
                                                                >
                                                                    {pending ? 'Đang nhập…' : 'Xác nhận'}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                                    disabled={pending}
                                                                    onClick={resetForm}
                                                                >
                                                                    Hủy
                                                                </button>
                                                            </form>
                                                        ) : (
                                                            <div className="mgmt-head__actions">
                                                                <button
                                                                    type="button"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                                    disabled={pending}
                                                                    onClick={() => {
                                                                        setEditingProductId(item.productId)
                                                                        setQuantity('')
                                                                        setFeedback(null)
                                                                    }}
                                                                >
                                                                    Nhập thêm
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    className="mgmt-btn mgmt-btn--sm mgmt-btn--ghost"
                                                                    disabled={pending}
                                                                    onClick={() => openAdjustModal(item)}
                                                                >
                                                                    Kiểm kê
                                                                </button>
                                                            </div>
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

            {adjustItem && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(event) => {
                        if (event.target === event.currentTarget && !pending) {
                            setAdjustItem(null)
                        }
                    }}
                >
                    <form
                        className="mgmt-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="adjust-stock-title"
                        onSubmit={handleAdjustSubmit}
                    >
                        <div className="mgmt-modal__head">
                            <h2 id="adjust-stock-title" className="mgmt-modal__title">
                                Kiểm kê &amp; điều chỉnh tồn kho
                            </h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                disabled={pending}
                                onClick={() => setAdjustItem(null)}
                                aria-label="Đóng hộp thoại kiểm kê"
                            >
                                <LucideIcon name="x" size={18} strokeWidth={1.75} />
                            </button>
                        </div>

                        <div className="mgmt-modal__body" style={{ marginBottom: 16 }}>
                            <p style={{ margin: '0 0 8px' }}>
                                Sản phẩm: <strong>{adjustItem.productName}</strong> ({adjustItem.sku})
                            </p>
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ui-muted)' }}>
                                Tồn thực tế hiện tại: <strong>{adjustItem.onHand}</strong> · Đang giữ:{' '}
                                <strong>{adjustItem.reserved}</strong> · Có thể bán:{' '}
                                <strong>{adjustItem.available}</strong>
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                                    <span>Tồn thực tế mới (tối thiểu {adjustItem.reserved})</span>
                                    <input
                                        type="number"
                                        className="mgmt-input"
                                        min={adjustItem.reserved}
                                        max={1000000}
                                        step="1"
                                        required
                                        disabled={pending}
                                        value={adjustOnHand}
                                        onChange={(event) => {
                                            setAdjustOnHand(event.target.value)
                                            setAdjustError('')
                                        }}
                                    />
                                </label>

                                <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600 }}>
                                    <span>Lý do điều chỉnh</span>
                                    <input
                                        type="text"
                                        className="mgmt-input"
                                        maxLength={200}
                                        required
                                        disabled={pending}
                                        placeholder="Ví dụ: Kiểm kê thực tế, hàng hỏng..."
                                        value={adjustNote}
                                        onChange={(event) => {
                                            setAdjustNote(event.target.value)
                                            setAdjustError('')
                                        }}
                                    />
                                </label>

                                {adjustError && (
                                    <p className="mgmt-form__error" role="alert" style={{ margin: 0 }}>
                                        {adjustError}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="mgmt-modal__actions">
                            <button
                                type="button"
                                className="mgmt-btn mgmt-btn--ghost"
                                disabled={pending}
                                onClick={() => setAdjustItem(null)}
                            >
                                Hủy
                            </button>
                            <button
                                type="submit"
                                className="mgmt-btn mgmt-btn--primary"
                                disabled={pending}
                            >
                                {pending ? 'Đang lưu…' : 'Lưu điều chỉnh'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    )
}

export default WarehouseInventoryPage
