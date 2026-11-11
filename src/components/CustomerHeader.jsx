import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import './CustomerHeader.css'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'
import { useProducts } from '../context/ProductContext'
import { useWishlist } from '../context/WishlistContext'
import { getProductVisual } from '../utils/productVisuals'
import { handleImageError } from '../utils/format'
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
    const menuBtnRef = useRef(null)
    const drawerCloseBtnRef = useRef(null)

    const cartCount = cartItems.reduce((total, item) => total + item.quantity, 0)

    // Escape đóng ngăn kéo; khóa cuộn nền khi ngăn kéo đang mở; quản lý focus.
    useEffect(() => {
        if (!activeDrawer) return undefined

        if (activeDrawer === 'dashboard') {
            drawerCloseBtnRef.current?.focus()
        }

        const onKeyDown = (event) => {
            if (event.key === 'Escape') {
                const wasDashboard = activeDrawer === 'dashboard'
                setActiveDrawer(null)
                setIsDrawerOpen(false)
                if (wasDashboard) {
                    menuBtnRef.current?.focus()
                }
            }
        }
        window.addEventListener('keydown', onKeyDown)
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        return () => {
            window.removeEventListener('keydown', onKeyDown)
            document.body.style.overflow = previousOverflow
        }
    }, [activeDrawer, setIsDrawerOpen])

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
        const available = Number(product.maxAvailable ?? 0)
        if (available <= 0) {
            showToast(`"${product.name}" hiện đã hết hàng`)
            return
        }
        const inCart = cartItems.find(
            (item) => Number(item.productId ?? item.id) === Number(product.id)
        )
        const currentQty = inCart ? inCart.quantity : 0
        addToCart(product, 1, { warehouseStock: available })
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
            {/* LỚP PHỦ XÁM & MỜ KHI MỞ MENU HOẶC NGĂN KÉO */}
            <div
                className={`atelier-backdrop ${activeDrawer ? 'is-open' : ''}`}
                onClick={() => {
                    const wasDashboard = activeDrawer === 'dashboard'
                    closeAllDrawers()
                    if (wasDashboard) {
                        menuBtnRef.current?.focus()
                    }
                }}
                aria-hidden="true"
            />

            {/* ===================================================================== */}
            {/* MENU DRAWER BÊN TRÁI (THEO REF-02)                                     */}
            {/* ===================================================================== */}
            <aside
                className={`atelier-dashboard-drawer ch-menu-drawer ${
                    activeDrawer === 'dashboard' ? 'is-open' : ''
                }`}
                aria-label="Menu điều hướng"
                inert={activeDrawer !== 'dashboard'}
            >
                <div>
                    <div className="atelier-drawer-header">
                        <span className="ch-drawer-title">Menu</span>
                        <button
                            ref={drawerCloseBtnRef}
                            type="button"
                            onClick={() => {
                                closeAllDrawers()
                                menuBtnRef.current?.focus()
                            }}
                            className="icon-btn atelier-header-btn"
                            title="Đóng menu"
                            aria-label="Đóng menu"
                        >
                            <LucideIcon name="x" size={20} strokeWidth={1.75} />
                        </button>
                    </div>

                    <div className="atelier-dash-section">
                        <nav className="atelier-dash-nav" aria-label="Menu khách hàng">
                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/')}
                                className={`atelier-dash-link ch-menu-link ${
                                    location.pathname === '/' ? 'is-active' : ''
                                }`}
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="home" size={20} strokeWidth={1.75} />
                                    <span>Trang chủ</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/products')}
                                className={`atelier-dash-link ch-menu-link ${
                                    location.pathname === '/products' && !location.search
                                        ? 'is-active'
                                        : ''
                                }`}
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="package" size={20} strokeWidth={1.75} />
                                    <span>Sản phẩm</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => handleNavigateAndClose('/cart')}
                                className={`atelier-dash-link ch-menu-link ${
                                    location.pathname === '/cart' ? 'is-active' : ''
                                }`}
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="shopping-cart" size={20} strokeWidth={1.75} />
                                    <span>Giỏ hàng</span>
                                </span>
                                {cartCount > 0 && (
                                    <span className="atelier-dash-tag">{cartCount}</span>
                                )}
                            </button>

                            <button
                                type="button"
                                onClick={() => openDrawer('wishlist')}
                                className="atelier-dash-link ch-menu-link"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="heart" size={20} strokeWidth={1.75} />
                                    <span>Yêu thích</span>
                                </span>
                                {wishlistIds.length > 0 && (
                                    <span className="atelier-dash-count">
                                        {wishlistIds.length}
                                    </span>
                                )}
                            </button>

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
                                className={`atelier-dash-link ch-menu-link ${
                                    location.pathname.startsWith('/orders')
                                        ? 'is-active'
                                        : ''
                                }`}
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="file-text" size={20} strokeWidth={1.75} />
                                    <span>Đơn hàng</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={handleProfileClick}
                                className="atelier-dash-link ch-menu-link"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="user" size={20} strokeWidth={1.75} />
                                    <span>Tài khoản</span>
                                </span>
                            </button>
                        </nav>

                        <div className="atelier-dash-divider" />

                        <p className="atelier-dash-heading">Danh mục</p>
                        <div className="atelier-dash-nav">
                            {Object.entries(categoryCounts).map(([cat, count]) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() =>
                                        handleNavigateAndClose(
                                            `/products?category=${encodeURIComponent(cat)}`
                                        )
                                    }
                                    className="atelier-dash-link ch-menu-link"
                                >
                                    <span className="atelier-dash-link-left">
                                        <LucideIcon
                                            name="layout-grid"
                                            size={18}
                                            strokeWidth={1.75}
                                        />
                                        <span>{cat}</span>
                                    </span>
                                    <span className="atelier-dash-count">{count}</span>
                                </button>
                            ))}
                        </div>

                        {(currentUser?.role === 'ADMIN' ||
                            currentUser?.role === 'WAREHOUSE_MANAGER') && (
                            <>
                                <div className="atelier-dash-divider" />
                                <p className="atelier-dash-heading">
                                    Khu vực quản lý
                                </p>
                                <nav className="atelier-dash-nav">
                                    {currentUser.role === 'ADMIN' && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleNavigateAndClose('/admin')
                                            }
                                            className="atelier-dash-link ch-menu-link"
                                        >
                                            <span className="atelier-dash-link-left">
                                                <LucideIcon
                                                    name="shield"
                                                    size={18}
                                                    strokeWidth={1.75}
                                                />
                                                <span>Quản trị hệ thống</span>
                                            </span>
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleNavigateAndClose('/inventory')
                                        }
                                        className="atelier-dash-link ch-menu-link"
                                    >
                                        <span className="atelier-dash-link-left">
                                            <LucideIcon
                                                name="warehouse"
                                                size={18}
                                                strokeWidth={1.75}
                                            />
                                            <span>Quản lý tồn kho</span>
                                        </span>
                                    </button>
                                </nav>
                            </>
                        )}
                    </div>
                </div>

                <div className="atelier-dash-footer">
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
                                        : 'Chưa đăng nhập'}
                                </p>
                            </div>
                        </div>
                    </div>
                    {currentUser ? (
                        <button
                            type="button"
                            onClick={handleLogout}
                            className="atelier-dash-footer-btn"
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
                            className="atelier-dash-footer-btn"
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
                inert={!activeDrawer || activeDrawer === 'dashboard'}
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
                    {activeDrawer === 'cart' &&
                        (cartItems.length === 0 ? (
                            <div className="atelier-side-empty">
                                Giỏ hàng của bạn đang trống.
                            </div>
                        ) : (
                            cartItems.map((item) => {
                                const visual = getProductVisual(item)
                                const maxStock = item.availableStock
                                return (
                                    <div key={item.id} className="atelier-drawer-item">
                                        <img
                                            src={visual.image}
                                            alt={item.name}
                                            className="atelier-drawer-item-img sharp-frame"
                                            onError={handleImageError}
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
                                            onError={handleImageError}
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
                                Mở Menu điều hướng
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
            <header className="ch-header">
                <div className="ch-inner">
                    <button
                        ref={menuBtnRef}
                        type="button"
                        onClick={() => openDrawer('dashboard')}
                        className="icon-btn ch-menu"
                        aria-label="Mở menu"
                        aria-expanded={activeDrawer === 'dashboard'}
                    >
                        <LucideIcon name="menu" size={22} strokeWidth={1.75} />
                    </button>

                    <Link
                        to="/"
                        onClick={closeAllDrawers}
                        className="ch-brand"
                    >
                        Multi-Warehouse
                    </Link>

                    <nav className="ch-nav" aria-label="Điều hướng chính">
                        <Link
                            to="/"
                            onClick={closeAllDrawers}
                            className={`ch-nav__link ${
                                location.pathname === '/' ? 'is-active' : ''
                            }`}
                        >
                            <LucideIcon name="home" size={20} strokeWidth={1.75} />
                            <span>Trang chủ</span>
                        </Link>
                        <Link
                            to="/products"
                            onClick={closeAllDrawers}
                            className={`ch-nav__link ${
                                location.pathname.startsWith('/products')
                                    ? 'is-active'
                                    : ''
                            }`}
                        >
                            <LucideIcon name="package" size={20} strokeWidth={1.75} />
                            <span>Sản phẩm</span>
                        </Link>
                        {(currentUser?.role === 'ADMIN' ||
                            currentUser?.role === 'WAREHOUSE_MANAGER') && (
                            <Link
                                to={
                                    currentUser.role === 'ADMIN'
                                        ? '/admin'
                                        : '/inventory'
                                }
                                onClick={closeAllDrawers}
                                className="ch-nav__link"
                            >
                                <LucideIcon
                                    name="dashboard"
                                    size={20}
                                    strokeWidth={1.75}
                                />
                                <span>Quản lý</span>
                            </Link>
                        )}
                    </nav>

                    <form
                        className="ch-search"
                        onSubmit={handleSearchSubmit}
                        role="search"
                    >
                        <LucideIcon
                            name="search"
                            size={18}
                            className="ch-search__icon"
                        />
                        <input
                            type="search"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm kiếm sản phẩm..."
                            aria-label="Tìm kiếm sản phẩm"
                        />
                    </form>

                    <div className="ch-actions">
                        <button
                            type="button"
                            onClick={() => setIsSearchOpen((prev) => !prev)}
                            className={`ch-action ch-action--search ${
                                isSearchOpen ? 'is-active' : ''
                            }`}
                            aria-label="Tìm kiếm sản phẩm"
                            aria-expanded={isSearchOpen}
                        >
                            <span className="ch-action__icon">
                                <LucideIcon name="search" size={22} strokeWidth={1.75} />
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => openDrawer('wishlist')}
                            className={`ch-action ${
                                activeDrawer === 'wishlist' ? 'is-active' : ''
                            }`}
                            aria-label={`Yêu thích (${wishlistIds.length})`}
                        >
                            <span className="ch-action__icon">
                                <LucideIcon name="heart" size={22} strokeWidth={1.75} />
                                {wishlistIds.length > 0 && (
                                    <span className="ch-badge">
                                        {wishlistIds.length}
                                    </span>
                                )}
                            </span>
                            <span className="ch-action__label">Yêu thích</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => openDrawer('cart')}
                            className={`ch-action ${
                                activeDrawer === 'cart' ||
                                location.pathname === '/cart'
                                    ? 'is-active'
                                    : ''
                            }`}
                            aria-label={`Giỏ hàng (${cartCount})`}
                        >
                            <span className="ch-action__icon">
                                <LucideIcon
                                    name="shopping-cart"
                                    size={22}
                                    strokeWidth={1.75}
                                />
                                {cartCount > 0 && (
                                    <span className="ch-badge ch-badge--cart">
                                        {cartCount}
                                    </span>
                                )}
                            </span>
                            <span className="ch-action__label">Giỏ hàng</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleProfileClick}
                            className={`ch-action ${
                                activeDrawer === 'profile' ? 'is-active' : ''
                            }`}
                            aria-label={
                                currentUser
                                    ? `Tài khoản: ${currentUser.username}`
                                    : 'Đăng nhập'
                            }
                        >
                            <span className="ch-action__icon">
                                <LucideIcon name="user" size={22} strokeWidth={1.75} />
                            </span>
                            <span className="ch-action__label">
                                {currentUser ? 'Tài khoản' : 'Đăng nhập'}
                            </span>
                        </button>
                    </div>
                </div>

                {isSearchOpen && (
                    <form
                        onSubmit={handleSearchSubmit}
                        className="ch-search-bar"
                        role="search"
                    >
                        <LucideIcon
                            name="search"
                            size={18}
                            className="ch-search__icon"
                        />
                        <input
                            type="search"
                            value={searchText}
                            onChange={(e) => setSearchText(e.target.value)}
                            placeholder="Tìm kiếm sản phẩm..."
                            aria-label="Tìm kiếm sản phẩm"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={handleClearSearch}
                            className="ch-search-bar__close"
                        >
                            Đóng
                        </button>
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
