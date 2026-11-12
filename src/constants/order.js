// Hằng số trạng thái đơn hàng phía frontend.
// Giá trị khớp với backend/src/modules/order/order.constants.js (SRS BR-11).

export const OrderStatus = Object.freeze({
    PENDING_PAYMENT: 'PendingPayment',
    PAID: 'Paid',
    PROCESSING: 'Processing',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',
})

// Kết quả giả lập của cổng thanh toán (mock gateway).
export const PaymentResult = Object.freeze({
    SUCCESS: 'SUCCESS',
    FAILED: 'FAILED',
    INCOMPLETE: 'INCOMPLETE',
})

// SR-CAN-01: Customer chỉ được hủy đơn ở trạng thái PendingPayment hoặc Paid.
export const CUSTOMER_CANCELLABLE_STATUSES = Object.freeze([
    OrderStatus.PENDING_PAYMENT,
    OrderStatus.PAID,
])

// Thời gian giữ hàng tối đa cho đơn chưa thanh toán (khớp RESERVATION_TTL_MINUTES mặc định của backend).
export const RESERVATION_TTL_MINUTES = 15

// Khi thử lại thanh toán sau lúc hàng đã được giải phóng:
// ưu tiên giữ lại đúng kho cũ; nếu kho cũ không còn đủ thì có được chọn kho khác (vẫn đủ TOÀN BỘ đơn) hay không.
// SRS chưa quy định điểm này, nhóm có thể đổi thành false nếu muốn bắt buộc giữ nguyên kho.
export const ALLOW_CHANGE_WAREHOUSE_ON_RETRY = true

export const ORDER_STATUS_LABELS = Object.freeze({
    [OrderStatus.PENDING_PAYMENT]: 'Chờ thanh toán',
    [OrderStatus.PAID]: 'Đã thanh toán',
    [OrderStatus.PROCESSING]: 'Đang xử lý',
    [OrderStatus.COMPLETED]: 'Hoàn tất',
    [OrderStatus.CANCELLED]: 'Đã hủy',
})

export const PAYMENT_RESULT_LABELS = Object.freeze({
    [PaymentResult.SUCCESS]: 'Thành công',
    [PaymentResult.FAILED]: 'Thất bại',
    [PaymentResult.INCOMPLETE]: 'Không hoàn tất',
    PENDING: 'Đang xử lý/đối soát',
})

export function getOrderStatusLabel(status) {
    return ORDER_STATUS_LABELS[status] ?? status
}

export function isCustomerCancellable(status) {
    return CUSTOMER_CANCELLABLE_STATUSES.includes(status)
}

export function formatCurrency(value) {
    return `${Number(value || 0).toLocaleString('vi-VN')} VNĐ`
}

export function formatDateTime(isoString) {
    if (!isoString) {
        return '—'
    }

    const date = new Date(isoString)
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('vi-VN')
}
