// Lỗi nghiệp vụ dùng chung. Mã lỗi và HTTP status theo docs/api-order-payment.md mục 2.3.

export const ErrorCodes = Object.freeze({
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    FORBIDDEN: 'FORBIDDEN',
    ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
    OUT_OF_STOCK: 'OUT_OF_STOCK',
    PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
    INVALID_ORDER_STATE: 'INVALID_ORDER_STATE',
    IDEMPOTENCY_CONFLICT: 'IDEMPOTENCY_CONFLICT',
    PAYMENT_IN_PROGRESS: 'PAYMENT_IN_PROGRESS',
    TEMPORARY_CONFLICT: 'TEMPORARY_CONFLICT',
    REQUEST_OUTCOME_UNKNOWN: 'REQUEST_OUTCOME_UNKNOWN',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
})

export const HttpStatusByCode = Object.freeze({
    [ErrorCodes.VALIDATION_ERROR]: 400,
    [ErrorCodes.UNAUTHENTICATED]: 401,
    [ErrorCodes.FORBIDDEN]: 403,
    [ErrorCodes.ORDER_NOT_FOUND]: 404,
    [ErrorCodes.OUT_OF_STOCK]: 409,
    [ErrorCodes.PRODUCT_UNAVAILABLE]: 409,
    [ErrorCodes.INVALID_ORDER_STATE]: 409,
    [ErrorCodes.IDEMPOTENCY_CONFLICT]: 409,
    [ErrorCodes.PAYMENT_IN_PROGRESS]: 409,
    [ErrorCodes.TEMPORARY_CONFLICT]: 503,
    [ErrorCodes.REQUEST_OUTCOME_UNKNOWN]: 503,
    [ErrorCodes.INTERNAL_ERROR]: 500,
})

export class AppError extends Error {
    constructor(code, message, details = []) {
        super(message)
        this.name = 'AppError'
        this.code = code
        this.httpStatus = HttpStatusByCode[code] ?? 500
        this.details = Array.isArray(details) ? details : []
    }
}

// Dạng body lỗi gửi cho frontend. Không đưa stack trace hay thông tin nội bộ vào đây.
export function toErrorBody(error) {
    if (error instanceof AppError) {
        return {
            success: false,
            error: {
                code: error.code,
                message: error.message,
                details: error.details,
            },
        }
    }

    return {
        success: false,
        error: {
            code: ErrorCodes.INTERNAL_ERROR,
            message: 'Đã xảy ra lỗi hệ thống.',
            details: [],
        },
    }
}

export function validationError(details, message = 'Dữ liệu gửi lên không hợp lệ.') {
    return new AppError(ErrorCodes.VALIDATION_ERROR, message, details)
}
