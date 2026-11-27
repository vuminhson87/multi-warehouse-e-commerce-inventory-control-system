export const AuditTargetType = Object.freeze({
    ORDER: 'ORDER',
    PRODUCT: 'PRODUCT',
    USER: 'USER',
    INVENTORY: 'INVENTORY',
})

export const AuditAction = Object.freeze({
    ORDER_START_PROCESSING: 'ORDER_START_PROCESSING',
    ORDER_ADD_TRACKING_EVENT: 'ORDER_ADD_TRACKING_EVENT',
    PRODUCT_CREATE: 'PRODUCT_CREATE',
    PRODUCT_UPDATE: 'PRODUCT_UPDATE',
    PRODUCT_DISCONTINUE: 'PRODUCT_DISCONTINUE',
    PRODUCT_ACTIVATE: 'PRODUCT_ACTIVATE',
    WAREHOUSE_MANAGER_ASSIGN: 'WAREHOUSE_MANAGER_ASSIGN',
    USER_CREATE_MANAGER: 'USER_CREATE_MANAGER',
    USER_UPDATE: 'USER_UPDATE',
    USER_LOCK: 'USER_LOCK',
    USER_UNLOCK: 'USER_UNLOCK',
    USER_RESET_PASSWORD: 'USER_RESET_PASSWORD',
    USER_DELETE: 'USER_DELETE',
    USER_ANONYMIZE: 'USER_ANONYMIZE',
})

export function isAuditTargetType(value) {
    return Object.values(AuditTargetType).includes(value)
}

function normalizeSummary(summary) {
    return String(summary ?? '').trim().slice(0, 255) || 'Thao tác hệ thống'
}

/**
 * Ghi nhật ký thao tác quản trị trong cùng transaction với nghiệp vụ chính.
 * An toàn với test mock tối giản (nếu client không có adminAuditLog thì bỏ qua).
 */
export async function writeAdminAuditLog(
    tx,
    {
        actor,
        action,
        targetType,
        targetId = null,
        warehouseId = null,
        summary,
        metadata = null,
    } = {}
) {
    if (!tx?.adminAuditLog?.create || !actor?.id || !actor?.role) {
        return null
    }

    return tx.adminAuditLog.create({
        data: {
            actorUserId: actor.id,
            actorRole: actor.role,
            action: String(action).slice(0, 64),
            targetType,
            targetId: targetId ?? null,
            warehouseId: warehouseId ?? null,
            summary: normalizeSummary(summary),
            metadata,
        },
    })
}

export async function listAdminAuditLogs(
    client,
    { page = 1, limit = 20, targetType, action, search } = {}
) {
    const trimmedSearch = typeof search === 'string' ? search.trim() : ''
    const where = {
        ...(targetType ? { targetType } : {}),
        ...(action ? { action } : {}),
        ...(trimmedSearch
            ? {
                  OR: [
                      { summary: { contains: trimmedSearch, mode: 'insensitive' } },
                      { action: { contains: trimmedSearch, mode: 'insensitive' } },
                      { actor: { username: { contains: trimmedSearch, mode: 'insensitive' } } },
                      { actor: { fullName: { contains: trimmedSearch, mode: 'insensitive' } } },
                  ],
              }
            : {}),
    }

    const [rows, total] = await client.$transaction([
        client.adminAuditLog.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
            include: {
                actor: {
                    select: { id: true, username: true, fullName: true, role: true },
                },
                warehouse: {
                    select: { id: true, name: true, code: true },
                },
            },
        }),
        client.adminAuditLog.count({ where }),
    ])

    return {
        logs: rows.map((row) => ({
            id: row.id,
            action: row.action,
            targetType: row.targetType,
            targetId: row.targetId,
            warehouseId: row.warehouseId,
            warehouseName: row.warehouse?.name ?? null,
            summary: row.summary,
            metadata: row.metadata ?? null,
            actor: row.actor
                ? {
                      id: row.actor.id,
                      username: row.actor.username,
                      fullName: row.actor.fullName ?? null,
                      role: row.actorRole,
                  }
                : null,
            createdAt: row.createdAt.toISOString(),
        })),
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}
