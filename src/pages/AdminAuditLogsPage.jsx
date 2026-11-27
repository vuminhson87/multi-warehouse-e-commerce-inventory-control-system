import { useEffect, useState } from 'react'
import { Navigate, useLocation, useSearchParams } from 'react-router-dom'
import ProductPagination from '../components/ProductPagination'
import { useAuth } from '../context/AuthContext'
import { formatDateTime } from '../constants/order'
import { getAdminAuditLogsApi } from '../services/auditApi'

const PAGE_SIZE = 20

const TARGET_TYPE_LABELS = Object.freeze({
    ORDER: 'Đơn hàng',
    PRODUCT: 'Sản phẩm',
    USER: 'Nhân sự kho',
    INVENTORY: 'Tồn kho',
})

const ACTION_LABELS = Object.freeze({
    ORDER_START_PROCESSING: 'Bắt đầu xử lý đơn',
    ORDER_ADD_TRACKING_EVENT: 'Cập nhật tiến độ giao hàng',
    PRODUCT_CREATE: 'Thêm sản phẩm',
    PRODUCT_UPDATE: 'Cập nhật sản phẩm',
    PRODUCT_DISCONTINUE: 'Ngừng kinh doanh',
    PRODUCT_ACTIVATE: 'Mở bán lại sản phẩm',
    WAREHOUSE_MANAGER_ASSIGN: 'Phân công quản lý kho',
    USER_CREATE_MANAGER: 'Tạo Quản lý kho',
    USER_UPDATE: 'Cập nhật tài khoản',
    USER_LOCK: 'Khóa tài khoản',
    USER_UNLOCK: 'Mở khóa tài khoản',
    USER_RESET_PASSWORD: 'Đặt lại mật khẩu',
    USER_DELETE: 'Xóa vĩnh viễn tài khoản',
    USER_ANONYMIZE: 'Xóa mềm (ẩn danh hóa)',
})

const ROLE_LABELS = Object.freeze({
    ADMIN: 'Quản trị hệ thống',
    WAREHOUSE_MANAGER: 'Quản lý kho',
})

function AdminAuditLogsPage() {
    const { currentUser, token } = useAuth()
    const location = useLocation()
    const [searchParams, setSearchParams] = useSearchParams()
    const targetType = searchParams.get('targetType') || 'ALL'
    const search = searchParams.get('search') || ''
    const parsedPage = Number(searchParams.get('page') ?? 1)
    const page = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1

    const [draftSearch, setDraftSearch] = useState(null)
    const [revision, setRevision] = useState(0)
    const [result, setResult] = useState(null)

    const isAdmin = currentUser?.role === 'ADMIN'
    const searchInput = draftSearch ?? search
    const requestKey = `${token ?? ''}:${targetType}:${search}:${page}:${revision}`
    const currentResult = result?.requestKey === requestKey ? result : null
    const logs = currentResult?.data?.logs ?? []
    const pagination = currentResult?.data?.pagination

    useEffect(() => {
        if (!token || !isAdmin) return undefined
        const controller = new AbortController()
        getAdminAuditLogsApi(token, {
            page,
            limit: PAGE_SIZE,
            targetType,
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
    }, [token, isAdmin, page, targetType, search, requestKey])

    function updateFilter(nextTargetType, nextSearch) {
        const params = new URLSearchParams()
        if (nextTargetType && nextTargetType !== 'ALL') params.set('targetType', nextTargetType)
        if (nextSearch && nextSearch.trim()) params.set('search', nextSearch.trim())
        setDraftSearch(null)
        setSearchParams(params)
    }

    function handleSearchSubmit(event) {
        event.preventDefault()
        updateFilter(targetType, searchInput)
    }

    function getPageHref(nextPage) {
        const params = new URLSearchParams()
        if (targetType && targetType !== 'ALL') params.set('targetType', targetType)
        if (search) params.set('search', search)
        if (nextPage > 1) params.set('page', String(nextPage))
        const query = params.toString()
        return query ? `${location.pathname}?${query}` : location.pathname
    }

    if (!currentUser) return <Navigate to="/login" replace />
    if (!isAdmin) return <Navigate to="/" replace />

    return (
        <div className="mgmt-page">
            <div className="mgmt-head">
                <div>
                    <h1>Nhật ký thao tác quản trị</h1>
                    <p>
                        Theo dõi lịch sử xử lý đơn hàng, cập nhật tiến độ giao hàng, thay đổi sản phẩm và phân công kho.
                    </p>
                </div>
                <div className="mgmt-head__actions">
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
                    <form className="mgmt-toolbar" style={{ marginBottom: 0, flex: 1 }} onSubmit={handleSearchSubmit}>
                        <input
                            type="search"
                            className="mgmt-input"
                            placeholder="Tìm theo mô tả thao tác hoặc tên tài khoản..."
                            value={searchInput}
                            onChange={(e) => setDraftSearch(e.target.value)}
                            aria-label="Tìm kiếm nhật ký thao tác"
                        />
                        <select
                            className="mgmt-select"
                            value={targetType}
                            onChange={(e) => updateFilter(e.target.value, searchInput)}
                            aria-label="Lọc theo loại đối tượng"
                        >
                            <option value="ALL">Tất cả đối tượng</option>
                            <option value="ORDER">Đơn hàng</option>
                            <option value="PRODUCT">Sản phẩm</option>
                            <option value="USER">Nhân sự kho</option>
                        </select>
                        <button type="submit" className="mgmt-btn mgmt-btn--primary">
                            Lọc
                        </button>
                    </form>
                    {pagination && <span>{pagination.total} bản ghi</span>}
                </div>

                {currentResult?.error ? (
                    <div className="mgmt-empty" role="alert">
                        <strong>Không tải được nhật ký thao tác</strong>
                        {currentResult.error.message}
                        <button
                            type="button"
                            className="mgmt-btn mgmt-btn--ghost"
                            onClick={() => setRevision((value) => value + 1)}
                        >
                            Thử lại
                        </button>
                    </div>
                ) : !currentResult ? (
                    <div className="mgmt-empty" role="status">Đang tải nhật ký thao tác…</div>
                ) : logs.length === 0 ? (
                    <div className="mgmt-empty">
                        <strong>Chưa có nhật ký thao tác phù hợp</strong>
                        Các thao tác quản trị mới sẽ được tự động ghi nhận tại đây.
                    </div>
                ) : (
                    <>
                        <div className="mgmt-table-wrap">
                            <table className="mgmt-table">
                                <thead>
                                    <tr>
                                        <th>Thời gian</th>
                                        <th>Người thực hiện</th>
                                        <th>Hành động</th>
                                        <th>Đối tượng</th>
                                        <th>Kho liên quan</th>
                                        <th>Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {logs.map((log) => (
                                        <tr key={log.id}>
                                            <td style={{ whiteSpace: 'nowrap' }}>
                                                {formatDateTime(log.createdAt)}
                                            </td>
                                            <td>
                                                <div>
                                                    <strong>@{log.actor?.username ?? 'system'}</strong>
                                                </div>
                                                <div style={{ fontSize: 12, color: '#737373' }}>
                                                    {ROLE_LABELS[log.actor?.role] ?? log.actor?.role ?? '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <span className="mgmt-badge mgmt-badge--muted">
                                                    {ACTION_LABELS[log.action] ?? log.action}
                                                </span>
                                            </td>
                                            <td>
                                                {TARGET_TYPE_LABELS[log.targetType] ?? log.targetType}
                                                {log.targetId ? ` #${log.targetId}` : ''}
                                            </td>
                                            <td>{log.warehouseName ?? '—'}</td>
                                            <td>{log.summary}</td>
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
                                ariaLabel="Phân trang nhật ký thao tác"
                            />
                        )}
                    </>
                )}
            </section>
        </div>
    )
}

export default AdminAuditLogsPage
