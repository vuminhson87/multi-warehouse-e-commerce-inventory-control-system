// M3 - Nguyễn Anh Quân: Tầng lưu trữ Idempotency chống xử lý lặp (double submit / callback lặp).
// Truy vết: BR-03, BR-04, BR-06, NFR-REL-01, Test T19.
//
// Phục vụ M2 cho 3 thao tác: CREATE_ORDER, PAY_ORDER, CANCEL_ORDER.
// - Khóa duy nhất theo `(userId, operation, key)`.
// - Nếu gửi lại cùng `key` nhưng khác payload (`requestHash` khác) → ném IDEMPOTENCY_CONFLICT (409).
// - Nếu gửi lại cùng `key` + cùng `requestHash` và đã có `responseBody` → trả lại kết quả cũ,
//   không chạy lại nghiệp vụ trừ/hoàn kho.

import crypto from 'node:crypto'
import { AppError, ErrorCodes } from './errors.js'

function canonicalize(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalize)
    }
    if (value !== null && typeof value === 'object') {
        return Object.keys(value)
            .sort()
            .reduce((acc, key) => {
                acc[key] = canonicalize(value[key])
                return acc
            }, {})
    }
    return value
}

export function hashRequestPayload(payload) {
    const canonical = JSON.stringify(canonicalize(payload ?? {}))
    return crypto.createHash('sha256').update(canonical).digest('hex')
}

function isUniqueConstraintError(error) {
    return (
        error?.code === 'P2002' ||
        error?.meta?.code === '23505' ||
        /unique constraint|duplicate key/i.test(String(error?.message ?? ''))
    )
}

/**
 * Bắt đầu hoặc lấy lại bản ghi idempotency cho `(userId, operation, key)`.
 * - Nếu chưa có → tạo bản ghi mới (`completedAt = null`) và trả `{ status: 'STARTED', record }`.
 * - Nếu đã có và `requestHash` khác → ném `AppError(IDEMPOTENCY_CONFLICT)`.
 * - Nếu đã có và đã hoàn tất (`completedAt !== null`) → trả `{ status: 'COMPLETED', record }`.
 * - Nếu đã có nhưng chưa hoàn tất (request đồng thời đang xử lý) → trả `{ status: 'IN_PROGRESS', record }`.
 */
export async function claimIdempotencyKey(
    client,
    { userId, operation, key, payload, orderId = null }
) {
    const requestHash = hashRequestPayload(payload)

    const existing = await client.idempotencyRecord.findUnique({
        where: {
            userId_operation_key: { userId, operation, key },
        },
    })

    if (existing) {
        if (existing.requestHash !== requestHash) {
            throw new AppError(
                ErrorCodes.IDEMPOTENCY_CONFLICT,
                'Idempotency key đã được sử dụng với dữ liệu yêu cầu khác.'
            )
        }

        if (existing.completedAt !== null) {
            return {
                status: 'COMPLETED',
                record: existing,
                responseStatus: existing.responseStatus,
                responseBody: existing.responseBody,
            }
        }

        return { status: 'IN_PROGRESS', record: existing }
    }

    try {
        const created = await client.idempotencyRecord.create({
            data: {
                userId,
                operation,
                key,
                requestHash,
                orderId,
            },
        })

        return { status: 'STARTED', record: created }
    } catch (error) {
        if (isUniqueConstraintError(error)) {
            const raced = await client.idempotencyRecord.findUnique({
                where: { userId_operation_key: { userId, operation, key } },
            })
            if (raced && raced.requestHash !== requestHash) {
                throw new AppError(
                    ErrorCodes.IDEMPOTENCY_CONFLICT,
                    'Idempotency key đã được sử dụng với dữ liệu yêu cầu khác.'
                )
            }
            if (raced?.completedAt !== null) {
                return {
                    status: 'COMPLETED',
                    record: raced,
                    responseStatus: raced.responseStatus,
                    responseBody: raced.responseBody,
                }
            }
            return { status: 'IN_PROGRESS', record: raced }
        }
        throw error
    }
}

/**
 * Lưu kết quả phản hồi của thao tác để các lần gửi lặp sau trả về y hệt mà không thực thi lại.
 */
export async function completeIdempotencyKey(
    client,
    { id, orderId = undefined, responseStatus = 200, responseBody }
) {
    return client.idempotencyRecord.update({
        where: { id },
        data: {
            ...(orderId !== undefined ? { orderId } : {}),
            responseStatus,
            responseBody,
            completedAt: new Date(),
        },
    })
}
