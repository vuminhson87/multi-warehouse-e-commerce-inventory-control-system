import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import LucideIcon from '../components/LucideIcon'
import ProductPagination from '../components/ProductPagination'
import { useAuth } from '../context/AuthContext'
import { formatCurrency, formatDateTime, getOrderStatusLabel } from '../constants/order'
import {
    createWarehouseManagerApi,
    deleteAdminUserApi,
    getAdminUserDetailApi,
    getAdminUsersApi,
    resetAdminUserPasswordApi,
    setAdminUserStatusApi,
    updateAdminUserApi,
} from '../services/adminUserApi'

const PAGE_SIZE = 20

const ROLE_LABELS = Object.freeze({
    CUSTOMER: 'Khách hàng',
    WAREHOUSE_MANAGER: 'Quản lý kho',
    ADMIN: 'Quản trị hệ thống',
})

function AdminUsersPage() {
    const { currentUser, token } = useAuth()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()

    const rawRole = searchParams.get('role')
    const roleTab = rawRole === 'WAREHOUSE_MANAGER' ? 'WAREHOUSE_MANAGER' : 'CUSTOMER'
    const statusFilter = searchParams.get('status') || 'ALL'
    const search = searchParams.get('search') || ''
    const parsedPage = Number(searchParams.get('page') ?? 1)
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

    const [draftSearch, setDraftSearch] = useState(null)
    const [revision, setRevision] = useState(0)
    const [result, setResult] = useState(null)
    const [feedback, setFeedback] = useState(null)

    // Modal state
    const [detailModal, setDetailModal] = useState(null) // { loading, data, error, user }
    const [createOpen, setCreateOpen] = useState(false)
    const [createForm, setCreateForm] = useState({
        username: '',
        fullName: '',
        email: '',
        password: '',
        warehouseId: '',
    })
    const [editUser, setEditUser] = useState(null)
    const [editForm, setEditForm] = useState({ fullName: '', email: '', warehouseId: '' })
    const [resetTarget, setResetTarget] = useState(null)
    const [resetForm, setResetForm] = useState({ newPassword: '', confirmPassword: '' })
    const [lockTarget, setLockTarget] = useState(null)
    const [lockReason, setLockReason] = useState('')
    const [deleteTarget, setDeleteTarget] = useState(null)

    const [modalBusy, setModalBusy] = useState(false)
    const [modalError, setModalError] = useState('')

    const isAdmin = currentUser?.role === 'ADMIN'
    const searchInput = draftSearch ?? search
    const requestKey = `${token ?? ''}:${roleTab}:${statusFilter}:${search}:${page}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const users = currentResult?.data?.users ?? []
    const warehouses = currentResult?.data?.warehouses ?? []
    const pagination = currentResult?.data?.pagination

    useEffect(() => {
        if (!token || !isAdmin) return undefined
        const controller = new AbortController()
        getAdminUsersApi(token, {
            page,
            limit: PAGE_SIZE,
            role: roleTab,
            status: statusFilter,
            search,
            signal: controller.signal,
        })
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
    }, [token, isAdmin, page, roleTab, statusFilter, search, requestKey])

    function updateQuery(next) {
        const params = new URLSearchParams()
        const nextRole = next.role ?? roleTab
        const nextStatus = next.status ?? statusFilter
        const nextSearch = next.search !== undefined ? next.search : search

        params.set('role', nextRole)
        if (nextStatus && nextStatus !== 'ALL') params.set('status', nextStatus)
        if (nextSearch && nextSearch.trim()) params.set('search', nextSearch.trim())
        setDraftSearch(null)
        setSearchParams(params)
        setFeedback(null)
    }

    function getPageHref(nextPage) {
        const params = new URLSearchParams()
        params.set('role', roleTab)
        if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
        if (search) params.set('search', search)
        if (nextPage > 1) params.set('page', String(nextPage))
        return `${location.pathname}?${params.toString()}`
    }

    async function openDetailModal(user) {
        setDetailModal({ user, loading: true, data: null, error: null })
        try {
            const data = await getAdminUserDetailApi(token, user.id)
            setDetailModal({ user, loading: false, data, error: null })
        } catch (error) {
            setDetailModal({ user, loading: false, data: null, error })
        }
    }

    function openCreateManagerModal() {
        setModalError('')
        setCreateForm({
            username: '',
            fullName: '',
            email: '',
            password: '',
            warehouseId: warehouses[0]?.id ? String(warehouses[0].id) : '',
        })
        setCreateOpen(true)
    }

    async function handleCreateManagerSubmit(event) {
        event.preventDefault()
        if (modalBusy) return
        setModalBusy(true)
        setModalError('')
        try {
            const res = await createWarehouseManagerApi(token, createForm)
            setCreateOpen(false)
            setFeedback({
                text: `Đã tạo tài khoản Quản lý kho @${res.user.username}.`,
            })
            if (roleTab !== 'WAREHOUSE_MANAGER') {
                updateQuery({ role: 'WAREHOUSE_MANAGER' })
            } else {
                setRevision((v) => v + 1)
            }
        } catch (error) {
            setModalError(error.message || 'Không thể tạo tài khoản Quản lý kho.')
        } finally {
            setModalBusy(false)
        }
    }

    function openEditModal(user) {
        setModalError('')
        setEditUser(user)
        setEditForm({
            fullName: user.fullName ?? '',
            email: user.email ?? '',
            warehouseId: user.assignedWarehouseId ? String(user.assignedWarehouseId) : '',
        })
    }

    async function handleEditSubmit(event) {
        event.preventDefault()
        if (!editUser || modalBusy) return
        setModalBusy(true)
        setModalError('')
        try {
            const payload = {
                fullName: editForm.fullName.trim() || null,
                email: editForm.email.trim() || null,
                ...(editUser.role === 'WAREHOUSE_MANAGER' && editForm.warehouseId
                    ? { warehouseId: Number(editForm.warehouseId) }
                    : {}),
            }
            const res = await updateAdminUserApi(token, editUser.id, payload)
            setEditUser(null)
            setFeedback({ text: `Đã cập nhật tài khoản @${res.user.username}.` })
            setRevision((v) => v + 1)
        } catch (error) {
            setModalError(error.message || 'Không thể cập nhật tài khoản.')
        } finally {
            setModalBusy(false)
        }
    }

    function openResetPasswordModal(user) {
        setModalError('')
        setResetTarget(user)
        setResetForm({ newPassword: '', confirmPassword: '' })
    }

    async function handleResetPasswordSubmit(event) {
        event.preventDefault()
        if (!resetTarget || modalBusy) return
        if (resetForm.newPassword.length < 8) {
            setModalError('Mật khẩu mới phải có ít nhất 8 ký tự.')
            return
        }
        if (resetForm.newPassword !== resetForm.confirmPassword) {
            setModalError('Mật khẩu xác nhận không khớp.')
            return
        }
        setModalBusy(true)
        setModalError('')
        try {
            await resetAdminUserPasswordApi(token, resetTarget.id, resetForm.newPassword)
            setResetTarget(null)
            setFeedback({ text: `Đã đặt lại mật khẩu cho @${resetTarget.username}.` })
        } catch (error) {
            setModalError(error.message || 'Không thể đặt lại mật khẩu.')
        } finally {
            setModalBusy(false)
        }
    }

    function openLockModal(user) {
        setModalError('')
        setLockTarget(user)
        setLockReason('')
    }

    async function handleLockConfirm(event) {
        event.preventDefault()
        if (!lockTarget || modalBusy) return
        const nextActive = !lockTarget.isActive
        setModalBusy(true)
        setModalError('')
        try {
            await setAdminUserStatusApi(token, lockTarget.id, {
                isActive: nextActive,
                reason: lockReason,
            })
            setLockTarget(null)
            setFeedback({
                text: `${nextActive ? 'Đã mở khóa' : 'Đã khóa'} tài khoản @${lockTarget.username}.`,
            })
            setRevision((v) => v + 1)
        } catch (error) {
            setModalError(error.message || 'Không thể cập nhật trạng thái tài khoản.')
        } finally {
            setModalBusy(false)
        }
    }

    async function handleDeleteAction(mode) {
        if (!deleteTarget || modalBusy) return
        setModalBusy(true)
        setModalError('')
        try {
            const res = await deleteAdminUserApi(token, deleteTarget.id, { mode })
            setDeleteTarget(null)
            setFeedback({
                text:
                    res.mode === 'DELETED'
                        ? `Đã xóa vĩnh viễn tài khoản @${deleteTarget.username}.`
                        : `Đã xóa mềm (ẩn danh hóa) tài khoản @${deleteTarget.username} và giữ nguyên lịch sử giao dịch.`,
            })
            setRevision((v) => v + 1)
        } catch (error) {
            setModalError(error.message || 'Không thể xóa tài khoản.')
        } finally {
            setModalBusy(false)
        }
    }

    if (!currentUser) return <Navigate to="/login" replace />
    if (!isAdmin) return <Navigate to="/" replace />

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Quản lý tài khoản</h1>
                    <p>
                        Quản lý tài khoản Khách hàng và Quản lý kho: xem hoạt động, chỉnh sửa, khóa/mở khóa, đặt lại mật khẩu hoặc xóa an toàn.
                    </p>
                </div>
                <div className="mgmt-head__actions">
                    <button
                        type="button"
                        className="mgmt-btn mgmt-btn--primary"
                        onClick={openCreateManagerModal}
                    >
                        <LucideIcon name="plus" size={16} />
                        Tạo Quản lý kho
                    </button>
                    <button
                        type="button"
                        className="mgmt-btn mgmt-btn--ghost"
                        onClick={() => setRevision((v) => v + 1)}
                    >
                        Tải lại
                    </button>
                </div>
            </div>

            <section className="mgmt-card">
                <div className="mgmt-card__head">
                    <div className="mgmt-head__actions" role="tablist" aria-label="Loại tài khoản">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={roleTab === 'CUSTOMER'}
                            className={`mgmt-btn ${roleTab === 'CUSTOMER' ? 'mgmt-btn--primary' : 'mgmt-btn--ghost'}`}
                            onClick={() => updateQuery({ role: 'CUSTOMER' })}
                        >
                            Khách hàng
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={roleTab === 'WAREHOUSE_MANAGER'}
                            className={`mgmt-btn ${roleTab === 'WAREHOUSE_MANAGER' ? 'mgmt-btn--primary' : 'mgmt-btn--ghost'}`}
                            onClick={() => updateQuery({ role: 'WAREHOUSE_MANAGER' })}
                        >
                            Quản lý kho
                        </button>
                    </div>
                    {pagination && <span>{pagination.total} tài khoản</span>}
                </div>

                <form
                    className="mgmt-toolbar"
                    onSubmit={(e) => {
                        e.preventDefault()
                        updateQuery({ search: searchInput })
                    }}
                >
                    <input
                        type="search"
                        className="mgmt-input"
                        placeholder="Tìm theo tên đăng nhập, họ tên hoặc Gmail..."
                        value={searchInput}
                        onChange={(e) => setDraftSearch(e.target.value)}
                        aria-label="Tìm tài khoản"
                    />
                    <select
                        className="mgmt-select"
                        value={statusFilter}
                        onChange={(e) => updateQuery({ status: e.target.value, search: searchInput })}
                        aria-label="Lọc trạng thái tài khoản"
                    >
                        <option value="ALL">Mọi trạng thái</option>
                        <option value="ACTIVE">Đang hoạt động</option>
                        <option value="LOCKED">Đã khóa</option>
                    </select>
                    <button type="submit" className="mgmt-btn mgmt-btn--primary">
                        Lọc
                    </button>
                </form>

                {feedback && (
                    <p role={feedback.error ? 'alert' : 'status'} style={{ marginBottom: 14 }}>
                        {feedback.text}
                    </p>
                )}

                {currentResult?.error ? (
                    <div className="mgmt-empty" role="alert">
                        <strong>Không tải được danh sách tài khoản</strong>
                        {currentResult.error.message}
                    </div>
                ) : !currentResult ? (
                    <div className="mgmt-empty" role="status">Đang tải danh sách tài khoản…</div>
                ) : users.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Không tìm thấy tài khoản nào</strong>
                        Thử thay đổi từ khóa hoặc bộ lọc trạng thái.
                    </div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Tài khoản</th>
                                        <th>Gmail</th>
                                        {roleTab === 'WAREHOUSE_MANAGER' ? (
                                            <th>Kho phụ trách</th>
                                        ) : (
                                            <th className="num">Đơn hàng</th>
                                        )}
                                        <th>Trạng thái</th>
                                        <th>Ngày tạo</th>
                                        <th>Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>
                                                <div>
                                                    <strong>@{user.username}</strong>
                                                </div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>
                                                    {user.fullName || 'Chưa cập nhật họ tên'}
                                                </div>
                                            </td>
                                            <td>{user.email || '—'}</td>
                                            {roleTab === 'WAREHOUSE_MANAGER' ? (
                                                <td>{user.assignedWarehouse?.name || 'Chưa phân công'}</td>
                                            ) : (
                                                <td className="num">{user.orderCount}</td>
                                            )}
                                            <td>
                                                <span
                                                    className={`mgmt-badge ${
                                                        user.isActive
                                                            ? 'mgmt-badge--success'
                                                            : 'mgmt-badge--danger'
                                                    }`}
                                                >
                                                    {user.isActive ? 'Hoạt động' : 'Đã khóa'}
                                                </span>
                                            </td>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {formatDateTime(user.createdAt)}
                                            </td>
                                            <td>
                                                <div className="mgmt-head__actions" style={{ gap: 6 }}>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        onClick={() => openDetailModal(user)}
                                                    >
                                                        Chi tiết
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        onClick={() => openEditModal(user)}
                                                    >
                                                        Sửa
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        onClick={() => openResetPasswordModal(user)}
                                                    >
                                                        Đặt lại MK
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        onClick={() => openLockModal(user)}
                                                    >
                                                        {user.isActive ? 'Khóa' : 'Mở khóa'}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="mgmt-btn mgmt-btn--ghost mgmt-btn--sm"
                                                        style={{ color: '#b91c1c', borderColor: '#fecaca' }}
                                                        onClick={() => {
                                                            setModalError('')
                                                            setDeleteTarget(user)
                                                        }}
                                                    >
                                                        Xóa
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {pagination && (
                            <ProductPagination
                                page={pagination.page}
                                totalPages={pagination.totalPages}
                                getPageHref={getPageHref}
                                ariaLabel="Phân trang tài khoản"
                            />
                        )}
                    </>
                )}
            </section>

            {/* MODAL: CHI TIẾT TÀI KHOẢN */}
            {detailModal && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget) setDetailModal(null)
                    }}
                >
                    <div className="mgmt-modal mgmt-modal--wide" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">
                                Hồ sơ tài khoản — @{detailModal.user.username}
                            </h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => setDetailModal(null)}
                                aria-label="Đóng chi tiết"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        {detailModal.loading ? (
                            <p className="mgmt-modal__body">Đang tải thông tin chi tiết…</p>
                        ) : detailModal.error ? (
                            <p className="mgmt-modal__body" role="alert" style={{ color: '#b91c1c' }}>
                                {detailModal.error.message}
                            </p>
                        ) : (
                            <div className="mgmt-modal__body" style={{ display: 'grid', gap: 14 }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                    <div><strong>Vai trò:</strong> {ROLE_LABELS[detailModal.data.user.role]}</div>
                                    <div><strong>Họ tên:</strong> {detailModal.data.user.fullName || '—'}</div>
                                    <div><strong>Gmail:</strong> {detailModal.data.user.email || '—'}</div>
                                    <div>
                                        <strong>Trạng thái:</strong>{' '}
                                        {detailModal.data.user.isActive ? 'Đang hoạt động' : 'Đã khóa'}
                                    </div>
                                    {detailModal.data.user.assignedWarehouse && (
                                        <div>
                                            <strong>Kho phụ trách:</strong>{' '}
                                            {detailModal.data.user.assignedWarehouse.name}
                                        </div>
                                    )}
                                    <div>
                                        <strong>Sản phẩm đã thích:</strong> {detailModal.data.user.wishlistCount}
                                    </div>
                                </div>

                                {detailModal.data.user.role === 'CUSTOMER' && (
                                    <>
                                        <div
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                                                gap: 8,
                                                padding: 12,
                                                background: '#fafafa',
                                                border: '1px solid #e5e5e5',
                                                borderRadius: 8,
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>Tổng đơn</div>
                                                <strong>{detailModal.data.stats.totalOrders}</strong>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>Đang xử lý</div>
                                                <strong>{detailModal.data.stats.processingOrders}</strong>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>Hoàn tất</div>
                                                <strong>{detailModal.data.stats.completedOrders}</strong>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>Tổng chi tiêu</div>
                                                <strong>{formatCurrency(detailModal.data.stats.totalSpent)}</strong>
                                            </div>
                                        </div>

                                        <div>
                                            <h3 style={{ margin: '0 0 8px', fontSize: 14 }}>5 đơn hàng gần nhất</h3>
                                            {detailModal.data.recentOrders.length === 0 ? (
                                                <p style={{ margin: 0, color: '#737373' }}>Chưa có đơn hàng nào.</p>
                                            ) : (
                                                <div className="mgmt-table-wrap">
                                                    <table className="mgmt-table" style={{ minWidth: 420 }}>
                                                        <thead>
                                                            <tr>
                                                                <th>Mã đơn</th>
                                                                <th>Kho xuất</th>
                                                                <th className="num">Tổng tiền</th>
                                                                <th>Trạng thái</th>
                                                                <th>Ngày đặt</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {detailModal.data.recentOrders.map((order) => (
                                                                <tr key={order.orderId}>
                                                                    <td>#{order.orderId}</td>
                                                                    <td>{order.warehouseName || '—'}</td>
                                                                    <td className="num">
                                                                        {formatCurrency(order.totalAmount)}
                                                                    </td>
                                                                    <td>{getOrderStatusLabel(order.status)}</td>
                                                                    <td>{formatDateTime(order.createdAt)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        <div className="mgmt-modal__actions">
                            <button
                                type="button"
                                className="mgmt-btn mgmt-btn--ghost"
                                onClick={() => setDetailModal(null)}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: TẠO QUẢN LÝ KHO MỚI */}
            {createOpen && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !modalBusy) setCreateOpen(false)
                    }}
                >
                    <div className="mgmt-modal" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">Tạo tài khoản Quản lý kho</h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => !modalBusy && setCreateOpen(false)}
                                aria-label="Đóng"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleCreateManagerSubmit}
                            style={{ display: 'grid', gap: 12, marginTop: 14 }}
                        >
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Tên đăng nhập *
                                </label>
                                <input
                                    type="text"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    required
                                    minLength={3}
                                    maxLength={50}
                                    placeholder="VD: kho_hcm_02"
                                    value={createForm.username}
                                    onChange={(e) =>
                                        setCreateForm((prev) => ({ ...prev, username: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    maxLength={120}
                                    value={createForm.fullName}
                                    onChange={(e) =>
                                        setCreateForm((prev) => ({ ...prev, fullName: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Email (tùy chọn)
                                </label>
                                <input
                                    type="email"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    maxLength={120}
                                    value={createForm.email}
                                    onChange={(e) =>
                                        setCreateForm((prev) => ({ ...prev, email: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Mật khẩu khởi tạo *
                                </label>
                                <input
                                    type="password"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    placeholder="Ít nhất 8 ký tự"
                                    value={createForm.password}
                                    onChange={(e) =>
                                        setCreateForm((prev) => ({ ...prev, password: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Kho phụ trách *
                                </label>
                                <select
                                    className="mgmt-select"
                                    style={{ width: '100%' }}
                                    required
                                    value={createForm.warehouseId}
                                    onChange={(e) =>
                                        setCreateForm((prev) => ({ ...prev, warehouseId: e.target.value }))
                                    }
                                >
                                    <option value="">-- Chọn kho --</option>
                                    {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.id}>
                                            {wh.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {modalError && (
                                <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                                    {modalError}
                                </p>
                            )}

                            <div className="mgmt-modal__actions" style={{ marginTop: 6 }}>
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--ghost"
                                    disabled={modalBusy}
                                    onClick={() => setCreateOpen(false)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="mgmt-btn mgmt-btn--primary"
                                    disabled={modalBusy}
                                >
                                    {modalBusy ? 'Đang tạo…' : 'Tạo tài khoản'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: CHỈNH SỬA TÀI KHOẢN */}
            {editUser && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !modalBusy) setEditUser(null)
                    }}
                >
                    <div className="mgmt-modal" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">Chỉnh sửa @{editUser.username}</h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => !modalBusy && setEditUser(null)}
                                aria-label="Đóng"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleEditSubmit}
                            style={{ display: 'grid', gap: 12, marginTop: 14 }}
                        >
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Họ và tên
                                </label>
                                <input
                                    type="text"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    maxLength={120}
                                    value={editForm.fullName}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({ ...prev, fullName: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Gmail / Email
                                </label>
                                <input
                                    type="email"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    maxLength={120}
                                    placeholder="Để trống nếu muốn gỡ email"
                                    value={editForm.email}
                                    onChange={(e) =>
                                        setEditForm((prev) => ({ ...prev, email: e.target.value }))
                                    }
                                />
                            </div>
                            {editUser.role === 'WAREHOUSE_MANAGER' && (
                                <div>
                                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                        Kho phụ trách
                                    </label>
                                    <select
                                        className="mgmt-select"
                                        style={{ width: '100%' }}
                                        required
                                        value={editForm.warehouseId}
                                        onChange={(e) =>
                                            setEditForm((prev) => ({ ...prev, warehouseId: e.target.value }))
                                        }
                                    >
                                        {warehouses.map((wh) => (
                                            <option key={wh.id} value={wh.id}>
                                                {wh.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {modalError && (
                                <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                                    {modalError}
                                </p>
                            )}

                            <div className="mgmt-modal__actions" style={{ marginTop: 6 }}>
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--ghost"
                                    disabled={modalBusy}
                                    onClick={() => setEditUser(null)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="mgmt-btn mgmt-btn--primary"
                                    disabled={modalBusy}
                                >
                                    {modalBusy ? 'Đang lưu…' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: ĐẶT LẠI MẬT KHẨU */}
            {resetTarget && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !modalBusy) setResetTarget(null)
                    }}
                >
                    <div className="mgmt-modal" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">Đặt lại mật khẩu — @{resetTarget.username}</h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => !modalBusy && setResetTarget(null)}
                                aria-label="Đóng"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        <form
                            onSubmit={handleResetPasswordSubmit}
                            style={{ display: 'grid', gap: 12, marginTop: 14 }}
                        >
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Mật khẩu mới *
                                </label>
                                <input
                                    type="password"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    placeholder="Ít nhất 8 ký tự"
                                    value={resetForm.newPassword}
                                    onChange={(e) =>
                                        setResetForm((prev) => ({ ...prev, newPassword: e.target.value }))
                                    }
                                />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Xác nhận mật khẩu mới *
                                </label>
                                <input
                                    type="password"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    required
                                    minLength={8}
                                    maxLength={72}
                                    value={resetForm.confirmPassword}
                                    onChange={(e) =>
                                        setResetForm((prev) => ({
                                            ...prev,
                                            confirmPassword: e.target.value,
                                        }))
                                    }
                                />
                            </div>

                            {modalError && (
                                <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                                    {modalError}
                                </p>
                            )}

                            <div className="mgmt-modal__actions" style={{ marginTop: 6 }}>
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--ghost"
                                    disabled={modalBusy}
                                    onClick={() => setResetTarget(null)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="mgmt-btn mgmt-btn--primary"
                                    disabled={modalBusy}
                                >
                                    {modalBusy ? 'Đang cập nhật…' : 'Cập nhật mật khẩu'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: KHÓA / MỞ KHÓA */}
            {lockTarget && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !modalBusy) setLockTarget(null)
                    }}
                >
                    <div className="mgmt-modal" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">
                                {lockTarget.isActive ? 'Khóa tài khoản' : 'Mở khóa tài khoản'} — @{lockTarget.username}
                            </h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => !modalBusy && setLockTarget(null)}
                                aria-label="Đóng"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleLockConfirm} style={{ display: 'grid', gap: 12, marginTop: 12 }}>
                            <p className="mgmt-modal__body" style={{ margin: 0 }}>
                                {lockTarget.isActive
                                    ? 'Tài khoản bị khóa sẽ lập tức bị đăng xuất và không thể đăng nhập mới. Các đơn hàng đã thanh toán vẫn được giữ nguyên lịch sử và tiếp tục xử lý bình thường.'
                                    : 'Tài khoản sẽ được phép đăng nhập và sử dụng hệ thống trở lại.'}
                            </p>

                            <div>
                                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                                    Lý do (ghi vào nhật ký quản trị, tùy chọn)
                                </label>
                                <input
                                    type="text"
                                    className="mgmt-input"
                                    style={{ width: '100%' }}
                                    maxLength={200}
                                    placeholder="VD: Vi phạm chính sách / Nhân sự nghỉ việc..."
                                    value={lockReason}
                                    onChange={(e) => setLockReason(e.target.value)}
                                />
                            </div>

                            {modalError && (
                                <p role="alert" style={{ margin: 0, color: '#b91c1c', fontSize: 13 }}>
                                    {modalError}
                                </p>
                            )}

                            <div className="mgmt-modal__actions">
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--ghost"
                                    disabled={modalBusy}
                                    onClick={() => setLockTarget(null)}
                                >
                                    Hủy
                                </button>
                                <button
                                    type="submit"
                                    className="mgmt-btn mgmt-btn--primary"
                                    disabled={modalBusy}
                                >
                                    {modalBusy
                                        ? 'Đang xử lý…'
                                        : lockTarget.isActive
                                          ? 'Xác nhận khóa'
                                          : 'Xác nhận mở khóa'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: XÓA / ẨN DANH HÓA TÀI KHOẢN */}
            {deleteTarget && (
                <div
                    className="mgmt-modal-overlay"
                    onMouseDown={(e) => {
                        if (e.target === e.currentTarget && !modalBusy) setDeleteTarget(null)
                    }}
                >
                    <div className="mgmt-modal" role="dialog" aria-modal="true">
                        <div className="mgmt-modal__head">
                            <h2 className="mgmt-modal__title">Xóa tài khoản — @{deleteTarget.username}</h2>
                            <button
                                type="button"
                                className="icon-btn mgmt-modal__close"
                                onClick={() => !modalBusy && setDeleteTarget(null)}
                                aria-label="Đóng"
                            >
                                <LucideIcon name="x" size={18} />
                            </button>
                        </div>

                        <div className="mgmt-modal__body" style={{ marginBottom: 16 }}>
                            {deleteTarget.canHardDelete ? (
                                <p style={{ margin: 0 }}>
                                    Tài khoản này <strong>chưa phát sinh đơn hàng hay nhật ký nghiệp vụ</strong>.
                                    Bạn có thể <strong>xóa vĩnh viễn</strong> khỏi hệ thống (Gmail liên kết sẽ được giải phóng).
                                </p>
                            ) : (
                                <p style={{ margin: 0 }}>
                                    Tài khoản này đã có <strong>{deleteTarget.orderCount} đơn hàng</strong> và{' '}
                                    <strong>{deleteTarget.dependencyCount - deleteTarget.orderCount} bản ghi nghiệp vụ</strong>,
                                    nên không thể xóa cứng để bảo toàn lịch sử đối soát. Bạn có thể chọn{' '}
                                    <strong>Xóa mềm (ẩn danh hóa)</strong> để khóa vĩnh viễn, xóa thông tin cá nhân & giải phóng Gmail.
                                </p>
                            )}
                        </div>

                        {modalError && (
                            <p role="alert" style={{ margin: '0 0 12px', color: '#b91c1c', fontSize: 13 }}>
                                {modalError}
                            </p>
                        )}

                        <div className="mgmt-modal__actions">
                            <button
                                type="button"
                                className="mgmt-btn mgmt-btn--ghost"
                                disabled={modalBusy}
                                onClick={() => setDeleteTarget(null)}
                            >
                                Hủy
                            </button>
                            {deleteTarget.canHardDelete ? (
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--primary"
                                    style={{ background: '#b91c1c' }}
                                    disabled={modalBusy}
                                    onClick={() => handleDeleteAction('delete')}
                                >
                                    {modalBusy ? 'Đang xóa…' : 'Xóa vĩnh viễn'}
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="mgmt-btn mgmt-btn--primary"
                                    style={{ background: '#b91c1c' }}
                                    disabled={modalBusy}
                                    onClick={() => handleDeleteAction('anonymize')}
                                >
                                    {modalBusy ? 'Đang xử lý…' : 'Xóa mềm (ẩn danh hóa)'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminUsersPage
