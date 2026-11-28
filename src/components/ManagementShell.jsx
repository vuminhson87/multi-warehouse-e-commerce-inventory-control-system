import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { flushSync } from 'react-dom'
import { useAuth } from '../context/AuthContext'
import { loadWarehouses } from '../services/inventoryApi.js'
import LucideIcon from './LucideIcon'
import './management.css'

const ROLE_LABELS = {
    ADMIN: 'Quản trị hệ thống',
    WAREHOUSE_MANAGER: 'Quản lý kho',
}

// Khung điều hướng dùng chung cho Quản lý kho và Admin.
// Hoạt động dạng ngăn kéo trượt giống menu điều hướng ở cửa hàng.
function ManagementShell({ children }) {
    const { currentUser, token, setCurrentUser } = useAuth()
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [warehouseState, setWarehouseState] = useState(null)
    const menuBtnRef = useRef(null)
    const closeBtnRef = useRef(null)
    const warehouseRequestKey = `${token ?? ''}:${currentUser?.assignedWarehouseId ?? ''}`

    useEffect(() => {
        if (
            !token ||
            currentUser?.role !== 'WAREHOUSE_MANAGER' ||
            !currentUser.assignedWarehouseId
        ) return undefined

        const controller = new AbortController()
        loadWarehouses(token, controller.signal)
            .then(warehouses => {
                if (!controller.signal.aborted) {
                    setWarehouseState({ requestKey: warehouseRequestKey, warehouses })
                }
            })
            .catch(error => {
                if (!controller.signal.aborted) {
                    setWarehouseState({ requestKey: warehouseRequestKey, warehouses: [], error })
                }
            })

        return () => controller.abort()
    }, [token, currentUser?.role, currentUser?.assignedWarehouseId, warehouseRequestKey])

    // Escape đóng ngăn kéo; khóa cuộn nền khi ngăn kéo đang mở; quản lý focus giống storefront.
    useEffect(() => {
        if (!isOpen) return undefined

        closeBtnRef.current?.focus()
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKey = (event) => {
            if (event.key === 'Escape') {
                setIsOpen(false)
                menuBtnRef.current?.focus()
            }
        }

        document.addEventListener('keydown', onKey)
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = previousOverflow
        }
    }, [isOpen])

    if (
        !currentUser ||
        !['ADMIN', 'WAREHOUSE_MANAGER'].includes(currentUser.role)
    ) {
        return children
    }

    const isAdmin = currentUser.role === 'ADMIN'
    const warehouses = warehouseState?.requestKey === warehouseRequestKey
        ? warehouseState.warehouses
        : []
    const assignedWarehouse = warehouses.find(
        (w) => Number(w.id) === Number(currentUser.assignedWarehouseId)
    )

    const menuItems = [
        ...(isAdmin
            ? [
                  { label: 'Tổng quan', path: '/admin', icon: 'dashboard', end: true },
                  { label: 'Quản lý sản phẩm', path: '/admin/products', icon: 'package' },
                  { label: 'Xử lý đơn hàng', path: '/admin/orders/processing', icon: 'box' },
                  { label: 'Quản lý tài khoản', path: '/admin/users', icon: 'user' },
                  { label: 'Phân công kho', path: '/admin/warehouse-managers', icon: 'shield' },
                  { label: 'Tin nhắn khách hàng', path: '/admin/messages', icon: 'message-circle' },
                  { label: 'Nhật ký thao tác', path: '/admin/audit-logs', icon: 'file-text' },
              ]
            : [
                  { label: 'Xử lý đơn hàng', path: '/inventory/orders', icon: 'box' },
                  { label: 'Tin nhắn khách hàng', path: '/inventory/messages', icon: 'message-circle' },
              ]),
        { label: 'Tổng quan tồn kho', path: '/inventory', icon: 'warehouse', end: true },
        { label: 'Tồn kho theo kho', path: '/inventory/warehouses', icon: 'box' },
        { label: 'Lịch sử biến động', path: '/inventory/movements', icon: 'file-text' },
        { label: 'Cảnh báo tồn kho', path: '/inventory/alerts', icon: 'alert-triangle' },
    ]

    const closeDrawer = (restoreFocus = false) => {
        setIsOpen(false)
        if (restoreFocus) {
            menuBtnRef.current?.focus()
        }
    }

    const handleLogout = () => {
        setIsOpen(false)
        flushSync(() => {
            navigate('/', { replace: true })
        })
        setCurrentUser(null)
    }

    const initial = String(currentUser.username || '?')
        .slice(0, 1)
        .toUpperCase()

    return (
        <div className="mgmt-shell">
            <div
                className={`mgmt-overlay ${isOpen ? 'is-open' : ''}`}
                onClick={() => closeDrawer(true)}
                aria-hidden="true"
            />

            <aside
                id="mgmt-drawer-nav"
                className={`mgmt-sidebar ${isOpen ? 'is-open' : ''}`}
                aria-label="Điều hướng quản lý"
                inert={!isOpen}
            >
                <div className="mgmt-sidebar__brand">
                    <span className="mgmt-sidebar__logo">
                        <LucideIcon name="package" size={22} strokeWidth={1.75} />
                    </span>
                    <span>{isAdmin ? 'Admin Panel' : 'Warehouse'}</span>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        className="icon-btn mgmt-sidebar__close"
                        onClick={() => closeDrawer(true)}
                        aria-label="Đóng menu"
                    >
                        <LucideIcon name="x" size={20} strokeWidth={1.75} />
                    </button>
                </div>

                <nav className="mgmt-sidebar__nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onClick={() => closeDrawer(false)}
                            className={({ isActive }) =>
                                `mgmt-nav-link ${isActive ? 'is-active' : ''}`
                            }
                        >
                            <LucideIcon name={item.icon} size={20} strokeWidth={1.75} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="mgmt-sidebar__bottom">
                    <Link
                        to="/"
                        className="mgmt-nav-link"
                        onClick={() => closeDrawer(false)}
                    >
                        <LucideIcon name="store" size={20} strokeWidth={1.75} />
                        <span>Về cửa hàng</span>
                    </Link>
                    <button
                        type="button"
                        className="mgmt-nav-link mgmt-nav-link--button"
                        onClick={handleLogout}
                    >
                        <LucideIcon name="log-out" size={20} strokeWidth={1.75} />
                        <span>Đăng xuất</span>
                    </button>
                </div>
            </aside>

            <div className="mgmt-main">
                <header className="mgmt-topbar">
                    <div className="mgmt-topbar__left">
                        <button
                            ref={menuBtnRef}
                            type="button"
                            className="icon-btn mgmt-topbar__menu"
                            onClick={() => setIsOpen((prev) => !prev)}
                            aria-label="Mở menu quản lý"
                            aria-expanded={isOpen}
                            aria-controls="mgmt-drawer-nav"
                        >
                            <LucideIcon name="menu" size={22} strokeWidth={1.75} />
                        </button>
                        <Link
                            to={isAdmin ? '/admin' : '/inventory'}
                            className="mgmt-topbar__brand"
                        >
                            {isAdmin ? 'Admin Panel' : 'Warehouse'}
                        </Link>
                    </div>

                    <div className="mgmt-user">
                        <span className="mgmt-user__avatar">{initial}</span>
                        <span className="mgmt-user__text">
                            <strong>{currentUser.username}</strong>
                            <small>
                                {ROLE_LABELS[currentUser.role]}
                                {assignedWarehouse
                                    ? ` • ${assignedWarehouse.name}`
                                    : currentUser.role === 'WAREHOUSE_MANAGER'
                                        ? ` • ${currentUser.assignedWarehouseId ? `Kho #${currentUser.assignedWarehouseId}` : 'Chưa được phân công kho'}`
                                        : ''}
                            </small>
                        </span>
                    </div>
                </header>

                <div className="mgmt-content">{children}</div>
            </div>
        </div>
    )
}

export default ManagementShell
