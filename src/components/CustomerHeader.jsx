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
import RegisterModal from './RegisterModal'
import VoucherWalletModal from './VoucherWalletModal'
import ProductSearchInput from './ProductSearchInput'
import { changePasswordApi, updateProfileApi } from '../services/authApi'

const ROLE_LABELS = {
    CUSTOMER: 'Khách hàng thành viên',
    WAREHOUSE_MANAGER: 'Quản lý kho',
    ADMIN: 'Quản trị hệ thống',
}

const CATEGORY_ICON_RULES = [
    { keywords: ['laptop', 'máy tính'], icon: 'laptop' },
    { keywords: ['điện thoại', 'phone', 'smartphone'], icon: 'smartphone' },
    { keywords: ['màn hình', 'monitor', 'display'], icon: 'monitor' },
    { keywords: ['âm thanh', 'loa', 'tai nghe', 'audio'], icon: 'headphones' },
    { keywords: ['phụ kiện', 'bàn phím', 'chuột', 'sạc'], icon: 'keyboard' },
]

function getCategoryIconName(category) {
    const normalized = String(category || '').trim().toLowerCase()
    const matched = CATEGORY_ICON_RULES.find((rule) =>
        rule.keywords.some((keyword) => normalized.includes(keyword))
    )
    return matched ? matched.icon : 'layout-grid'
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
    const { currentUser, token, setCurrentUser, logout } = useAuth()
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
    const [isVoucherModalOpen, setIsVoucherModalOpen] = useState(false)
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [searchText, setSearchText] = useState('')
    const [isLoginOpen, setIsLoginOpen] = useState(false)
    const [profileSection, setProfileSection] = useState(null) // null | 'profile' | 'password'
    const [profileNameInput, setProfileNameInput] = useState('')
    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    })
    const [profileBusy, setProfileBusy] = useState(false)
    const [profileFeedback, setProfileFeedback] = useState(null)
    const [isRegisterOpen, setIsRegisterOpen] = useState(false)
    const [registeredUsername, setRegisteredUsername] = useState('')
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

    function handleSearchQuerySubmit(rawQuery) {
        const trimmed = String(rawQuery ?? searchText).trim()
        closeAllDrawers()
        setIsSearchOpen(false)
        if (trimmed) {
            navigate(`/products?search=${encodeURIComponent(trimmed)}`)
        } else {
            navigate('/products')
        }
    }

    function handleSelectSuggestedProduct(product) {
        closeAllDrawers()
        setIsSearchOpen(false)
        setSearchText('')
        navigate(`/products/${product.id}`)
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
                                onClick={() => handleNavigateAndClose('/contact')}
                                className={`atelier-dash-link ch-menu-link ${
                                    location.pathname === '/contact' ? 'is-active' : ''
                                }`}
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="phone" size={20} strokeWidth={1.75} />
                                    <span>Liên hệ</span>
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => {
                                    closeAllDrawers()
                                    setIsVoucherModalOpen(true)
                                }}
                                className="atelier-dash-link ch-menu-link"
                            >
                                <span className="atelier-dash-link-left">
                                    <LucideIcon name="ticket" size={20} strokeWidth={1.75} />
                                    <span>Mã giảm giá</span>
                                </span>
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
                            {Object.entries(categoryCounts).map(([cat, count]) => {
                                const activeCategory =
                                    location.pathname === '/products' &&
                                    new URLSearchParams(location.search).get('category') === cat
                                return (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() =>
                                            handleNavigateAndClose(
                                                `/products?category=${encodeURIComponent(cat)}`
                                            )
                                        }
                                        className={`atelier-dash-link ch-menu-link ${
                                            activeCategory ? 'is-active' : ''
                                        }`}
                                    >
                                        <span className="atelier-dash-link-left">
                                            <LucideIcon
                                                name={getCategoryIconName(cat)}
                                                size={18}
                                                strokeWidth={1.75}
                                            />
                                            <span>{cat}</span>
                                        </span>
                                        <span className="atelier-dash-count">{count}</span>
                                    </button>
                                )
                            })}
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
                                {currentUser.email && (
                                    <div className="atelier-profile-row">
                                        <span style={{ color: '#71717a' }}>Gmail xác thực:</span>
                                        <strong>{currentUser.email}</strong>
                                    </div>
                                )}
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

                            <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                                <button
                                    type="button"
                                    className="atelier-btn-outline"
                                    style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                                    onClick={() => {
                                        setProfileFeedback(null)
                                        setProfileNameInput(currentUser.fullName || '')
                                        setProfileSection((prev) => (prev === 'profile' ? null : 'profile'))
                                    }}
                                >
                                    Đổi họ tên
                                </button>
                                <button
                                    type="button"
                                    className="atelier-btn-outline"
                                    style={{ flex: 1, padding: '8px 10px', fontSize: '12px' }}
                                    onClick={() => {
                                        setProfileFeedback(null)
                                        setPasswordForm({
                                            currentPassword: '',
                                            newPassword: '',
                                            confirmPassword: '',
                                        })
                                        setProfileSection((prev) => (prev === 'password' ? null : 'password'))
                                    }}
                                >
                                    Đổi mật khẩu
                                </button>
                            </div>

                            {profileSection === 'profile' && (
                                <form
                                    style={{ display: 'grid', gap: '10px', marginTop: '14px' }}
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        if (profileBusy || !token) return
                                        setProfileBusy(true)
                                        setProfileFeedback(null)
                                        try {
                                            const res = await updateProfileApi(token, {
                                                fullName: profileNameInput.trim() || null,
                                            })
                                            if (res?.user) setCurrentUser(res.user)
                                            setProfileSection(null)
                                            showToast('Đã cập nhật họ tên')
                                        } catch (err) {
                                            setProfileFeedback({
                                                error: true,
                                                text: err.message || 'Không thể cập nhật họ tên.',
                                            })
                                        } finally {
                                            setProfileBusy(false)
                                        }
                                    }}
                                >
                                    <input
                                        type="text"
                                        maxLength={120}
                                        placeholder="Nhập họ và tên mới"
                                        value={profileNameInput}
                                        onChange={(e) => setProfileNameInput(e.target.value)}
                                        style={{
                                            padding: '10px 12px',
                                            border: '1px solid #d4d4d8',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        className="atelier-btn-solid"
                                        disabled={profileBusy}
                                        style={{ padding: '10px', fontSize: '12px' }}
                                    >
                                        {profileBusy ? 'Đang lưu…' : 'Lưu họ tên'}
                                    </button>
                                </form>
                            )}

                            {profileSection === 'password' && (
                                <form
                                    style={{ display: 'grid', gap: '10px', marginTop: '14px' }}
                                    onSubmit={async (event) => {
                                        event.preventDefault()
                                        if (profileBusy || !token) return
                                        if (passwordForm.newPassword.length < 8) {
                                            setProfileFeedback({
                                                error: true,
                                                text: 'Mật khẩu mới phải có ít nhất 8 ký tự.',
                                            })
                                            return
                                        }
                                        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                                            setProfileFeedback({
                                                error: true,
                                                text: 'Mật khẩu xác nhận không khớp.',
                                            })
                                            return
                                        }
                                        setProfileBusy(true)
                                        setProfileFeedback(null)
                                        try {
                                            await changePasswordApi(token, {
                                                currentPassword: passwordForm.currentPassword,
                                                newPassword: passwordForm.newPassword,
                                            })
                                            setProfileSection(null)
                                            showToast('Đã đổi mật khẩu thành công')
                                        } catch (err) {
                                            setProfileFeedback({
                                                error: true,
                                                text: err.message || 'Không thể đổi mật khẩu.',
                                            })
                                        } finally {
                                            setProfileBusy(false)
                                        }
                                    }}
                                >
                                    <input
                                        type="password"
                                        required
                                        placeholder="Mật khẩu hiện tại"
                                        value={passwordForm.currentPassword}
                                        onChange={(e) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                currentPassword: e.target.value,
                                            }))
                                        }
                                        style={{
                                            padding: '10px 12px',
                                            border: '1px solid #d4d4d8',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        maxLength={72}
                                        placeholder="Mật khẩu mới (ít nhất 8 ký tự)"
                                        value={passwordForm.newPassword}
                                        onChange={(e) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                newPassword: e.target.value,
                                            }))
                                        }
                                        style={{
                                            padding: '10px 12px',
                                            border: '1px solid #d4d4d8',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <input
                                        type="password"
                                        required
                                        minLength={8}
                                        maxLength={72}
                                        placeholder="Nhập lại mật khẩu mới"
                                        value={passwordForm.confirmPassword}
                                        onChange={(e) =>
                                            setPasswordForm((prev) => ({
                                                ...prev,
                                                confirmPassword: e.target.value,
                                            }))
                                        }
                                        style={{
                                            padding: '10px 12px',
                                            border: '1px solid #d4d4d8',
                                            fontSize: '13px',
                                        }}
                                    />
                                    <button
                                        type="submit"
                                        className="atelier-btn-solid"
                                        disabled={profileBusy}
                                        style={{ padding: '10px', fontSize: '12px' }}
                                    >
                                        {profileBusy ? 'Đang cập nhật…' : 'Xác nhận đổi mật khẩu'}
                                    </button>
                                </form>
                            )}

                            {profileFeedback && (
                                <p
                                    role={profileFeedback.error ? 'alert' : 'status'}
                                    style={{
                                        margin: '10px 0 0',
                                        fontSize: '12px',
                                        color: profileFeedback.error ? '#b91c1c' : '#166534',
                                    }}
                                >
                                    {profileFeedback.text}
                                </p>
                            )}
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
                    <div className="ch-brand-group">
                        <button
                            ref={menuBtnRef}
                            type="button"
                            onClick={() => openDrawer('dashboard')}
                            className="icon-btn ch-menu"
                            title="Mở menu điều hướng"
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
                    </div>

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
                        <Link
                            to="/contact"
                            onClick={closeAllDrawers}
                            className={`ch-nav__link ${
                                location.pathname === '/contact' ? 'is-active' : ''
                            }`}
                        >
                            <LucideIcon name="phone" size={19} strokeWidth={1.75} />
                            <span>Liên hệ</span>
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

                    <ProductSearchInput
                        className="ch-search"
                        value={searchText}
                        onChange={setSearchText}
                        onSubmitQuery={handleSearchQuerySubmit}
                        onSelectProduct={handleSelectSuggestedProduct}
                        iconClassName="ch-search__icon"
                    />

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
                    <ProductSearchInput
                        className="ch-search-bar"
                        value={searchText}
                        onChange={setSearchText}
                        onSubmitQuery={handleSearchQuerySubmit}
                        onSelectProduct={handleSelectSuggestedProduct}
                        iconClassName="ch-search__icon"
                        autoFocus
                        trailingAction={
                            <button
                                type="button"
                                onClick={handleClearSearch}
                                className="ch-search-bar__close"
                            >
                                Đóng
                            </button>
                        }
                    />
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

            {isVoucherModalOpen && (
                <VoucherWalletModal
                    onClose={() => setIsVoucherModalOpen(false)}
                    onRequireLogin={() => setIsLoginOpen(true)}
                />
            )}

            {isLoginOpen && (
                <LoginModal
                    onClose={() => setIsLoginOpen(false)}
                    initialUsername={registeredUsername}
                    registered={Boolean(registeredUsername)}
                    onRegister={() => {
                        setRegisteredUsername('')
                        setIsLoginOpen(false)
                        setIsRegisterOpen(true)
                    }}
                />
            )}

            {isRegisterOpen && (
                <RegisterModal
                    onClose={() => setIsRegisterOpen(false)}
                    onSwitchToLogin={() => {
                        setIsRegisterOpen(false)
                        setIsLoginOpen(true)
                    }}
                    onSuccess={username => {
                        setRegisteredUsername(username)
                        setIsRegisterOpen(false)
                        setIsLoginOpen(true)
                    }}
                />
            )}
        </>
    )
}

export default CustomerHeader
