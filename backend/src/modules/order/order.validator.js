// Validate và chuẩn hóa đầu vào của module Order (docs/api-order-payment.md mục 2.1, 4, 5).
// Hàm thuần: không đụng DB. Ném AppError(VALIDATION_ERROR) khi sai.

import {
    ADMIN_TRACKABLE_STAGES,
    DELIVERY_STAGE_DEFAULT_NOTES,
    OrderStatus,
    SimulateMode,
    isOrderStatus,
} from './order.constants.js'
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

// Checkout: { idempotencyKey, items: [{ productId, quantity }], voucherCode?, shippingAddress? }
export function validateCheckoutBody(body, config = businessConfig) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['idempotencyKey', 'items', 'voucherCode', 'shippingAddress'])

    const idempotencyKey = validateIdempotencyKey(body.idempotencyKey)

    let voucherCode = null
    if (body.voucherCode !== undefined && body.voucherCode !== null) {
        if (typeof body.voucherCode !== 'string') {
            throw validationError([
                { field: 'voucherCode', reason: 'Mã giảm giá phải là chuỗi ký tự.' },
            ])
        }
        const trimmed = body.voucherCode.trim().toUpperCase()
        if (trimmed.length > 0) {
            if (!/^[A-Z0-9_-]{3,32}$/.test(trimmed)) {
                throw validationError([
                    { field: 'voucherCode', reason: 'Mã giảm giá không đúng định dạng.' },
                ])
            }
            voucherCode = trimmed
        }
    }

    let shippingAddress = null
    if (body.shippingAddress !== undefined && body.shippingAddress !== null) {
        if (!isPlainObject(body.shippingAddress)) {
            throw validationError([
                { field: 'shippingAddress', reason: 'Địa chỉ giao hàng phải là một đối tượng.' },
            ])
        }
        const allowedShippingKeys = ['fullName', 'phone', 'province', 'addressLine', 'note']
        const unknownShipping = Object.keys(body.shippingAddress).filter(
            (key) => !allowedShippingKeys.includes(key)
        )
        if (unknownShipping.length > 0) {
            throw validationError(
                unknownShipping.map((field) => ({
                    field: `shippingAddress.${field}`,
                    reason: 'Trường không được phép.',
                }))
            )
        }

        const fullName =
            typeof body.shippingAddress.fullName === 'string'
                ? body.shippingAddress.fullName.trim()
                : ''
        const phone =
            typeof body.shippingAddress.phone === 'string'
                ? body.shippingAddress.phone.trim()
                : ''
        const province =
            typeof body.shippingAddress.province === 'string'
                ? body.shippingAddress.province.trim()
                : ''
        const addressLine =
            typeof body.shippingAddress.addressLine === 'string'
                ? body.shippingAddress.addressLine.trim()
                : ''
        const rawNote = body.shippingAddress.note
        const note = typeof rawNote === 'string' ? rawNote.trim() : ''

        const shippingErrors = []
        if (fullName.length < 2 || fullName.length > 120) {
            shippingErrors.push({
                field: 'shippingAddress.fullName',
                reason: 'Họ tên người nhận phải từ 2 đến 120 ký tự.',
            })
        }
        if (!/^[0-9+\-\s().]{8,20}$/.test(phone)) {
            shippingErrors.push({
                field: 'shippingAddress.phone',
                reason: 'Số điện thoại nhận hàng không hợp lệ.',
            })
        }
        if (province.length < 2 || province.length > 100) {
            shippingErrors.push({
                field: 'shippingAddress.province',
                reason: 'Vui lòng chọn hoặc nhập Tỉnh/Thành phố.',
            })
        }
        if (addressLine.length < 4 || addressLine.length > 255) {
            shippingErrors.push({
                field: 'shippingAddress.addressLine',
                reason: 'Địa chỉ chi tiết phải từ 4 đến 255 ký tự.',
            })
        }
        if (rawNote !== undefined && rawNote !== null && typeof rawNote !== 'string') {
            shippingErrors.push({
                field: 'shippingAddress.note',
                reason: 'Ghi chú giao hàng phải là chuỗi ký tự.',
            })
        } else if (note.length > 255) {
            shippingErrors.push({
                field: 'shippingAddress.note',
                reason: 'Ghi chú giao hàng tối đa 255 ký tự.',
            })
        }
        if (shippingErrors.length > 0) {
            throw validationError(shippingErrors)
        }

        shippingAddress = {
            fullName,
            phone,
            province,
            addressLine,
            note: note || null,
        }
    }

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

    return {
        idempotencyKey,
        items,
        ...(voucherCode ? { voucherCode } : {}),
        ...(shippingAddress ? { shippingAddress } : {}),
    }
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

// Admin may start order processing only after successful payment.
export function validateAdminOrderStatusBody(body) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['status'])

    if (body.status !== OrderStatus.PROCESSING) {
        throw validationError([
            { field: 'status', reason: 'Admin chỉ được chuyển đơn sang Processing.' },
        ])
    }

    return { status: body.status }
}

// Admin / Quản lý kho cập nhật mốc giao hàng chi tiết khi đơn đang Processing.
export function validateAdminTrackingBody(body) {
    assertBodyObject(body)
    assertOnlyAllowedFields(body, ['stage', 'note', 'location', 'trackingCode'])

    if (typeof body.stage !== 'string' || !ADMIN_TRACKABLE_STAGES.includes(body.stage)) {
        throw validationError([
            {
                field: 'stage',
                reason: `Mốc giao hàng phải là một trong: ${ADMIN_TRACKABLE_STAGES.join(', ')}.`,
            },
        ])
    }

    let note = DELIVERY_STAGE_DEFAULT_NOTES[body.stage]
    if (body.note !== undefined && body.note !== null) {
        if (typeof body.note !== 'string' || body.note.trim().length > 255) {
            throw validationError([
                { field: 'note', reason: 'Ghi chú tiến độ phải là chuỗi tối đa 255 ký tự.' },
            ])
        }
        if (body.note.trim()) {
            note = body.note.trim()
        }
    }

    let location = null
    if (body.location !== undefined && body.location !== null) {
        if (typeof body.location !== 'string' || body.location.trim().length > 160) {
            throw validationError([
                { field: 'location', reason: 'Địa điểm tối đa 160 ký tự.' },
            ])
        }
        location = body.location.trim() || null
    }

    let trackingCode = null
    if (body.trackingCode !== undefined && body.trackingCode !== null) {
        if (typeof body.trackingCode !== 'string' || body.trackingCode.trim().length > 64) {
            throw validationError([
                { field: 'trackingCode', reason: 'Mã vận đơn tối đa 64 ký tự.' },
            ])
        }
        trackingCode = body.trackingCode.trim() || null
    }

    return {
        stage: body.stage,
        note,
        location,
        trackingCode,
    }
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
