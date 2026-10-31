import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './CustomerHeader.css'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useInventory } from '../context/InventoryContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import LucideIcon from './LucideIcon'
import LoginModal from './LoginModal'

const ROLE_LABELS = {
    CUSTOMER: 'Khách hàng thành viên',
    WAREHOUSE_MANAGER: 'Quản lý kho (Warehouse Manager)',
    ADMIN: 'Quản trị viên (Admin)',
}

function CustomerHeader() {
    const {
        cartItems,
        addToCart,
        increaseQuantity,
        decreaseQuantity,
    } = useCart()
    const totalAmount = cartItems.reduce(
        (sum, item) => sum + (Number(item.price) || 0) * (Number(item.quantity) || 0),
        0
    )
    const { currentUser, logout } = useAuth()
    const { products } = useProducts()
    const { getProductAvailableStock } = useInventory()
    const {
        wishlistIds,
        toggleWishlist,
        setIsDrawerOpen,
        toastMessage,
        isToastVisible,
        showToast,
    } = useWishlist()

    const location = useLocation()
    const navigate = useNavigate()

    const [activeDrawer, setActiveDrawer] = useState(null) // 'dashboard' | 'cart' | 'wishlist' | 'profile' | null
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [isLoginOpen, setIsLoginOpen] = useState(false)

    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)
    const activeProducts = products.filter(
        (product) => (product.status ?? 'ACTIVE') === 'ACTIVE'
    )

    const categoryCounts = activeProducts.reduce((acc, product) => {
        const cat = product.category || 'Khác'
        acc[cat] = (acc[cat] || 0) + 1
        return acc
    }, {})

    function openDrawer(drawerType) {
        if (activeDrawer === drawerType) {
            closeAllDrawers()
            return
        }
        setActiveDrawer(drawerType)
        setIsDrawerOpen(true)
    }

    function closeAllDrawers() {
        setActiveDrawer(null)
        setIsDrawerOpen(false)
    }

    function handleProfileClick() {
        if (!currentUser) {
            closeAllDrawers()
            setIsLoginOpen(true)
            return
        }
        openDrawer('profile')
    }

    function handleSearchSubmit(event) {
        event.preventDefault()
        const trimmed = searchText.trim()
        closeAllDrawers()
        if (trimmed) {
            navigate(`/products?search=${encodeURIComponent(trimmed)}`)
        } else {
            navigate('/products')
        }
    }

    function handleClearSearch() {
        setSearchText('')
        setIsSearchOpen(false)
        if (location.pathname === '/products' && location.search) {
            navigate('/products')
        }
    }

    function handleNavigateAndClose(targetPath, hashId = null) {
        closeAllDrawers()
        if (hashId && location.pathname === '/') {
            const el = document.getElementById(hashId)
            if (el) {
                el.scrollIntoView({ behavior: 'smooth' })
                return
            }
        }
        navigate(targetPath)
        if (hashId) {
            setTimeout(() => {
                const el = document.getElementById(hashId)
                if (el) el.scrollIntoView({ behavior: 'smooth' })
            }, 120)
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' })
        }
    }

    function handleQuickAddFromWishlist(product) {
        const available = getProductAvailableStock(product.id)
        if (available <= 0) {
            showToast(`"${product.name}" hiện đã hết hàng`)
            return
        }
        const inCart = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const currentQty = inCart ? inCart.quantity : 0
        addToCart(product)
        if (currentQty + 1 <= available) {
            showToast(`Đã thêm "${product.name}" vào giỏ hàng`)
        }
    }

    function handleLogout() {
        closeAllDrawers()
        logout()
        showToast('Đã đăng xuất tài khoản')
        navigate('/')
    }

    const userInitials = currentUser?.username
        ? currentUser.username.slice(0, 2).toUpperCase()
        : 'KH'

    const wishlistedProducts = wishlistIds
        .map((id) => products.find((p) => Number(p.id) === Number(id)))
        .filter(Boolean)

    return (
        <>
            {/* LỚP PHỦ XÁM & MỜ KHI MỞ DASHBOARD HOẶC NGĂN KÉO */}
            <div
                className={`atelier-backdrop ${activeDrawer ? 'is-open' : ''}`}
                onClick={closeAllDrawers}
                aria-hidden="true"
            />

            {/* ===================================================================== */}
            {/* BẢNG DASHBOARD BÊN TRÁI (LÀM MỜ GIAO DIỆN CHÍNH KHI MỞ)               */}
            {/* ===================================================================== */}
            <aside
                className={`atelier-dashboard-drawer sharp-frame ${
                    activeDrawer === 'dashboard' ? 'is-open' : ''
                }`}
                aria-label="Dashboard điều khiển"
            >
                <div>
                    {/* Đầu Dashboard */}
                    <div className="atelier-drawer-header">
                        <div className="atelier-drawer-brand">
                            <div className="atelier-monogram sharp-frame">MW</div>
                            <div>
                                <p className="atelier-drawer-title">DASHBOARD</p>
                                <p className="atelier-drawer-subtitle">
                                    Bảng điều khiển hệ thống
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={closeAllDrawers}
                            className="icon-btn atelier-header-btn"
                            title="Đóng Dashboard"
                            aria-label="Đóng Dashboard"
                        >
                            <LucideIcon name="x" size={20} strokeWidth={1.75} />
                        </button>
                    </div>

                    {/* Tóm tắt tài khoản trên Dashboard */}
                    <div className="atelier-dash-account sharp-frame">
                        <div className="atelier-dash-user-row">
                            <div className="atelier-dash-user-info">
                                <div className="atelier-avatar">{userInitials}</div>
                                <div>
                                    <p className="atelier-user-name">
                                        {currentUser
                                            ? currentUser.fullName || currentUser.username
                                            : 'Khách tham quan'}
                                    </p>
                                    <p className="atelier-user-role">
                                        {currentUser
                                            ? ROLE_LABELS[currentUser.role] || currentUser.role
                                            : 'Đăng nhập để theo dõi đơn hàng'}
                                    </p>
                                </div>
                            </div>
                            {currentUser ? (
                                <button
                                    type="button"
                                    onClick={() => openDrawer('profile')}
                                    className="pill-btn atelier-dash-profile-btn"
                                >
                                    Hồ sơ
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => {
                                        closeAllDrawers()
                                        setIsLoginOpen(true)
                                    }}
                                    className="pill-btn atelier-dash-profile-btn"
                                >
                                    Đăng nhập
                                </button>
                            )}
                        </div>

                        {/* Thống kê nhanh trong Dashboard */}
                        <div className="atelier-dash-stats sharp-frame">
                            <button
                                type="button"
                                onClick={() => {
                                    if (!currentUser) {
                                        closeAllDrawers()
                                        setIsLoginOpen(true)
                                        return
                                    }
                                    handleNavigateAndClose('/orders')
                                }}
                                className="atelier-dash-stat-btn"
                            >
                                <p className="atelier-stat-val">
                                    {currentUser ? 'Xem' : '--'}
                                </p>
                                <p className="atelier-stat-lbl">Đơn hàng</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => openDrawer('wishlist')}
                                className="atelier-dash-stat-btn"
                            >
                                <p className="atelier-stat-val">
                                    {String(wishlistIds.length).padStart(2, '0')}
                                </p>
                                <p className="atelier-stat-lbl">Đã thích</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => openDrawer('cart')}
                                className="atelier-dash-stat-btn"
                            >
                                <p className="atelier-stat-val">
                                    {String(cartCount).padStart(2, '0')}
                                </p>
                                <p className="atelier-stat-lbl">Giỏ hàng</p>
                            </button>
                        </div>
                    </div>

                    {/* Danh mục điều hướng chính trong Dashboard */}
                    <div className="atelier-dash-section">
                        <p className="atelier-dash-heading">Điều hướng nhanh</p>
                        <nav className="atelier-dash-nav">
                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="home" size={16} strokeWidth={1.75} />
                                    <span>Trang chủ</span>
                                </span>
                                <LucideIcon name="chevron-right" size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/', 'new-arrivals')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="sparkles" size={16} strokeWidth={1.75} />
                                    <span>Hàng mới về (New Arrivals)</span>
                                </span>
                                <span className="atelier-dash-tag">Mới</span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/', 'best-sellers')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="flame" size={16} strokeWidth={1.75} />
                                    <span>Bán chạy nhất (Best Sellers)</span>
                                </span>
                                <LucideIcon name="chevron-right" size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/products')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="layout-grid" size={16} strokeWidth={1.75} />
                                    <span>Toàn bộ danh mục sản phẩm</span>
                                </span>
                                <LucideIcon name="chevron-right" size={16} />
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/cart')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="shopping-cart" size={16} strokeWidth={1.75} />
                                    <span>Trang giỏ hàng</span>
                                </span>
                                <LucideIcon name="chevron-right" size={16} />
                            </button>

                            {currentUser && (
                                <button
                                    type="button"
                                    onClick={() => handleNavigateAndClose('/orders')}
                                    className="atelier-dash-link pill-btn"
                                >
                                    <span className="atelier-dash-link-left">
                                        <LucideIcon name="package" size={16} strokeWidth={1.75} />
                                        <span>Lịch sử & Theo dõi đơn hàng</span>
                                    </span>
                                    <LucideIcon name="chevron-right" size={16} />
                                </button>
                            )}
                        </nav>

                        {/* Phân quyền Quản trị & Kho hàng (Giữ nguyên 100% route Admin & Warehouse) */}
                        {(currentUser?.role === 'ADMIN' ||
                            currentUser?.role === 'WAREHOUSE_MANAGER') && (
                            <>
                                <div className="atelier-dash-divider" />
                                <p className="atelier-dash-heading">
                                    Quản trị & Điều phối kho
                                </p>
                                <nav className="atelier-dash-nav">
                                    {currentUser.role === 'ADMIN' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleNavigateAndClose('/admin/products')
                                            }
                                            className="atelier-dash-link pill-btn"
                                        >
                                            <span className="atelier-dash-link-left">
                                                <LucideIcon
                                                    name="shield"
                                                    size={16}
                                                    strokeWidth={1.75}
                                                />
                                                <span>Quản lý sản phẩm (Admin)</span>
                                            </span>
                                            <LucideIcon name="chevron-right" size={16} />
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleNavigateAndClose('/inventory')
                                        }
                                        className="atelier-dash-link pill-btn"
                                    >
                                        <span className="atelier-dash-link-left">
                                            <LucideIcon
                                                name="warehouse"
                                                size={16}
                                                strokeWidth={1.75}
                                            />
                                            <span>Inventory Dashboard</span>
                                        </span>
                                        <LucideIcon name="chevron-right" size={16} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleNavigateAndClose('/inventory/warehouses')
                                        }
                                        className="atelier-dash-link pill-btn"
                                    >
                                        <span className="atelier-dash-link-left">
                                            <LucideIcon name="box" size={16} strokeWidth={1.75} />
                                            <span>Tồn kho theo từng kho</span>
                                        </span>
                                        <LucideIcon name="chevron-right" size={16} />
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleNavigateAndClose('/inventory/alerts')
                                        }
                                        className="atelier-dash-link pill-btn"
                                    >
                                        <span className="atelier-dash-link-left">
                                            <LucideIcon
                                                name="alert-triangle"
                                                size={16}
                                                strokeWidth={1.75}
                                            />
                                            <span>Cảnh báo tồn kho thấp</span>
                                        </span>
                                        <LucideIcon name="chevron-right" size={16} />
                                    </button>
                                </nav>
                            </>
                        )}

                        <div className="atelier-dash-divider" />

                        <p className="atelier-dash-heading">Bộ lọc danh mục</p>
                        <div className="atelier-dash-nav">
                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/products')}
                                className="atelier-dash-link pill-btn"
                            >
                                <span>Tất cả mặt hàng</span>
                                <span className="atelier-dash-count">
                                    {String(activeProducts.length).padStart(2, '0')}
                                </span>
                            </button>

                            {Object.entries(categoryCounts).map(([cat, count]) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() =>
                                        handleNavigateAndClose(
                                            `/products?category=${encodeURIComponent(cat)}`
                                        )
                                    }
                                    className="atelier-dash-link pill-btn"
                                >
                                    <span>{cat}</span>
                                    <span className="atelier-dash-count">
                                        {String(count).padStart(2, '0')}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Chân Dashboard */}
                <div className="atelier-dash-footer">
                    <p className="atelier-dash-footer-note">
                        Hệ thống điều phối tồn kho tự động: TP.HCM • Hà Nội • Đà Nẵng
                    </p>
                    {currentUser ? (
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="pill-btn atelier-dash-footer-btn"
                        >
                            Đăng xuất ({currentUser.username})
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={() => {
                                closeAllDrawers()
                                setIsLoginOpen(true)
                            }}
                            className="pill-btn atelier-dash-footer-btn"
                        >
                            Đăng nhập tài khoản
                        </button>
                    )}
                </div>
            </aside>

            {/* ===================================================================== */}
            {/* NGĂN KÉO ĐA NĂNG BÊN PHẢI (GIỎ HÀNG / ĐÃ THÍCH / TRANG CÁ NHÂN)       */}
            {/* ===================================================================== */}
            <aside
                className={`atelier-side-drawer sharp-frame ${
                    activeDrawer && activeDrawer !== 'dashboard' ? 'is-open' : ''
                }`}
                aria-label="Ngăn kéo tiện ích"
            >
                <div className="atelier-drawer-header">
                    <h3 className="atelier-drawer-title">
                        {activeDrawer === 'cart' && `GIỎ HÀNG (${cartCount})`}
                        {activeDrawer === 'wishlist' &&
                            `MỤC HÀNG ĐÃ THÍCH (${wishlistIds.length})`}
                        {activeDrawer === 'profile' && 'TRANG CÁ NHÂN'}
                    </h3>
                    <button
                        type="button"
                        onClick={closeAllDrawers}
                        className="icon-btn atelier-header-btn"
                        aria-label="Đóng ngăn kéo"
                    >
                        <LucideIcon name="x" size={20} strokeWidth={1.75} />
                    </button>
                </div>

                <div className="atelier-side-body">
                    {/* NỘI DUNG GIỎ HÀNG */}
                    {activeDrawer === 'cart' &&
                        (cartItems.length === 0 ? (
                            <div className="atelier-side-empty">
                                Giỏ hàng của bạn đang trống.
                            </div>
                        ) : (
                            cartItems.map((item) => {
                                const visual = getProductVisual(item)
                                const maxStock = getProductAvailableStock(item.id)
                                return (
                                    <div key={item.id} className="atelier-drawer-item">
                                        <img
                                            src={visual.image}
                                            alt={item.name}
                                            className="atelier-drawer-item-img sharp-frame"
                                        />
                                        <div className="atelier-drawer-item-info">
                                            <h4 className="atelier-drawer-item-title">
                                                {item.name}
                                            </h4>
                                            <p className="atelier-drawer-item-sub">
                                                {visual.subtitle}
                                            </p>
                                            <p className="atelier-drawer-item-price">
                                                {item.price.toLocaleString('vi-VN')} VNĐ
                                            </p>
                                        </div>
                                        <div className="atelier-qty-controls">
                                            <button
                                                type="button"
                                                onClick={() => decreaseQuantity(item.id)}
                                                className="icon-btn atelier-qty-btn"
                                                aria-label="Giảm số lượng"
                                            >
                                                -
                                            </button>
                                            <span className="atelier-qty-val">
                                                {item.quantity}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    increaseQuantity(item.id, maxStock)
                                                }
                                                disabled={item.quantity >= maxStock}
                                                className="icon-btn atelier-qty-btn"
                                                aria-label="Tăng số lượng"
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        ))}

                    {/* NỘI DUNG MỤC HÀNG ĐÃ THÍCH */}
                    {activeDrawer === 'wishlist' &&
                        (wishlistedProducts.length === 0 ? (
                            <div className="atelier-side-empty">
                                Chưa có sản phẩm nào trong danh sách yêu thích.
                            </div>
                        ) : (
                            wishlistedProducts.map((product) => {
                                const visual = getProductVisual(product)
                                return (
                                    <div key={product.id} className="atelier-drawer-item">
                                        <img
                                            src={visual.image}
                                            alt={product.name}
                                            className="atelier-drawer-item-img sharp-frame"
                                        />
                                        <div className="atelier-drawer-item-info">
                                            <h4 className="atelier-drawer-item-title">
                                                {product.name}
                                            </h4>
                                            <p className="atelier-drawer-item-sub">
                                                {visual.subtitle}
                                            </p>
                                            <p className="atelier-drawer-item-price">
                                                {product.price.toLocaleString('vi-VN')} VNĐ
                                            </p>
                                        </div>
                                        <div className="atelier-qty-controls">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleQuickAddFromWishlist(product)
                                                }
                                                className="pill-btn atelier-search-submit"
                                            >
                                                + Giỏ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleWishlist(
                                                        product.id,
                                                        product.name
                                                    )
                                                }
                                                className="icon-btn atelier-qty-btn"
                                                title="Xóa khỏi mục đã thích"
                                            >
                                                <LucideIcon name="trash-2" size={14} />
                                            </button>
                                        </div>
                                    </div>
                                )
                            })
                        ))}

                    {/* NỘI DUNG TRANG CÁ NHÂN */}
                    {activeDrawer === 'profile' && currentUser && (
                        <div style={{ paddingTop: '16px' }}>
                            <div className="atelier-dash-user-info">
                                <div className="atelier-avatar">{userInitials}</div>
                                <div>
                                    <p className="atelier-user-name">
                                        {currentUser.fullName || currentUser.username}
                                    </p>
                                    <p className="atelier-user-role">
                                        @{currentUser.username}
                                    </p>
                                </div>
                            </div>

                            <div className="atelier-profile-card sharp-frame">
                                <div className="atelier-profile-row">
                                    <span style={{ color: '#71717a' }}>Vai trò:</span>
                                    <strong>
                                        {ROLE_LABELS[currentUser.role] ||
                                            currentUser.role}
                                    </strong>
                                </div>
                                {currentUser.warehouseId && (
                                    <div className="atelier-profile-row">
                                        <span style={{ color: '#71717a' }}>
                                            Kho phụ trách:
                                        </span>
                                        <strong>Kho #{currentUser.warehouseId}</strong>
                                    </div>
                                )}
                                <div className="atelier-profile-row">
                                    <span style={{ color: '#71717a' }}>
                                        Mục đã thích:
                                    </span>
                                    <strong>{wishlistIds.length} sản phẩm</strong>
                                </div>
                                <div className="atelier-profile-row">
                                    <span style={{ color: '#71717a' }}>
                                        Trong giỏ hàng:
                                    </span>
                                    <strong>{cartCount} sản phẩm</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* CHÂN NGĂN KÉO PHẢI */}
                <div className="atelier-side-footer">
                    {activeDrawer === 'cart' && cartItems.length > 0 && (
                        <>
                            <div className="atelier-side-total-row">
                                <span className="atelier-side-total-label">
                                    TỔNG CỘNG
                                </span>
                                <span className="atelier-side-total-val">
                                    {totalAmount.toLocaleString('vi-VN')} VNĐ
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    closeAllDrawers()
                                    if (!currentUser) {
                                        setIsLoginOpen(true)
                                        return
                                    }
                                    navigate('/checkout')
                                }}
                                className="pill-btn atelier-side-primary-btn"
                            >
                                Tiến hành Thanh toán
                            </button>
                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/cart')}
                                className="pill-btn atelier-side-secondary-btn"
                            >
                                Xem chi tiết Giỏ hàng
                            </button>
                        </>
                    )}

                    {activeDrawer === 'cart' && cartItems.length === 0 && (
                        <button
                            type="button"
                            onClick={() => handleNavigateAndClose('/products')}
                            className="pill-btn atelier-side-secondary-btn"
                        >
                            Khám phá Sản phẩm
                        </button>
                    )}

                    {activeDrawer === 'wishlist' && (
                        <button
                            type="button"
                            onClick={closeAllDrawers}
                            className="pill-btn atelier-side-secondary-btn"
                        >
                            Tiếp tục xem sản phẩm
                        </button>
                    )}

                    {activeDrawer === 'profile' && (
                        <>
                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/orders')}
                                className="pill-btn atelier-side-primary-btn"
                            >
                                Xem Lịch sử Đơn hàng
                            </button>
                            <button
                                type="button"
                                onClick={() => openDrawer('dashboard')}
                                className="pill-btn atelier-side-secondary-btn"
                            >
                                Mở toàn bộ Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="pill-btn atelier-side-secondary-btn"
                            >
                                Đăng xuất
                            </button>
                        </>
                    )}
                </div>
            </aside>

            {/* ===================================================================== */}
            {/* THANH ĐIỀU HƯỚNG TRÊN CÙNG (TOP NAVIGATION)                           */}
            {/* ===================================================================== */}
            <header className="atelier-header">
                <div className="atelier-header-inner">
                    {/* Cụm nút chức năng bên trái (Menu Dashboard, Trang chủ, Sản phẩm, Tìm kiếm) */}
                    <div className="atelier-nav-cluster">
                        <button
                            type="button"
                            onClick={() => openDrawer('dashboard')}
                            className={`icon-btn atelier-header-btn ${
                                activeDrawer === 'dashboard' ? 'is-active' : ''
                            }`}
                            title="Mở Dashboard điều khiển"
                            aria-label="Mở Dashboard điều khiển"
                        >
                            <LucideIcon name="menu" size={20} strokeWidth={1.6} />
                        </button>

                        <Link
                            to="/"
                            onClick={closeAllDrawers}
                            className={`icon-btn atelier-header-btn ${
                                location.pathname === '/' && !activeDrawer
                                    ? 'is-active'
                                    : ''
                            }`}
                            title="Trang chủ"
                            aria-label="Trang chủ"
                        >
                            <LucideIcon name="home" size={20} strokeWidth={1.6} />
                        </Link>

                        <Link
                            to="/products"
                            onClick={closeAllDrawers}
                            className={`icon-btn atelier-header-btn ${
                                location.pathname.startsWith('/products') &&
                                !activeDrawer
                                    ? 'is-active'
                                    : ''
                            }`}
                            title="Danh sách Sản phẩm"
                            aria-label="Danh sách Sản phẩm"
                        >
                            <LucideIcon
                                name="layout-grid"
                                size={20}
                                strokeWidth={1.6}
                            />
                        </Link>

                        <button
                            type="button"
                            onClick={() => setIsSearchOpen((prev) => !prev)}
                            className={`icon-btn atelier-header-btn ${
                                isSearchOpen ? 'is-active' : ''
                            }`}
                            title="Tìm kiếm sản phẩm"
                            aria-label="Tìm kiếm sản phẩm"
                        >
                            <LucideIcon name="search" size={20} strokeWidth={1.6} />
                        </button>
                    </div>

                    {/* Logo tối giản ở chính giữa */}
                    <Link
                        to="/"
                        onClick={closeAllDrawers}
                        className="atelier-brand-logo"
                    >
                        ATELIER <span>OF</span> MULTI-WAREHOUSE
                    </Link>

                    {/* Cụm nút chức năng bên phải: Đã thích, Giỏ hàng, Trang cá nhân */}
                    <div className="atelier-nav-cluster">
                        <button
                            type="button"
                            onClick={() => openDrawer('wishlist')}
                            className={`icon-btn atelier-header-btn ${
                                activeDrawer === 'wishlist' ? 'is-active' : ''
                            }`}
                            title="Mục hàng đã thích"
                            aria-label="Mục hàng đã thích"
                        >
                            <LucideIcon name="heart" size={20} strokeWidth={1.6} />
                            <span className="atelier-badge">
                                {wishlistIds.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => openDrawer('cart')}
                            className={`icon-btn atelier-header-btn ${
                                activeDrawer === 'cart' ||
                                location.pathname === '/cart'
                                    ? 'is-active'
                                    : ''
                            }`}
                            title="Giỏ hàng"
                            aria-label="Giỏ hàng"
                        >
                            <LucideIcon
                                name="shopping-cart"
                                size={20}
                                strokeWidth={1.6}
                            />
                            <span className="atelier-badge">{cartCount}</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleProfileClick}
                            className={`icon-btn atelier-header-btn ${
                                activeDrawer === 'profile' ? 'is-active' : ''
                            }`}
                            title={
                                currentUser
                                    ? `Tài khoản: ${currentUser.username}`
                                    : 'Đăng nhập'
                            }
                            aria-label={
                                currentUser ? 'Trang cá nhân' : 'Đăng nhập'
                            }
                        >
                            <LucideIcon name="user" size={20} strokeWidth={1.6} />
                        </button>
                    </div>
                </div>

                {/* THANH TÌM KIẾM MỞ RỘNG (Khung vuông góc, xuất hiện khi nhấn icon Tìm kiếm) */}
                {isSearchOpen && (
                    <form
                        onSubmit={handleSearchSubmit}
                        className="atelier-search-bar sharp-frame"
                    >
                        <div className="atelier-search-inner">
                            <LucideIcon
                                name="search"
                                size={16}
                                className="atelier-search-icon"
                            />
                            <input
                                type="text"
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                                placeholder="Tìm kiếm sản phẩm nổi bật, laptop, bàn phím, phụ kiện..."
                                className="atelier-search-input sharp-frame"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="pill-btn atelier-search-submit"
                            >
                                Tìm kiếm
                            </button>
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="pill-btn atelier-search-close"
                            >
                                Đóng
                            </button>
                        </div>
                    </form>
                )}
            </header>

            {/* THÔNG BÁO NHỎ (TOAST) */}
            <div
                className={`atelier-toast pill-btn ${
                    isToastVisible ? 'is-visible' : ''
                }`}
                role="status"
                aria-live="polite"
            >
                {toastMessage}
            </div>

            {isLoginOpen && (
                <LoginModal onClose={() => setIsLoginOpen(false)} />
            )}
        </>
    )
}

export default CustomerHeader
