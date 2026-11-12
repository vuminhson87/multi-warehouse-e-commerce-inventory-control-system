import { useEffect, useState } from 'react'
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
// Chỉ liệt kê các route thực sự tồn tại và đúng quyền của người dùng.
function ManagementShell({ children }) {
    const { currentUser, token, setCurrentUser } = useAuth()
    const navigate = useNavigate()
    const [isOpen, setIsOpen] = useState(false)
    const [warehouseState, setWarehouseState] = useState(null)
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

    // Escape đóng sidebar trên mobile.
    useEffect(() => {
        if (!isOpen) return undefined
        const onKey = (event) => {
            if (event.key === 'Escape') setIsOpen(false)
        }
        document.addEventListener('keydown', onKey)
        return () => document.removeEventListener('keydown', onKey)
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
              ]
            : []),
        { label: 'Tổng quan tồn kho', path: '/inventory', icon: 'warehouse', end: true },
        { label: 'Tồn kho theo kho', path: '/inventory/warehouses', icon: 'box' },
        { label: 'Cảnh báo tồn kho', path: '/inventory/alerts', icon: 'alert-triangle' },
    ]

    const handleLogout = () => {
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
                onClick={() => setIsOpen(false)}
                aria-hidden="true"
            />

            <aside
                className={`mgmt-sidebar ${isOpen ? 'is-open' : ''}`}
                aria-label="Điều hướng quản lý"
            >
                <div className="mgmt-sidebar__brand">
                    <span className="mgmt-sidebar__logo">
                        <LucideIcon name="package" size={22} strokeWidth={1.75} />
                    </span>
                    <span>{isAdmin ? 'Admin Panel' : 'Warehouse'}</span>
                    <button
                        type="button"
                        className="icon-btn mgmt-sidebar__close"
                        onClick={() => setIsOpen(false)}
                        aria-label="Đóng menu"
                    >
                        <LucideIcon name="x" size={20} />
                    </button>
                </div>

                <nav className="mgmt-sidebar__nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.end}
                            onClick={() => setIsOpen(false)}
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
                    <Link to="/" className="mgmt-nav-link">
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
                    <button
                        type="button"
                        className="icon-btn mgmt-topbar__menu"
                        onClick={() => setIsOpen(true)}
                        aria-label="Mở menu quản lý"
                    >
                        <LucideIcon name="menu" size={22} />
                    </button>

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
