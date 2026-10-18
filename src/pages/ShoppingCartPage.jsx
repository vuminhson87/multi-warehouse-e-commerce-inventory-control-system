import { useNavigate } from 'react-router-dom'
import { useCart } from '../context/CartContext'
import './ShoppingCartPage.css'
import CustomerHeader from '../components/CustomerHeader'

function ShoppingCartPage() {
    const {
        cartItems,
        increaseQuantity,
        decreaseQuantity,
        removeFromCart,
        fulfillmentWarehouse,
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
    const hasInvalidItems =
        hasDiscontinuedItems ||
        hasInsufficientStockItems ||
        isOrderUnfulfillable

    return (
        <>
            <CustomerHeader />
            <div className="cart-page">
                <h1>Shopping Cart</h1>

                {cartItems.length === 0 ? (
                    <p>Giỏ hàng đang trống.</p>
                ) : (
                    <div>
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
                                                color: '#dc2626',
                                                fontSize: '0.85rem',
                                                marginLeft: '10px',
                                            }}
                                        >
                                            [Đã hết hàng]
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
                                                [Tồn khả dụng chỉ còn {item.availableStock}]
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
                                            item.quantity >= item.availableStock ||
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

                        <h2>
                            Tổng tiền: {totalPrice.toLocaleString('vi-VN')} VNĐ
                        </h2>

                        {hasDiscontinuedItems && (
                            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
                                Có sản phẩm đã ngừng kinh doanh trong giỏ hàng.
                                Vui lòng xóa trước khi tiến hành thanh toán.
                            </p>
                        )}

                        {hasInsufficientStockItems && (
                            <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
                                Có sản phẩm không đủ tồn kho hoặc đã hết hàng.
                                Vui lòng điều chỉnh lại số lượng hoặc xóa khỏi
                                giỏ trước khi thanh toán.
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
                                    ✓ Đơn hàng sẽ được xuất từ:{' '}
                                    <strong>{fulfillmentWarehouse.name}</strong>{' '}
                                    (Kho đáp ứng toàn bộ mặt hàng theo quy định)
                                </p>
                            </div>
                        )}

                        {isOrderUnfulfillable && (
                            <div
                                style={{
                                    background: '#fef2f2',
                                    border: '1px solid #fca5a5',
                                    padding: '12px 16px',
                                    borderRadius: '6px',
                                    margin: '15px 0',
                                }}
                            >
                                <p
                                    style={{
                                        color: '#991b1b',
                                        fontWeight: 'bold',
                                        margin: 0,
                                    }}
                                >
                                    ⚠️ Không có kho hàng nào đáp ứng đủ toàn bộ
                                    đơn hàng!
                                </p>
                                <p
                                    style={{
                                        color: '#7f1d1d',
                                        margin: '6px 0 0',
                                        fontSize: '0.9rem',
                                    }}
                                >
                                    Quy tắc hệ thống yêu cầu một kho phải giao
                                    toàn bộ đơn hàng (Single-Warehouse
                                    Fulfillment). Hiện không có kho nào có đủ số
                                    lượng của tất cả sản phẩm bạn chọn. Vui lòng
                                    giảm số lượng.
                                </p>
                            </div>
                        )}

                        <button
                            disabled={hasInvalidItems}
                            onClick={() => navigate('/checkout')}
                        >
                            Tiến hành thanh toán
                        </button>
                    </div>
                )}
            </div>
        </>
    )
}

export default ShoppingCartPage