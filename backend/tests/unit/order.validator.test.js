import { describe, it, expect } from 'vitest'
import {
    validateCheckoutBody,
    validatePaymentBody,
    validateCancelBody,
    validateListQuery,
    validateIdempotencyKey,
    parsePositiveIntId,
} from '../../src/modules/order/order.validator.js'
import { AppError, ErrorCodes } from '../../src/shared/errors.js'

const KEY = 'b3f1c2a0-6d7e-4f0a-9c1b-2a3d4e5f6a71'
const config = {
    maxItemsPerOrder: 50,
    maxQuantityPerProduct: 100,
    defaultPageSize: 10,
    maxPageSize: 50,
    demoMode: false,
}

function expectValidationError(fn) {
    try {
        fn()
    } catch (error) {
        expect(error).toBeInstanceOf(AppError)
        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
        expect(error.httpStatus).toBe(400)
        return error
    }

    throw new Error('Mong đợi VALIDATION_ERROR nhưng không có lỗi nào được ném.')
}

describe('validateCheckoutBody', () => {
    it('chấp nhận body hợp lệ và chuẩn hóa key về chữ thường', () => {
        const result = validateCheckoutBody(
            {
                idempotencyKey: KEY.toUpperCase(),
                items: [
                    { productId: 2, quantity: 1 },
                    { productId: 1, quantity: 2 },
                ],
            },
            config
        )

        expect(result.idempotencyKey).toBe(KEY)
        // Sắp theo productId để fingerprint ổn định.
        expect(result.items).toEqual([
            { productId: 1, quantity: 2 },
            { productId: 2, quantity: 1 },
        ])
    })

    it('gộp productId trùng', () => {
        const result = validateCheckoutBody(
            {
                idempotencyKey: KEY,
                items: [
                    { productId: 1, quantity: 2 },
                    { productId: 1, quantity: 3 },
                ],
            },
            config
        )

        expect(result.items).toEqual([{ productId: 1, quantity: 5 }])
    })

    it('API03: productId trùng làm tổng vượt 100 thì bị từ chối (C07)', () => {
        expectValidationError(() =>
            validateCheckoutBody(
                {
                    idempotencyKey: KEY,
                    items: [
                        { productId: 1, quantity: 60 },
                        { productId: 1, quantity: 60 },
                    ],
                },
                config
            )
        )
    })

    it.each([
        ['số lượng bằng 0', 0],
        ['số lượng âm', -1],
        ['số lượng lẻ', 1.5],
        ['số lượng dạng chuỗi', '2'],
        ['số lượng null', null],
        ['số lượng vượt giới hạn', 101],
    ])('API03: %s bị từ chối', (_name, quantity) => {
        expectValidationError(() =>
            validateCheckoutBody(
                { idempotencyKey: KEY, items: [{ productId: 1, quantity }] },
                config
            )
        )
    })

    it('từ chối productId không phải số nguyên dương', () => {
        for (const productId of [0, -1, 1.2, '1', null, undefined]) {
            expectValidationError(() =>
                validateCheckoutBody(
                    { idempotencyKey: KEY, items: [{ productId, quantity: 1 }] },
                    config
                )
            )
        }
    })

    it('từ chối giỏ rỗng và giỏ quá 50 dòng', () => {
        expectValidationError(() => validateCheckoutBody({ idempotencyKey: KEY, items: [] }, config))

        const tooMany = Array.from({ length: 51 }, (_, i) => ({ productId: i + 1, quantity: 1 }))

        expectValidationError(() =>
            validateCheckoutBody({ idempotencyKey: KEY, items: tooMany }, config)
        )
    })

    it('từ chối trường lạ ở body và ở từng dòng (price, customerId, warehouseId...)', () => {
        expectValidationError(() =>
            validateCheckoutBody(
                { idempotencyKey: KEY, customerId: 9, items: [{ productId: 1, quantity: 1 }] },
                config
            )
        )

        expectValidationError(() =>
            validateCheckoutBody(
                {
                    idempotencyKey: KEY,
                    items: [{ productId: 1, quantity: 1, price: 1 }],
                },
                config
            )
        )

        expectValidationError(() =>
            validateCheckoutBody(
                { idempotencyKey: KEY, warehouseId: 1, items: [{ productId: 1, quantity: 1 }] },
                config
            )
        )
    })

    it('từ chối thiếu hoặc sai idempotencyKey', () => {
        expectValidationError(() =>
            validateCheckoutBody({ items: [{ productId: 1, quantity: 1 }] }, config)
        )
        expectValidationError(() =>
            validateCheckoutBody(
                { idempotencyKey: 'abc', items: [{ productId: 1, quantity: 1 }] },
                config
            )
        )
    })

    it('từ chối body không phải đối tượng', () => {
        for (const body of [null, undefined, [], 'x', 5]) {
            expectValidationError(() => validateCheckoutBody(body, config))
        }
    })
})

describe('validatePaymentBody', () => {
    it('mặc định simulate là SUCCESS khi không truyền', () => {
        expect(validatePaymentBody({ idempotencyKey: KEY }, config)).toEqual({
            idempotencyKey: KEY,
            simulate: 'SUCCESS',
        })
    })

    it('từ chối simulate khi demoMode tắt', () => {
        expectValidationError(() =>
            validatePaymentBody({ idempotencyKey: KEY, simulate: 'FAILED' }, config)
        )
    })

    it('nhận simulate hợp lệ khi demoMode bật, từ chối giá trị lạ', () => {
        const demo = { ...config, demoMode: true }

        expect(
            validatePaymentBody({ idempotencyKey: KEY, simulate: 'INCOMPLETE' }, demo).simulate
        ).toBe('INCOMPLETE')

        expectValidationError(() =>
            validatePaymentBody({ idempotencyKey: KEY, simulate: 'PAID' }, demo)
        )
    })

    it('từ chối amount/status/dữ liệu thẻ do client gửi (NFR-SEC-08)', () => {
        for (const extra of [{ amount: 1 }, { status: 'Paid' }, { cardNumber: '4111' }]) {
            expectValidationError(() =>
                validatePaymentBody({ idempotencyKey: KEY, ...extra }, config)
            )
        }
    })
})

describe('validateCancelBody', () => {
    it('yêu cầu key hợp lệ và không nhận trường khác', () => {
        expect(validateCancelBody({ idempotencyKey: KEY })).toEqual({ idempotencyKey: KEY })
        expectValidationError(() => validateCancelBody({}))
        expectValidationError(() => validateCancelBody({ idempotencyKey: KEY, status: 'Paid' }))
    })
})

describe('validateListQuery', () => {
    it('dùng giá trị mặc định khi không truyền', () => {
        expect(validateListQuery({}, config)).toEqual({ page: 1, limit: 10, status: undefined })
    })

    it('đọc page, limit, status hợp lệ', () => {
        expect(validateListQuery({ page: '2', limit: '20', status: 'Paid' }, config)).toEqual({
            page: 2,
            limit: 20,
            status: 'Paid',
        })
    })

    it('query sai trả lỗi, không âm thầm về mặc định', () => {
        for (const query of [
            { page: '0' },
            { page: '-1' },
            { page: 'abc' },
            { limit: '51' },
            { limit: '0' },
            { status: 'Unknown' },
            { sort: 'asc' },
        ]) {
            expectValidationError(() => validateListQuery(query, config))
        }
    })
})

describe('parsePositiveIntId / validateIdempotencyKey', () => {
    it('chỉ chấp nhận số nguyên dương thuần, không lẫn ký tự', () => {
        expect(parsePositiveIntId('12', 'orderId')).toBe(12)

        for (const value of ['12abc', '1.5', '0', '-3', '', ' 1', '01', undefined, null, '99999999999']) {
            expectValidationError(() => parsePositiveIntId(value, 'orderId'))
        }
    })

    it('từ chối key không phải UUID', () => {
        expect(validateIdempotencyKey(KEY)).toBe(KEY)
        expectValidationError(() => validateIdempotencyKey('not-a-uuid'))
        expectValidationError(() => validateIdempotencyKey(123))
    })
})
