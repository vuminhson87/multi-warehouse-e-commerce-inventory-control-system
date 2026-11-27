// Hằng số và quy tắc trạng thái của module Order (SRS BR-11; contract mục 3).

export const OrderStatus = Object.freeze({
    PENDING_PAYMENT: 'PendingPayment',
    PAID: 'Paid',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
})

export const ReservationStatus = Object.freeze({
    ACTIVE: 'ACTIVE',
    CONSUMED: 'CONSUMED',
    RELEASED: 'RELEASED',
    EXPIRED: 'EXPIRED',
})

export const PaymentAttemptStatus = Object.freeze({
    PENDING: 'PENDING',
    SUCCEEDED: 'SUCCEEDED',
    FAILED: 'FAILED',
    INCOMPLETE: 'INCOMPLETE',
})

// Kết quả hiển thị ra API; null khi attempt còn PENDING.
export const PaymentResult = Object.freeze({
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    INCOMPLETE: 'INCOMPLETE',
})

export const SimulateMode = Object.freeze({
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    INCOMPLETE: 'INCOMPLETE',
})

export const IdempotencyOperation = Object.freeze({
    CREATE_ORDER: 'CREATE_ORDER',
    PAY_ORDER: 'PAY_ORDER',
    CANCEL_ORDER: 'CANCEL_ORDER',
})

export const InventoryAction = Object.freeze({
    RELEASED: 'RELEASED',
    RESTORED: 'RESTORED',
    NONE: 'NONE',
})

// SR-CAN-01: Customer chỉ hủy được PendingPayment hoặc Paid.
const CUSTOMER_CANCELLABLE = new Set([
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
])

// Admin bắt đầu xử lý đơn; Customer xác nhận đã nhận để hoàn tất.
const ADMIN_TRANSITIONS = Object.freeze({
    [OrderStatus.PAID]: [OrderStatus.PROCESSING],
})

export function isOrderStatus(value) {
    return Object.values(OrderStatus).includes(value)
}

export function canCustomerCancel(status) {
    return CUSTOMER_CANCELLABLE.has(status)
}

export function canCustomerConfirmReceipt(status) {
    return status === OrderStatus.PROCESSING
}

// canPay không bảo đảm kho còn hàng khi thử lại (contract mục 3.2).
export function canCustomerPay(status, paymentInProgress) {
    return status === OrderStatus.PENDING_PAYMENT && !paymentInProgress
}

export function canAdminTransition(fromStatus, toStatus) {
    return (ADMIN_TRANSITIONS[fromStatus] ?? []).includes(toStatus)
}

export const DeliveryStage = Object.freeze({
    PROCESSING_STARTED: 'PROCESSING_STARTED',
    PACKED: 'PACKED',
    HANDED_TO_CARRIER: 'HANDED_TO_CARRIER',
    IN_TRANSIT: 'IN_TRANSIT',
    OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED',
})

export const ADMIN_TRACKABLE_STAGES = Object.freeze([
    DeliveryStage.PACKED,
    DeliveryStage.HANDED_TO_CARRIER,
    DeliveryStage.IN_TRANSIT,
    DeliveryStage.OUT_FOR_DELIVERY,
])

export const DELIVERY_STAGE_RANK = Object.freeze({
    [DeliveryStage.PROCESSING_STARTED]: 1,
    [DeliveryStage.PACKED]: 2,
    [DeliveryStage.HANDED_TO_CARRIER]: 3,
    [DeliveryStage.IN_TRANSIT]: 4,
    [DeliveryStage.OUT_FOR_DELIVERY]: 5,
    [DeliveryStage.DELIVERED]: 6,
})

export const DELIVERY_STAGE_DEFAULT_NOTES = Object.freeze({
    [DeliveryStage.PROCESSING_STARTED]: 'Kho đã tiếp nhận đơn và bắt đầu chuẩn bị hàng.',
    [DeliveryStage.PACKED]: 'Đơn hàng đã được đóng gói xong tại kho.',
    [DeliveryStage.HANDED_TO_CARRIER]: 'Đơn hàng đã bàn giao cho đơn vị vận chuyển.',
    [DeliveryStage.IN_TRANSIT]: 'Đơn hàng đang được vận chuyển.',
    [DeliveryStage.OUT_FOR_DELIVERY]: 'Đơn hàng đang trên đường giao đến khách hàng.',
    [DeliveryStage.DELIVERED]: 'Khách hàng đã xác nhận nhận hàng.',
})

export function canAdvanceDeliveryStage(existingStages = [], nextStage) {
    if (!ADMIN_TRACKABLE_STAGES.includes(nextStage)) {
        return false
    }
    const maxRank = existingStages.reduce(
        (max, stage) => Math.max(max, DELIVERY_STAGE_RANK[stage] ?? 0),
        0
    )
    return DELIVERY_STAGE_RANK[nextStage] >= maxRank
}
