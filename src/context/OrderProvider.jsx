import { useEffect, useRef, useState } from 'react'
import { OrderContext } from './OrderContext'
import { useAuth } from './AuthContext'
import { useProducts } from './ProductContext'
import { useInventory } from './InventoryContext'
import {
    OrderStatus,
    PaymentResult,
    isCustomerCancellable,
} from '../constants/order'

const STORAGE_KEY = 'multi_warehouse_orders_v1'

function loadSavedOrders() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY)

        if (!raw) {
            return []
        }

        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch (error) {
        console.error('Không thể đọc danh sách đơn hàng từ localStorage:', error)
        return []
    }
}

export default function OrderProvider({ children }) {
    const { currentUser } = useAuth()
    const { products } = useProducts()
    const {
        reserveFromFulfillmentWarehouse,
        releaseOrderStock,
        consumeReservedStock,
        restoreOrderStock,
    } = useInventory()

    const [orders, setOrders] = useState(loadSavedOrders)
    const ordersRef = useRef(orders)

    useEffect(() => {
        ordersRef.current = orders
    }, [orders])

    useEffect(() => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(orders))
        } catch (error) {
            console.error('Không thể lưu danh sách đơn hàng:', error)
        }
    }, [orders])

    function commitOrders(nextOrders) {
        ordersRef.current = nextOrders
        setOrders(nextOrders)
    }

    // Tạo đơn hàng mới từ giỏ hàng hiện tại (UC04: SR-ORD-01..03, BR-01, BR-02).
    // Thực hiện: kiểm tra đầu vào -> chọn 1 kho đủ toàn bộ mặt hàng -> tạm giữ tồn kho -> lưu snapshot sản phẩm.
    function createOrderFromCart(cartItems) {
        if (!currentUser || currentUser.role !== 'CUSTOMER') {
            return {
                ok: false,
                message: 'Chỉ tài khoản khách hàng mới có quyền đặt hàng.',
            }
        }

        if (!Array.isArray(cartItems) || cartItems.length === 0) {
            return {
                ok: false,
                message: 'Giỏ hàng đang trống, không thể tạo đơn hàng.',
            }
        }

        if (cartItems.length > 50) {
            return {
                ok: false,
                message: 'Mỗi đơn hàng chỉ được chứa tối đa 50 dòng sản phẩm.',
            }
        }

        // Gộp các dòng trùng productId (nếu có) trước khi kiểm tra giới hạn số lượng (C07 - order.validator.js)
        const mergedQuantities = new Map()

        for (const item of cartItems) {
            const productId = Number(item?.productId ?? item?.id)
            const quantity = Number(item?.quantity)

            if (!Number.isSafeInteger(productId) || productId < 1) {
                return {
                    ok: false,
                    message: 'Mã sản phẩm trong giỏ hàng không hợp lệ.',
                }
            }

            if (
                !Number.isSafeInteger(quantity) ||
                quantity < 1 ||
                quantity > 100
            ) {
                return {
                    ok: false,
                    message: 'Số lượng mỗi sản phẩm phải là số nguyên từ 1 đến 100.',
                }
            }

            mergedQuantities.set(
                productId,
                (mergedQuantities.get(productId) ?? 0) + quantity
            )
        }

        // Kiểm tra lại sản phẩm, trạng thái kinh doanh, tổng số lượng sau gộp và lấy giá snapshot mới nhất (SR-PROD-03)
        const snapshotItems = []

        for (const [productId, quantity] of mergedQuantities.entries()) {
            const latestProduct = products.find(
                (p) => Number(p.id) === productId
            )

            if (!latestProduct || latestProduct.status === 'DISCONTINUED') {
                return {
                    ok: false,
                    message: `Sản phẩm "${latestProduct?.name || `#${productId}`}" đã ngừng kinh doanh, không thể đặt hàng.`,
                }
            }

            if (quantity > 100) {
                return {
                    ok: false,
                    message: `Tổng số lượng của sản phẩm "${latestProduct.name}" trong một đơn không được vượt quá 100.`,
                }
            }

            const unitPrice = Number(latestProduct.price)

            snapshotItems.push({
                productId,
                productNameSnapshot: latestProduct.name,
                unitPriceSnapshot: unitPrice,
                categorySnapshot: latestProduct.category || '',
                quantity,
                lineTotal: unitPrice * quantity,
            })
        }

        // Chọn duy nhất 1 kho đủ toàn bộ đơn và giữ hàng nguyên tử (BR-01, BR-02)
        const reservationResult = reserveFromFulfillmentWarehouse(snapshotItems)

        if (!reservationResult.ok) {
            return {
                ok: false,
                message:
                    reservationResult.message ||
                    'Không có kho nào đủ hàng cho toàn bộ đơn hàng.',
            }
        }

        const { warehouse } = reservationResult
        const totalAmount = snapshotItems.reduce(
            (sum, item) => sum + item.lineTotal,
            0
        )
        const now = new Date().toISOString()
        let orderId = `ORD-${Date.now()}`
        if (ordersRef.current.some((o) => o.id === orderId)) {
            orderId = `${orderId}-${ordersRef.current.length + 1}`
        }

        const newOrder = {
            id: orderId,
            customerId: currentUser.id,
            customerUsername: currentUser.username,
            fulfillmentWarehouseId: warehouse.id,
            fulfillmentWarehouseName: warehouse.name,
            status: OrderStatus.PENDING_PAYMENT,
            // Đánh dấu đơn đang có hàng được tạm giữ tại kho
            reservationActive: true,
            items: snapshotItems,
            totalAmount,
            paymentAttempts: [],
            createdAt: now,
            updatedAt: now,
            cancelledAt: null,
        }

        commitOrders([newOrder, ...ordersRef.current])

        return {
            ok: true,
            order: newOrder,
        }
    }

    // Xử lý thanh toán giả lập (Mock Payment - UC04: SR-PAY-01..04, SR-INV-03, BR-03, BR-04).
    // Hỗ trợ cả thanh toán lần đầu và thử lại (retry) sau khi lần trước thất bại/không hoàn tất.
    function processMockPayment(orderId, simulateResult = PaymentResult.SUCCESS) {
        if (!currentUser || currentUser.role !== 'CUSTOMER') {
            return {
                ok: false,
                message: 'Vui lòng đăng nhập tài khoản khách hàng để thanh toán.',
            }
        }

        if (!Object.values(PaymentResult).includes(simulateResult)) {
            return {
                ok: false,
                message: 'Chế độ giả lập thanh toán không hợp lệ.',
            }
        }

        const currentOrders = ordersRef.current
        const targetOrder = currentOrders.find(
            (o) => String(o.id) === String(orderId)
        )

        if (!targetOrder) {
            return {
                ok: false,
                message: 'Không tìm thấy đơn hàng.',
            }
        }

        // Kiểm tra quyền sở hữu đơn hàng (SR-AUTH-04)
        if (
            String(targetOrder.customerId) !== String(currentUser.id) &&
            targetOrder.customerUsername !== currentUser.username
        ) {
            return {
                ok: false,
                message: 'Bạn không có quyền thanh toán đơn hàng của người khác.',
            }
        }

        // Chống thanh toán lặp hoặc thanh toán đơn đã hủy (T19)
        if (targetOrder.status !== OrderStatus.PENDING_PAYMENT) {
            return {
                ok: false,
                message: `Đơn hàng đang ở trạng thái "${targetOrder.status}", không thể thực hiện thanh toán.`,
            }
        }

        let activeWarehouseId = targetOrder.fulfillmentWarehouseId
        let activeWarehouseName = targetOrder.fulfillmentWarehouseName

        // Nếu đơn hàng đang ở trạng thái PendingPayment nhưng đã giải phóng hàng giữ trước đó (do thanh toán thất bại/không hoàn tất),
        // khi Retry bắt buộc phải kiểm tra và giữ hàng lại trước khi gọi cổng thanh toán (UC04, T06, T07).
        if (!targetOrder.reservationActive) {
            const reReserve = reserveFromFulfillmentWarehouse(
                targetOrder.items,
                targetOrder.fulfillmentWarehouseId
            )

            if (!reReserve.ok) {
                return {
                    ok: false,
                    message:
                        'Không thể thử lại thanh toán lúc này: Kho không còn đủ tồn khả dụng cho toàn bộ đơn hàng.',
                }
            }

            activeWarehouseId = reReserve.warehouse.id
            activeWarehouseName = reReserve.warehouse.name
        }

        const now = new Date().toISOString()
        const attemptNumber = (targetOrder.paymentAttempts?.length || 0) + 1

        // Trường hợp 1: Thanh toán giả lập THÀNH CÔNG (SR-PAY-03, SR-INV-03, BR-03)
        // Chuyển lượng hàng giữ thành đã bán (onHand - q, reserved - q) và cập nhật trạng thái Paid
        if (simulateResult === PaymentResult.SUCCESS) {
            const consumeResult = consumeReservedStock(
                activeWarehouseId,
                targetOrder.items
            )

            if (!consumeResult.ok) {
                return {
                    ok: false,
                    message:
                        consumeResult.message ||
                        'Lỗi khi khấu trừ tồn kho sau thanh toán.',
                }
            }

            const attempt = {
                attemptNumber,
                result: PaymentResult.SUCCESS,
                createdAt: now,
                note: `Thanh toán thành công. Đã xuất hàng từ ${activeWarehouseName}.`,
            }

            const updatedOrder = {
                ...targetOrder,
                fulfillmentWarehouseId: activeWarehouseId,
                fulfillmentWarehouseName: activeWarehouseName,
                status: OrderStatus.PAID,
                reservationActive: false,
                paymentAttempts: [...(targetOrder.paymentAttempts || []), attempt],
                updatedAt: now,
            }

            commitOrders(
                currentOrders.map((o) =>
                    String(o.id) === String(orderId) ? updatedOrder : o
                )
            )

            return {
                ok: true,
                paymentResult: PaymentResult.SUCCESS,
                order: updatedOrder,
                message: `Thanh toán thành công! Đơn hàng đã chuyển sang trạng thái Đã thanh toán (Paid) và khấu trừ tồn kho tại ${activeWarehouseName}.`,
            }
        }

        // Trường hợp 2: Thanh toán giả lập THẤT BẠI hoặc KHÔNG HOÀN TẤT (SR-PAY-04, BR-04)
        // Giải phóng lượng hàng đang giữ (reserved - q), giữ nguyên trạng thái PendingPayment để khách có thể thử lại (Retry)
        const normalizedResult =
            simulateResult === PaymentResult.INCOMPLETE
                ? PaymentResult.INCOMPLETE
                : PaymentResult.FAILED

        const releaseResult = releaseOrderStock(
            activeWarehouseId,
            targetOrder.items
        )

        if (!releaseResult.ok) {
            return {
                ok: false,
                message:
                    releaseResult.message ||
                    'Không thể giải phóng hàng giữ khi thanh toán thất bại.',
            }
        }

        const attempt = {
            attemptNumber,
            result: normalizedResult,
            createdAt: now,
            note:
                normalizedResult === PaymentResult.INCOMPLETE
                    ? `Phiên thanh toán không hoàn tất (timeout/hủy giữa chừng). Đã giải phóng hàng giữ tại ${activeWarehouseName}.`
                    : `Thanh toán thất bại từ cổng giả lập. Đã giải phóng hàng giữ tại ${activeWarehouseName}.`,
        }

        const updatedOrder = {
            ...targetOrder,
            fulfillmentWarehouseId: activeWarehouseId,
            fulfillmentWarehouseName: activeWarehouseName,
            status: OrderStatus.PENDING_PAYMENT,
            reservationActive: false,
            paymentAttempts: [...(targetOrder.paymentAttempts || []), attempt],
            updatedAt: now,
        }

        commitOrders(
            currentOrders.map((o) =>
                String(o.id) === String(orderId) ? updatedOrder : o
            )
        )

        return {
            ok: true,
            paymentResult: normalizedResult,
            order: updatedOrder,
            message:
                normalizedResult === PaymentResult.INCOMPLETE
                    ? 'Thanh toán chưa hoàn tất. Hệ thống đã giải phóng hàng giữ, đơn hàng vẫn ở trạng thái Chờ thanh toán để bạn có thể thử lại.'
                    : 'Thanh toán thất bại. Hệ thống đã giải phóng hàng giữ, đơn hàng vẫn ở trạng thái Chờ thanh toán để bạn có thể thử lại.',
        }
    }

    // Hủy đơn hàng của khách hàng (UC11: SR-CAN-01..04, BR-05, BR-06).
    // - Nếu đơn đang PendingPayment và còn giữ hàng: giải phóng reserved (reserved - q).
    // - Nếu đơn đã Paid: hoàn trả lại tồn thực tế vào đúng kho đã xuất (onHand + q).
    // - Nếu đơn ở trạng thái Processing / Completed / Cancelled: từ chối hủy.
    function cancelOrder(orderId) {
        if (!currentUser || currentUser.role !== 'CUSTOMER') {
            return {
                ok: false,
                message: 'Chỉ khách hàng mới có quyền hủy đơn hàng của mình.',
            }
        }

        const currentOrders = ordersRef.current
        const targetOrder = currentOrders.find(
            (o) => String(o.id) === String(orderId)
        )

        if (!targetOrder) {
            return {
                ok: false,
                message: 'Không tìm thấy đơn hàng cần hủy.',
            }
        }

        // Kiểm tra quyền sở hữu (SR-AUTH-04, BR-05)
        if (
            String(targetOrder.customerId) !== String(currentUser.id) &&
            targetOrder.customerUsername !== currentUser.username
        ) {
            return {
                ok: false,
                message: 'Bạn không có quyền hủy đơn hàng của khách hàng khác.',
            }
        }

        // Kiểm tra trạng thái được phép hủy (SR-CAN-01, SR-CAN-04)
        if (!isCustomerCancellable(targetOrder.status)) {
            return {
                ok: false,
                message: `Không thể hủy đơn hàng đang ở trạng thái "${targetOrder.status}". Chỉ được hủy đơn khi đang Chờ thanh toán hoặc Đã thanh toán.`,
            }
        }

        let inventoryMessage = 'Không có thay đổi tồn kho vì hàng giữ đã được giải phóng trước đó.'

        if (targetOrder.status === OrderStatus.PENDING_PAYMENT) {
            if (targetOrder.reservationActive) {
                const releaseRes = releaseOrderStock(
                    targetOrder.fulfillmentWarehouseId,
                    targetOrder.items
                )

                if (!releaseRes.ok) {
                    return {
                        ok: false,
                        message:
                            releaseRes.message ||
                            'Không thể giải phóng hàng giữ khi hủy đơn.',
                    }
                }

                inventoryMessage = `Đã giải phóng lượng hàng đang giữ tại ${targetOrder.fulfillmentWarehouseName}.`
            }
        } else if (targetOrder.status === OrderStatus.PAID) {
            const restoreRes = restoreOrderStock(
                targetOrder.fulfillmentWarehouseId,
                targetOrder.items
            )

            if (!restoreRes.ok) {
                return {
                    ok: false,
                    message:
                        restoreRes.message ||
                        'Không thể hoàn trả tồn kho khi hủy đơn đã thanh toán.',
                }
            }

            inventoryMessage = `Đã hoàn trả lại số lượng hàng (onHand) về ${targetOrder.fulfillmentWarehouseName}.`
        }

        const now = new Date().toISOString()
        const updatedOrder = {
            ...targetOrder,
            status: OrderStatus.CANCELLED,
            reservationActive: false,
            updatedAt: now,
            cancelledAt: now,
        }

        commitOrders(
            currentOrders.map((o) =>
                String(o.id) === String(orderId) ? updatedOrder : o
            )
        )

        return {
            ok: true,
            order: updatedOrder,
            message: `Hủy đơn hàng ${targetOrder.id} thành công. ${inventoryMessage}`,
        }
    }

    // Lấy danh sách đơn hàng của tài khoản khách hàng đang đăng nhập (SR-AUTH-04, SR-HIS-01..02)
    function getMyOrders() {
        if (!currentUser) {
            return []
        }

        return orders.filter(
            (order) =>
                String(order.customerId) === String(currentUser.id) ||
                order.customerUsername === currentUser.username
        )
    }

    // Tìm và kiểm tra quyền sở hữu một đơn hàng cụ thể (UC09: SR-TRACK-01..02, SR-AUTH-04)
    function getMyOrderById(orderId) {
        if (!currentUser) {
            return {
                ok: false,
                code: 'UNAUTHENTICATED',
                message: 'Vui lòng đăng nhập để xem đơn hàng.',
            }
        }

        const targetOrder = orders.find(
            (order) => String(order.id) === String(orderId)
        )

        if (!targetOrder) {
            return {
                ok: false,
                code: 'NOT_FOUND',
                message: `Không tìm thấy đơn hàng với mã "${orderId}".`,
            }
        }

        if (
            String(targetOrder.customerId) !== String(currentUser.id) &&
            targetOrder.customerUsername !== currentUser.username
        ) {
            return {
                ok: false,
                code: 'FORBIDDEN',
                message: 'Bạn không có quyền xem hoặc thao tác trên đơn hàng của khách hàng khác.',
            }
        }

        return {
            ok: true,
            order: targetOrder,
        }
    }

    return (
        <OrderContext.Provider
            value={{
                orders,
                createOrderFromCart,
                processMockPayment,
                cancelOrder,
                getMyOrders,
                getMyOrderById,
            }}
        >
            {children}
        </OrderContext.Provider>
    )
}
