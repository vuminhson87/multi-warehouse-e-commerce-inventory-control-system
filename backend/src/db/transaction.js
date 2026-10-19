// M3 - Nguyễn Anh Quân: Tiện ích transaction PostgreSQL có thử lại khi xung đột tạm thời.
// NFR-REL-01: mọi thao tác reserve/payment/inventory chạy trong transaction, lỗi thì rollback toàn bộ.
// Service (M2) sở hữu nghiệp vụ, gọi runInTransaction rồi truyền `tx` cho các repository.
//
// Lưu ý quan trọng (contract mục 8): KHÔNG gọi mock gateway hay I/O chậm bên trong `work`,
// để không giữ row lock trong lúc chờ bên ngoài.

import { Prisma } from '@prisma/client'
import prisma from './prisma.js'
import businessConfig from '../config/business.js'
import { AppError, ErrorCodes } from '../shared/errors.js'

// 40001 serialization_failure, 40P01 deadlock_detected, 55P03 lock_not_available.
const RETRYABLE_PG_CODES = new Set(['40001', '40P01', '55P03'])

export function isRetryableTransactionError(error) {
    if (!error || typeof error !== 'object') {
        return false
    }

    // P2034: Prisma báo write conflict hoặc deadlock, nên thử lại transaction.
    if (error.code === 'P2034') {
        return true
    }

    const pgCode = error.meta?.code ?? error.meta?.driverAdapterError?.cause?.originalCode

    if (pgCode && RETRYABLE_PG_CODES.has(String(pgCode))) {
        return true
    }

    const message = String(error.message ?? '')

    return /could not serialize access|deadlock detected|lock not available/i.test(message)
}

function backoffDelay(attempt) {
    // 20–60ms, 40–120ms, ... để các request đồng thời không thử lại cùng lúc.
    const base = 20 * 2 ** attempt
    return base + Math.floor(Math.random() * base * 2)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export const IsolationLevel = Object.freeze({
    READ_COMMITTED: Prisma.TransactionIsolationLevel?.ReadCommitted ?? 'ReadCommitted',
    REPEATABLE_READ: Prisma.TransactionIsolationLevel?.RepeatableRead ?? 'RepeatableRead',
    SERIALIZABLE: Prisma.TransactionIsolationLevel?.Serializable ?? 'Serializable',
})

/**
 * Chạy `work(tx)` trong một interactive transaction.
 * - Mặc định READ COMMITTED + khóa hàng (SELECT ... FOR UPDATE) + UPDATE có điều kiện trong repository.
 * - Tự thử lại tối đa `maxRetries` lần khi deadlock/serialization failure.
 * - Hết lượt thử lại → AppError TEMPORARY_CONFLICT (HTTP 503) để client thử lại sau.
 * - AppError nghiệp vụ (OUT_OF_STOCK...) ném ra ngay, không thử lại.
 */
export async function runInTransaction(work, options = {}) {
    const {
        client = prisma,
        maxRetries = businessConfig.maxTransactionRetries,
        isolationLevel = IsolationLevel.READ_COMMITTED,
        timeoutMs = 10000,
        maxWaitMs = 5000,
        onRetry,
    } = options

    for (let attempt = 0; ; attempt += 1) {
        try {
            return await client.$transaction(work, {
                isolationLevel,
                timeout: timeoutMs,
                maxWait: maxWaitMs,
            })
        } catch (error) {
            if (error instanceof AppError || !isRetryableTransactionError(error)) {
                throw error
            }

            if (attempt >= maxRetries) {
                throw new AppError(
                    ErrorCodes.TEMPORARY_CONFLICT,
                    'Hệ thống đang bận xử lý yêu cầu đồng thời, vui lòng thử lại.'
                )
            }

            onRetry?.(attempt + 1, error)
            await sleep(backoffDelay(attempt))
        }
    }
}
