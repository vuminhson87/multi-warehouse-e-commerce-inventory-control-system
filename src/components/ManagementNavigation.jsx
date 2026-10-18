import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import './ManagementNavigation.css'

function ManagementNavigation() {
    const { currentUser, setCurrentUser } = useAuth()
    const navigate = useNavigate()

    if (
        !currentUser ||
        !['ADMIN', 'WAREHOUSE_MANAGER'].includes(currentUser.role)
    ) {
        return null
    }

    const isAdmin = currentUser.role === 'ADMIN'

    const menuItems = [
        ...(isAdmin
            ? [
                  {
                      label: 'Quản lý sản phẩm',
                      path: '/admin/products',
                  },
              ]
            : []),
        {
            label: 'Dashboard tồn kho',
            path: '/inventory',
        },
        {
            label: 'Tồn kho theo kho',
            path: '/inventory/warehouses',
        },
        {
            label: 'Cảnh báo tồn kho',
            path: '/inventory/alerts',
        },
    ]

    const handleLogout = () => {
        setCurrentUser(null)
        navigate('/login', { replace: true })
    }

    return (
        <header className="management-navigation">
            <div className="management-navigation-inner">
                <div className="management-navigation-brand">
                    Multi-Warehouse
                </div>

                <nav
                    className="management-navigation-links"
                    aria-label="Điều hướng quản lý"
                >
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            end={item.path === '/inventory'}
                            className={({ isActive }) =>
                                `management-navigation-link ${
                                    isActive ? 'active' : ''
                                }`
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                <div className="management-navigation-account">
                    <span className="management-navigation-username">
                        {currentUser.username}
                    </span>

                    <button
                        type="button"
                        className="management-navigation-logout"
                        onClick={handleLogout}
                    >
                        Đăng xuất
                    </button>
                </div>
            </div>
        </header>
    )
}

export default ManagementNavigation