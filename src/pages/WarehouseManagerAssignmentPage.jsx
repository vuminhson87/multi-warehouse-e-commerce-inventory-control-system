import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import ConfirmModal from '../components/ConfirmModal'
import { useAuth } from '../context/AuthContext'
import {
    assignManagerWarehouseApi,
    loadWarehouseManagersApi,
} from '../services/adminUserApi'

function WarehouseManagerAssignmentPage() {
    const { currentUser, token } = useAuth()
    const [result, setResult] = useState(null)
    const [revision, setRevision] = useState(0)
    const [draftWarehouses, setDraftWarehouses] = useState({})
    const [confirmRequest, setConfirmRequest] = useState(null)
    const [savingUserId, setSavingUserId] = useState(null)
    const [feedback, setFeedback] = useState(null)
    const submitting = useRef(false)

    const requestKey = `${token ?? ''}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const managers = currentResult?.data?.managers ?? []
    const warehouses = currentResult?.data?.warehouses ?? []

    useEffect(() => {
        if (!token || currentUser?.role !== 'ADMIN') return undefined
        const controller = new AbortController()

        loadWarehouseManagersApi(token, controller.signal)
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
    }, [token, currentUser?.role, requestKey])

    function handleReload() {
        setDraftWarehouses({})
        setFeedback(null)
        setRevision((value) => value + 1)
    }

    function handleRequestAssign(manager) {
        if (submitting.current || !manager.isActive) return
        const targetWarehouseId = Number(
            draftWarehouses[manager.id] ?? manager.assignedWarehouseId
        )
        if (!Number.isSafeInteger(targetWarehouseId) || targetWarehouseId <= 0) {
            setFeedback({ error: true, text: 'Vui lòng chọn kho hợp lệ.' })
            return
        }
        if (targetWarehouseId === manager.assignedWarehouseId) return

        const currentWarehouseName =
            manager.assignedWarehouse?.name ??
            `Kho #${manager.assignedWarehouseId ?? '?'}`
        const targetWarehouse = warehouses.find(
            (w) => Number(w.id) === targetWarehouseId
        )
        const targetWarehouseName =
            targetWarehouse?.name ?? `Kho #${targetWarehouseId}`

        setConfirmRequest({
            manager,
            targetWarehouseId,
            currentWarehouseName,
            targetWarehouseName,
        })
    }

    async function handleConfirmAssign() {
        if (!confirmRequest || submitting.current) return
        const { manager, targetWarehouseId, targetWarehouseName } = confirmRequest

        submitting.current = true
        setSavingUserId(manager.id)
        setFeedback(null)

        try {
            const response = await assignManagerWarehouseApi(
                token,
                manager.id,
                targetWarehouseId
            )
            const updatedManager = response?.manager
            setDraftWarehouses((previous) => {
                const next = { ...previous }
                delete next[manager.id]
                return next
            })
            setConfirmRequest(null)
            setFeedback({
                text: `Đã phân công tài khoản "${updatedManager?.username ?? manager.username}" phụ trách ${updatedManager?.assignedWarehouse?.name ?? targetWarehouseName}.`,
            })
            setRevision((value) => value + 1)
        } catch (error) {
            setConfirmRequest(null)
            setFeedback({
                error: true,
                text: error.message || 'Không thể cập nhật phân công kho.',
            })
            setRevision((value) => value + 1)
        } finally {
            submitting.current = false
            setSavingUserId(null)
        }
    }

    if (!currentUser) return <Navigate to="/login" replace />
    if (currentUser.role !== 'ADMIN') return <Navigate to="/" replace />

    const activeManagersCount = managers.filter((m) => m.isActive).length

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Phân công quản lý kho</h1>
                    <p>
                        Xem và cập nhật kho phụ trách cho từng tài khoản Quản lý kho
                        (mỗi tài khoản phụ trách một kho).
                    </p>
                </div>
                <div className="mgmt-head__actions">
                    <button
                        type="button"
                        className="mgmt-btn mgmt-btn--ghost"
                        disabled={savingUserId !== null}
                        onClick={handleReload}
                    >
                        Tải lại
                    </button>
                </div>
            </div>

            <div
                className="mgmt-kpis"
                style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}
            >
                <div className="mgmt-kpi">
                    <h3>Tổng quản lý kho</h3>
                    <p>{managers.length}</p>
                    <small>Tài khoản vai trò Quản lý kho</small>
                </div>
                <div className="mgmt-kpi">
                    <h3>Đang hoạt động</h3>
                    <p>{activeManagersCount}</p>
                    <small>Có thể nhận phân công kho</small>
                </div>
                <div className="mgmt-kpi">
                    <h3>Số kho trong hệ thống</h3>
                    <p>{warehouses.length}</p>
                    <small>Phạm vi kho có thể phân công</small>
                </div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <h2>Danh sách tài khoản quản lý kho</h2>
                </div>

                {feedback && (
                    <p
                        role={feedback.error ? 'alert' : 'status'}
                        style={{
                            color: feedback.error
                                ? 'var(--ui-danger)'
                                : 'var(--ui-success)',
                            fontWeight: 600,
                            marginTop: 0,
                        }}
                    >
                        {feedback.text}
                    </p>
                )}

                {currentResult?.error ? (
                    <div className="mgmt-empty" role="alert">
                        <strong>Không tải được danh sách quản lý kho</strong>
                        {currentResult.error.message}
                        <div style={{ marginTop: 12 }}>
                            <button
                                type="button"
                                className="mgmt-btn mgmt-btn--ghost"
                                onClick={handleReload}
                            >
                                Thử lại
                            </button>
                        </div>
                    </div>
                ) : !currentResult ? (
                    <div className="mgmt-empty" role="status">
                        Đang tải danh sách quản lý kho…
                    </div>
                ) : managers.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Chưa có tài khoản quản lý kho</strong>
                        Hiện chưa có tài khoản nào mang vai trò Quản lý kho trong hệ
                        thống.
                    </div>
                ) : (
                    <div className="mgmt-table-wrap">
                        <table className="mgmt-table">
                            <thead>
                                <tr>
                                    <th>Mã TK</th>
                                    <th>Tên đăng nhập</th>
                                    <th>Họ tên</th>
                                    <th>Trạng thái</th>
                                    <th>Kho đang phụ trách</th>
                                    <th>Kho phân công mới</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                {managers.map((manager) => {
                                    const selectedWarehouseId =
                                        draftWarehouses[manager.id] ??
                                        manager.assignedWarehouseId ??
                                        ''
                                    const isChanged =
                                        Number(selectedWarehouseId) !==
                                        Number(manager.assignedWarehouseId)
                                    const isSavingThis = savingUserId === manager.id
                                    const disableControls =
                                        savingUserId !== null ||
                                        !manager.isActive ||
                                        warehouses.length === 0

                                    return (
                                        <tr key={manager.id}>
                                            <td>#{manager.id}</td>
                                            <td>
                                                <strong>{manager.username}</strong>
                                            </td>
                                            <td>{manager.fullName || '—'}</td>
                                            <td>
                                                <span
                                                    className={`mgmt-badge ${
                                                        manager.isActive
                                                            ? 'mgmt-badge--success'
                                                            : 'mgmt-badge--muted'
                                                    }`}
                                                >
                                                    {manager.isActive
                                                        ? 'Hoạt động'
                                                        : 'Vô hiệu hóa'}
                                                </span>
                                            </td>
                                            <td>
                                                {manager.assignedWarehouse ? (
                                                    <span>
                                                        {manager.assignedWarehouse.name}{' '}
                                                        <span className="mgmt-badge mgmt-badge--muted">
                                                            {
                                                                manager
                                                                    .assignedWarehouse
                                                                    .code
                                                            }
                                                        </span>
                                                    </span>
                                                ) : (
                                                    <span className="mgmt-badge mgmt-badge--warning">
                                                        Chưa gán kho
                                                    </span>
                                                )}
                                            </td>
                                            <td>
                                                <select
                                                    className="mgmt-select"
                                                    aria-label={`Chọn kho phụ trách cho ${manager.username}`}
                                                    value={selectedWarehouseId}
                                                    disabled={disableControls}
                                                    onChange={(event) => {
                                                        const value = Number(
                                                            event.target.value
                                                        )
                                                        setDraftWarehouses(
                                                            (previous) => ({
                                                                ...previous,
                                                                [manager.id]: value,
                                                            })
                                                        )
                                                        setFeedback(null)
                                                    }}
                                                >
                                                    {warehouses.map((warehouse) => (
                                                        <option
                                                            key={warehouse.id}
                                                            value={warehouse.id}
                                                        >
                                                            {warehouse.name} (
                                                            {warehouse.code})
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="mgmt-btn mgmt-btn--primary mgmt-btn--sm"
                                                    disabled={
                                                        disableControls || !isChanged
                                                    }
                                                    onClick={() =>
                                                        handleRequestAssign(manager)
                                                    }
                                                >
                                                    {isSavingThis
                                                        ? 'Đang lưu…'
                                                        : 'Lưu phân công'}
                                                </button>
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <ConfirmModal
                open={Boolean(confirmRequest)}
                title="Xác nhận phân công kho"
                message={
                    confirmRequest ? (
                        <>
                            Chuyển tài khoản{' '}
                            <strong>{confirmRequest.manager.username}</strong> từ{' '}
                            <strong>{confirmRequest.currentWarehouseName}</strong>{' '}
                            sang phụ trách{' '}
                            <strong>{confirmRequest.targetWarehouseName}</strong>?
                        </>
                    ) : null
                }
                confirmLabel="Xác nhận phân công"
                pending={savingUserId !== null}
                onConfirm={handleConfirmAssign}
                onCancel={() => setConfirmRequest(null)}
            />
        </div>
    )
}

export default WarehouseManagerAssignmentPage
