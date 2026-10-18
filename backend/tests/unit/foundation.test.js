import { describe, it, expect } from 'vitest'
import {
    OrderStatus,
    canCustomerCancel,
    canCustomerPay,
    canAdminTransition,
    isOrderStatus,
} from '../../src/modules/order/order.constants.js'
import { loadBusinessConfig } from '../../src/config/business.js'
import { AppError, ErrorCodes, toErrorBody } from '../../src/shared/errors.js'

describe('order.constants', () => {
    it('SR-CAN-01: chỉ PendingPayment và Paid được hủy', () => {
        expect(canCustomerCancel(OrderStatus.PENDING_PAYMENT)).toBe(true)
        expect(canCustomerCancel(OrderStatus.PAID)).toBe(true)
        expect(canCustomerCancel(OrderStatus.PROCESSING)).toBe(false)
        expect(canCustomerCancel(OrderStatus.COMPLETED)).toBe(false)
        expect(canCustomerCancel(OrderStatus.CANCELLED)).toBe(false)
    })

    it('canPay chỉ khi PendingPayment và không có attempt PENDING', () => {
        expect(canCustomerPay(OrderStatus.PENDING_PAYMENT, false)).toBe(true)
        expect(canCustomerPay(OrderStatus.PENDING_PAYMENT, true)).toBe(false)
        expect(canCustomerPay(OrderStatus.PAID, false)).toBe(false)
        expect(canCustomerPay(OrderStatus.CANCELLED, false)).toBe(false)
    })

    it('Admin chỉ chuyển Paid→Processing→Completed (phụ lục đề xuất)', () => {
        expect(canAdminTransition(OrderStatus.PAID, OrderStatus.PROCESSING)).toBe(true)
        expect(canAdminTransition(OrderStatus.PROCESSING, OrderStatus.COMPLETED)).toBe(true)
        expect(canAdminTransition(OrderStatus.PAID, OrderStatus.COMPLETED)).toBe(false)
        expect(canAdminTransition(OrderStatus.PENDING_PAYMENT, OrderStatus.PAID)).toBe(false)
        expect(canAdminTransition(OrderStatus.CANCELLED, OrderStatus.PROCESSING)).toBe(false)
    })

    it('isOrderStatus nhận đúng 5 trạng thái BR-11', () => {
        for (const status of Object.values(OrderStatus)) {
            expect(isOrderStatus(status)).toBe(true)
        }

        expect(isOrderStatus('Failed')).toBe(false)
        expect(isOrderStatus('Expired')).toBe(false)
    })
})

describe('loadBusinessConfig', () => {
    it('có giá trị mặc định theo contract', () => {
        const config = loadBusinessConfig({})

        expect(config.reservationTtlMinutes).toBe(15)
        expect(config.expiryJobIntervalSeconds).toBe(60)
        expect(config.gatewayTimeoutMs).toBe(10000)
        expect(config.demoMode).toBe(false)
        expect(config.maxItemsPerOrder).toBe(50)
        expect(config.maxQuantityPerProduct).toBe(100)
        expect(config.maxTransactionRetries).toBe(3)
    })

    it('đọc giá trị từ biến môi trường', () => {
        const config = loadBusinessConfig({ RESERVATION_TTL_MINUTES: '20', DEMO_MODE: 'true' })

        expect(config.reservationTtlMinutes).toBe(20)
        expect(config.demoMode).toBe(true)
    })

    it('từ chối giá trị cấu hình sai thay vì chạy với giá trị bất thường', () => {
        expect(() => loadBusinessConfig({ RESERVATION_TTL_MINUTES: '0' })).toThrow()
        expect(() => loadBusinessConfig({ RESERVATION_TTL_MINUTES: 'abc' })).toThrow()
        expect(() => loadBusinessConfig({ DEMO_MODE: 'yes' })).toThrow()
    })
})

describe('errors', () => {
    it('ánh xạ mã lỗi sang HTTP status đúng contract', () => {
        const expected = {
            VALIDATION_ERROR: 400,
            UNAUTHENTICATED: 401,
            FORBIDDEN: 403,
            ORDER_NOT_FOUND: 404,
            OUT_OF_STOCK: 409,
            PRODUCT_UNAVAILABLE: 409,
            INVALID_ORDER_STATE: 409,
            IDEMPOTENCY_CONFLICT: 409,
            PAYMENT_IN_PROGRESS: 409,
            TEMPORARY_CONFLICT: 503,
            REQUEST_OUTCOME_UNKNOWN: 503,
            INTERNAL_ERROR: 500,
        }

        for (const [code, status] of Object.entries(expected)) {
            expect(new AppError(code, 'x').httpStatus).toBe(status)
        }
    })

    it('toErrorBody trả details là mảng và không lộ chi tiết lỗi lạ', () => {
        const body = toErrorBody(new AppError(ErrorCodes.OUT_OF_STOCK, 'Hết hàng'))

        expect(body).toEqual({
            success: false,
            error: { code: 'OUT_OF_STOCK', message: 'Hết hàng', details: [] },
        })

        const unknown = toErrorBody(new Error('SELECT * FROM secret'))

        expect(unknown.error.code).toBe('INTERNAL_ERROR')
        expect(JSON.stringify(unknown)).not.toContain('SELECT')
    })
})
