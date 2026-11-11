import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import './ShoppingCartPage.css'

function ShoppingCartPage() {
    const {
        cartItems,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        fulfillmentWarehouse,
        stockLoading,
        stockError,
    } = useCart()

    const navigate = useNavigate()
    const totalPrice = cartItems.reduce(
        (total, item) => total + item.price * item.quantity,
        0
    )

    const hasDiscontinuedItems = cartItems.some((item) => item.isDiscontinued)
    const hasInsufficientStockItems = cartItems.some(
        (item) => item.isOutOfStock || item.isInsufficientStock
    )
    const isOrderUnfulfillable =
        cartItems.length > 0 && !fulfillmentWarehouse

    return (
        <>
            <div className="cart-page">
                <h1>Giỏ hàng của bạn</h1>

                {cartItems.length === 0 ? (
                    <div className="cart-empty">
                        <div className="cart-empty-icon">
                            <svg
                                width="64"
                                height="64"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                            >
                                <circle cx="9" cy="21" r="1" />
                                <circle cx="20" cy="21" r="1" />
                                <path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" />
                            </svg>
                        </div>

                        <h2>Giỏ hàng của bạn đang trống</h2>

                        <p>
                            Bạn chưa thêm sản phẩm nào vào giỏ hàng.
                            Hãy khám phá những sản phẩm công nghệ phù hợp với bạn nhé!
                        </p>

                        <button
                            className="cart-empty-button"
                            onClick={() => navigate('/products')}
                        >
                            Khám phá sản phẩm →
                        </button>
                    </div>
                ) : (
                    <div className="cart-layout">
                        <div className="cart-items">
                            {cartItems.map((item) => (
                                <div key={item.id} style={{ marginBottom: '20px' }}>
                                    <h2>
                                        {item.name}
                                        {item.isDiscontinued && (
                                            <span
                                                style={{
                                                    color: '#dc2626',
                                                    fontSize: '0.85rem',
                                                    marginLeft: '10px',
                                                }}
                                            >
                                                [Đã ngừng kinh doanh]
                                            </span>
                                        )}
                                        {!item.isDiscontinued && item.isOutOfStock && (
                                            <span
                                                style={{
                                                    color: '#b45309',
                                                    fontSize: '0.85rem',
                                                    marginLeft: '10px',
                                                }}
                                            >
                                                [Hết hàng theo dữ liệu máy chủ]
                                            </span>
                                        )}
                                        {!item.isDiscontinued &&
                                            !item.isOutOfStock &&
                                            item.isInsufficientStock && (
                                                <span
                                                    style={{
                                                        color: '#b45309',
                                                        fontSize: '0.85rem',
                                                        marginLeft: '10px',
                                                    }}
                                                >
                                                    [Tồn khả dụng tại một kho chỉ còn {item.availableStock}]
                                                </span>
                                            )}
                                    </h2>

                                    <p>
                                        Giá: {item.price.toLocaleString('vi-VN')} VNĐ
                                    </p>

                                    <div>
                                        <button onClick={() => decreaseQuantity(item.id)}>
                                            -
                                        </button>

                                        <span> Số lượng: {item.quantity} </span>

                                        <button
                                            disabled={
                                                item.isDiscontinued ||
                                                stockLoading ||
                                                Boolean(stockError) ||
                                                item.quantity >= 100
                                            }
                                            onClick={() => increaseQuantity(item.id)}
                                        >
                                            +
                                        </button>
                                        <button onClick={() => removeFromCart(item.id)}>
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="cart-summary">
                            <h2>Tóm tắt đơn hàng</h2>

                            <div className="cart-summary-products">
                                {cartItems.map((item) => (
                                    <div className="cart-summary-product" key={item.id}>
                                        <div>
                                            <strong>{item.name}</strong>
                                            <p>Số lượng: {item.quantity}</p>
                                        </div>

                                        <span>
                                            {(item.price * item.quantity).toLocaleString('vi-VN')} VNĐ
                                        </span>
                                    </div>
                                ))}
                            </div>

                            <p className="cart-summary-total">
                                Tổng tạm tính: {totalPrice.toLocaleString('vi-VN')} VNĐ
                            </p>

                            {stockLoading && <p role="status">Đang tải tồn kho khả dụng từ máy chủ…</p>}
                            {stockError && <p role="alert">Không thể tải tồn kho. Hãy thử tải lại trang trước khi đặt hàng.</p>}

                            {hasDiscontinuedItems && (
                                <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
                                    Có sản phẩm đã ngừng kinh doanh trong giỏ hàng.
                                    Vui lòng xóa trước khi tiến hành thanh toán.
                                </p>
                            )}

                            {!stockLoading && !stockError && hasInsufficientStockItems && (
                                <p style={{ color: '#b45309', fontWeight: 'bold' }}>
                                    Tồn kho máy chủ hiện không đủ cho số lượng trong giỏ.
                                    Hãy giảm số lượng hoặc xóa sản phẩm trước khi thanh toán.
                                </p>
                            )}

                            {fulfillmentWarehouse && (
                                <div
                                    style={{
                                        background: '#f0fdf4',
                                        border: '1px solid #86efac',
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        margin: '15px 0',
                                    }}
                                >
                                    <p
                                        style={{
                                            color: '#166534',
                                            margin: 0,
                                            fontWeight: '500',
                                        }}
                                    >
                                        ✓ Dự kiến kho xuất hàng:{' '}
                                        <strong>{fulfillmentWarehouse.name}</strong>{' '}
                                        (hệ thống sẽ xác nhận khi đặt hàng)
                                    </p>
                                </div>
                            )}

                            {!stockLoading && !stockError && isOrderUnfulfillable && (
                                <div
                                    style={{
                                        background: '#fffbeb',
                                        border: '1px solid #fcd34d',
                                        padding: '12px 16px',
                                        borderRadius: '6px',
                                        margin: '15px 0',
                                    }}
                                >
                                    <p
                                        style={{
                                            color: '#92400e',
                                            fontWeight: 'bold',
                                            margin: 0,
                                        }}
                                    >
                                        Không có kho nào đủ hàng cho toàn bộ giỏ
                                    </p>
                                    <p
                                        style={{
                                            color: '#78350f',
                                            margin: '6px 0 0',
                                            fontSize: '0.9rem',
                                        }}
                                    >
                                        Không có kho nào hiện đáp ứng đủ tất cả mặt hàng trong giỏ.
                                        Hãy điều chỉnh số lượng hoặc sản phẩm trước khi thanh toán.
                                    </p>
                                </div>
                            )}

                            <button
                                disabled={hasDiscontinuedItems || stockLoading || Boolean(stockError) || hasInsufficientStockItems || isOrderUnfulfillable}
                                onClick={() => navigate('/checkout')}
                            >
                                Tiến hành thanh toán
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}

export default ShoppingCartPage
