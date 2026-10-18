// Validate và chuẩn hóa đầu vào của module Order (docs/api-order-payment.md mục 2.1, 4, 5).
// Hàm thuần: không đụng DB. Ném AppError(VALIDATION_ERROR) khi sai.

import { SimulateMode, isOrderStatus } from './order.constants.js'
import { validationError } from '../../shared/errors.js'
import businessConfig from '../../config/business.js'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_ID = 2147483647 // phạm vi Int của PostgreSQL

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

// Body chỉ được chứa các trường cho phép; trường lạ (customerId, role, price, warehouseId, status...) bị từ chối.
function assertOnlyAllowedFields(body, allowedFields) {
    const unknown = Object.keys(body).filter((key) => !allowedFields.includes(key))

    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }
}

function assertBodyObject(body) {
    if (!isPlainObject(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là một đối tượng JSON.' }])
    }
}

export function parsePositiveIntId(value, fieldName) {
    // Chỉ chấp nhận chuỗi/số nguyên thập phân dương; "12abc", "1.5", "0", "-1" bị từ chối.
    const text = typeof value === 'number' ? String(value) : value

    if (typeof text !== 'string' || !/^[1-9]\d*$/.test(text)) {
        throw validationError([{ field: fieldName, reason: 'Phải là số nguyên dương.' }])
    }

    const parsed = Number(text)

    if (!Number.isSafeInteger(parsed) || parsed > MAX_ID) {
        throw validationError([{ field: fieldName, reason: 'Giá trị vượt phạm vi cho phép.' }])
    }

    return parsed
}

export function validateIdempotencyKey(value) {
    if (typeof value !== 'string' || !UUID_REGEX.test(value)) {
        throw validationError([
            { field: 'idempotencyKey', reason: 'Phải là UUID hợp lệ.' },
        ])
    }

    return value.toLowerCase()
}

// Checkout: { idempotencyKey, items: [{ productId, quantity }] }
export function validateCheckoutBody(body, config = businessConfig) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['idempotencyKey', 'items'])

    const idempotencyKey = validateIdempotencyKey(body.idempotencyKey)

    if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > config.maxItemsPerOrder) {
        throw validationError([
            {
                field: 'items',
                reason: `Phải có từ 1 đến ${config.maxItemsPerOrder} dòng sản phẩm.`,
            },
        ])
    }

    const mergedByProduct = new Map()

    body.items.forEach((item, index) => {
        if (!isPlainObject(item)) {
            throw validationError([{ field: `items[${index}]`, reason: 'Mỗi dòng phải là một đối tượng.' }])
        }

        const unknown = Object.keys(item).filter((key) => key !== 'productId' && key !== 'quantity')

        if (unknown.length > 0) {
            throw validationError(
                unknown.map((field) => ({
                    field: `items[${index}].${field}`,
                    reason: 'Trường không được phép.',
                }))
            )
        }

        // productId: số nguyên dương. Chỉ nhận kiểu number, không nhận chuỗi, để đúng contract.
        if (!Number.isInteger(item.productId) || item.productId < 1 || item.productId > MAX_ID) {
            throw validationError([
                { field: `items[${index}].productId`, reason: 'Phải là số nguyên dương.' },
            ])
        }

        if (
            !Number.isInteger(item.quantity) ||
            item.quantity < 1 ||
            item.quantity > config.maxQuantityPerProduct
        ) {
            throw validationError([
                {
                    field: `items[${index}].quantity`,
                    reason: `Phải là số nguyên từ 1 đến ${config.maxQuantityPerProduct}.`,
                },
            ])
        }

        mergedByProduct.set(
            item.productId,
            (mergedByProduct.get(item.productId) ?? 0) + item.quantity
        )
    })

    // C07: kiểm tra lại sau khi gộp sản phẩm trùng.
    const items = [...mergedByProduct.entries()]
        .sort(([a], [b]) => a - b)
        .map(([productId, quantity]) => {
            if (quantity > config.maxQuantityPerProduct) {
                throw validationError([
                    {
                        field: 'items',
                        reason: `Tổng số lượng sản phẩm ${productId} sau khi gộp vượt ${config.maxQuantityPerProduct}.`,
                    },
                ])
            }

            return { productId, quantity }
        })

    return { idempotencyKey, items }
}

// Payment: { idempotencyKey, simulate? }
export function validatePaymentBody(body, config = businessConfig) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['idempotencyKey', 'simulate'])

    const idempotencyKey = validateIdempotencyKey(body.idempotencyKey)
    let simulate = SimulateMode.SUCCESS

    if (body.simulate !== undefined) {
        if (!config.demoMode) {
            throw validationError([
                { field: 'simulate', reason: 'Chỉ được dùng khi bật chế độ demo.' },
            ])
        }

        if (!Object.values(SimulateMode).includes(body.simulate)) {
            throw validationError([
                {
                    field: 'simulate',
                    reason: `Phải là một trong: ${Object.values(SimulateMode).join(', ')}.`,
                },
            ])
        }

        simulate = body.simulate
    }

    return { idempotencyKey, simulate }
}

// Cancel: { idempotencyKey }
export function validateCancelBody(body) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['idempotencyKey'])

    return { idempotencyKey: validateIdempotencyKey(body.idempotencyKey) }
}

// Query danh sách đơn: page, limit, status. Sai thì trả 400, không âm thầm đổi về mặc định.
export function validateListQuery(query = {}, config = businessConfig) {
    const allowed = ['page', 'limit', 'status']
    const unknown = Object.keys(query).filter((key) => !allowed.includes(key))

    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Tham số không được phép.' }))
        )
    }

    const page = query.page === undefined ? 1 : parsePositiveIntId(query.page, 'page')
    const limit =
        query.limit === undefined ? config.defaultPageSize : parsePositiveIntId(query.limit, 'limit')

    if (limit > config.maxPageSize) {
        throw validationError([
            { field: 'limit', reason: `Tối đa ${config.maxPageSize}.` },
        ])
    }

    let status

    if (query.status !== undefined) {
        if (!isOrderStatus(query.status)) {
            throw validationError([{ field: 'status', reason: 'Trạng thái không hợp lệ.' }])
        }

        status = query.status
    }

    return { page, limit, status }
}
