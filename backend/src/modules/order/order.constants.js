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

// Phụ lục Admin (contract mục 10) - chỉ dùng nếu nhóm chấp nhận. Chưa phải yêu cầu SRS.
const ADMIN_TRANSITIONS = Object.freeze({
    [OrderStatus.PAID]: [OrderStatus.PROCESSING],
    [OrderStatus.PROCESSING]: [OrderStatus.COMPLETED],
})

export function isOrderStatus(value) {
    return Object.values(OrderStatus).includes(value)
}

export function canCustomerCancel(status) {
    return CUSTOMER_CANCELLABLE.has(status)
}

// canPay không bảo đảm kho còn hàng khi thử lại (contract mục 3.2).
export function canCustomerPay(status, paymentInProgress) {
    return status === OrderStatus.PENDING_PAYMENT && !paymentInProgress
}

export function canAdminTransition(fromStatus, toStatus) {
    return (ADMIN_TRANSITIONS[fromStatus] ?? []).includes(toStatus)
}
