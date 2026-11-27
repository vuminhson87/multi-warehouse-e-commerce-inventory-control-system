import prisma from '../../db/prisma.js'
import { runInTransaction } from '../../db/transaction.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { AuditAction, AuditTargetType, writeAdminAuditLog } from '../audit/audit.repository.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { hashPassword } from './user.repository.js'

const VALID_ROLES = ['CUSTOMER', 'WAREHOUSE_MANAGER', 'ADMIN']
const VALID_STATUS_FILTERS = ['ACTIVE', 'LOCKED']
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isUniqueViolation(error) {
    return error?.code === 'P2002' || error?.meta?.code === '23505'
}

function isForeignKeyViolation(error) {
    return (
        error?.code === 'P2003' ||
        error?.meta?.code === '23503' ||
        /23503|foreign key/i.test(String(error?.message ?? ''))
    )
}

function normalizeOptionalEmail(raw, field = 'email') {
    if (raw === undefined) return undefined
    if (raw === null) return null
    if (typeof raw !== 'string') {
        throw validationError([{ field, reason: 'Email phải là chuỗi ký tự.' }])
    }
    const trimmed = raw.trim().toLowerCase()
    if (!trimmed) return null
    if (trimmed.length > 120 || !EMAIL_REGEX.test(trimmed)) {
        throw validationError([{ field, reason: 'Địa chỉ email không hợp lệ.' }])
    }
    return trimmed
}

function normalizeOptionalFullName(raw, field = 'fullName') {
    if (raw === undefined) return undefined
    if (raw === null) return null
    if (typeof raw !== 'string') {
        throw validationError([{ field, reason: 'Họ tên phải là chuỗi ký tự.' }])
    }
    const trimmed = raw.trim()
    if (!trimmed) return null
    if (trimmed.length > 120) {
        throw validationError([{ field, reason: 'Họ tên tối đa 120 ký tự.' }])
    }
    return trimmed
}

function validatePasswordValue(password, field = 'password') {
    if (
        typeof password !== 'string' ||
        password.length < 8 ||
        Buffer.byteLength(password, 'utf8') > 72
    ) {
        throw validationError([
            { field, reason: 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.' },
        ])
    }
    return password
}

function formatAdminUserRow(user) {
    const counts = user._count ?? {}
    const orderCount = counts.orders ?? 0
    const movementCount = counts.movements ?? 0
    const trackingCount = counts.trackingEvents ?? 0
    const auditLogCount = counts.auditLogs ?? 0
    const idempotencyCount = counts.idempotencyKeys ?? 0
    const dependencyCount =
        orderCount + movementCount + trackingCount + auditLogCount + idempotencyCount

    return {
        id: user.id,
        username: user.username,
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        emailVerifiedAt: user.emailVerifiedAt ? user.emailVerifiedAt.toISOString() : null,
        role: user.role,
        assignedWarehouseId: user.assignedWarehouseId ?? null,
        assignedWarehouse: user.assignedWarehouse
            ? {
                  id: user.assignedWarehouse.id,
                  code: user.assignedWarehouse.code,
                  name: user.assignedWarehouse.name,
              }
            : null,
        isActive: user.isActive,
        orderCount,
        wishlistCount: counts.wishlistItems ?? 0,
        movementCount,
        dependencyCount,
        canHardDelete: user.role !== 'ADMIN' && dependencyCount === 0,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
    }
}

function assertMutableTargetUser(targetUser, actor) {
    if (actor?.id && targetUser.id === actor.id) {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            'Không thể tự chỉnh sửa, khóa hoặc xóa tài khoản Quản trị đang đăng nhập.'
        )
    }
    if (targetUser.role === 'ADMIN') {
        throw new AppError(
            ErrorCodes.FORBIDDEN,
            'Không được phép khóa, xóa hoặc thay đổi tài khoản Quản trị hệ thống.'
        )
    }
}

export function validateAdminUsersListQuery(query = {}) {
    const allowed = ['page', 'limit', 'role', 'status', 'search']
    const unknown = Object.keys(query).filter((key) => !allowed.includes(key))
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Tham số không được phép.' }))
        )
    }

    const page = query.page === undefined ? 1 : parsePositiveIntId(query.page, 'page')
    const limit = query.limit === undefined ? 20 : parsePositiveIntId(query.limit, 'limit')
    if (limit > 100) {
        throw validationError([{ field: 'limit', reason: 'Tối đa 100.' }])
    }

    let role
    if (query.role !== undefined && query.role !== '' && query.role !== 'ALL') {
        if (!VALID_ROLES.includes(query.role)) {
            throw validationError([{ field: 'role', reason: 'Vai trò lọc không hợp lệ.' }])
        }
        role = query.role
    }

    let status
    if (query.status !== undefined && query.status !== '' && query.status !== 'ALL') {
        if (!VALID_STATUS_FILTERS.includes(query.status)) {
            throw validationError([{ field: 'status', reason: 'Trạng thái lọc không hợp lệ.' }])
        }
        status = query.status
    }

    let search
    if (query.search !== undefined) {
        if (typeof query.search !== 'string' || query.search.length > 200) {
            throw validationError([{ field: 'search', reason: 'Từ khóa tối đa 200 ký tự.' }])
        }
        search = query.search.trim() || undefined
    }

    return { page, limit, role, status, search }
}

const USER_LIST_SELECT = {
    id: true,
    username: true,
    fullName: true,
    email: true,
    emailVerifiedAt: true,
    role: true,
    assignedWarehouseId: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    assignedWarehouse: {
        select: { id: true, code: true, name: true },
    },
    _count: {
        select: {
            orders: true,
            wishlistItems: true,
            movements: true,
            trackingEvents: true,
            auditLogs: true,
            idempotencyKeys: true,
        },
    },
}

export async function listAdminUsers(query = {}) {
    const { page, limit, role, status, search } = validateAdminUsersListQuery(query)
    const where = {
        ...(role ? { role } : {}),
        ...(status === 'ACTIVE' ? { isActive: true } : {}),
        ...(status === 'LOCKED' ? { isActive: false } : {}),
        ...(search
            ? {
                  OR: [
                      { username: { contains: search, mode: 'insensitive' } },
                      { fullName: { contains: search, mode: 'insensitive' } },
                      { email: { contains: search, mode: 'insensitive' } },
                  ],
              }
            : {}),
    }

    const [users, total, warehouses] = await prisma.$transaction([
        prisma.user.findMany({
            where,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip: (page - 1) * limit,
            take: limit,
            select: USER_LIST_SELECT,
        }),
        prisma.user.count({ where }),
        prisma.warehouse.findMany({
            select: { id: true, code: true, name: true },
            orderBy: { id: 'asc' },
        }),
    ])

    return {
        users: users.map(formatAdminUserRow),
        warehouses,
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    }
}

export async function getAdminUserDetail(rawUserId) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: USER_LIST_SELECT,
    })

    if (!user) {
        throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
    }

    const [ordersSummary, recentOrders] = await Promise.all([
        prisma.order.findMany({
            where: { customerId: userId },
            select: { status: true, totalAmount: true },
        }),
        prisma.order.findMany({
            where: { customerId: userId },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: 5,
            select: {
                id: true,
                status: true,
                totalAmount: true,
                createdAt: true,
                fulfillmentWarehouse: { select: { name: true } },
            },
        }),
    ])

    const stats = {
        totalOrders: ordersSummary.length,
        pendingOrders: 0,
        paidOrders: 0,
        processingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        totalSpent: 0,
    }

    for (const order of ordersSummary) {
        const amount = Number(order.totalAmount ?? 0)
        if (order.status === 'PendingPayment') stats.pendingOrders += 1
        else if (order.status === 'Paid') {
            stats.paidOrders += 1
            stats.totalSpent += amount
        } else if (order.status === 'Processing') {
            stats.processingOrders += 1
            stats.totalSpent += amount
        } else if (order.status === 'Completed') {
            stats.completedOrders += 1
            stats.totalSpent += amount
        } else if (order.status === 'Cancelled') {
            stats.cancelledOrders += 1
        }
    }

    return {
        user: formatAdminUserRow(user),
        stats,
        recentOrders: recentOrders.map((order) => ({
            orderId: order.id,
            status: order.status,
            totalAmount: Number(order.totalAmount),
            warehouseName: order.fulfillmentWarehouse?.name ?? null,
            createdAt: order.createdAt.toISOString(),
        })),
    }
}

export async function createWarehouseManagerAccount(body, { actor } = {}) {
    if (!isPlainObject(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là đối tượng JSON.' }])
    }

    const allowed = ['username', 'password', 'fullName', 'email', 'warehouseId']
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }

    const username = typeof body.username === 'string' ? body.username.trim() : ''
    if (!USERNAME_REGEX.test(username)) {
        throw validationError([
            {
                field: 'username',
                reason: 'Tên đăng nhập phải dài 3–50 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.',
            },
        ])
    }

    const password = validatePasswordValue(body.password, 'password')
    const fullName = normalizeOptionalFullName(body.fullName, 'fullName') ?? null
    const email = normalizeOptionalEmail(body.email, 'email') ?? null
    const warehouseId = parsePositiveIntId(body.warehouseId, 'warehouseId')
    const passwordHash = await hashPassword(password)

    return runInTransaction(async (tx) => {
        const [warehouse, existingUsername, existingEmail] = await Promise.all([
            tx.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, code: true, name: true },
            }),
            tx.user.findUnique({ where: { username }, select: { id: true } }),
            email
                ? tx.user.findFirst({ where: { email }, select: { id: true } })
                : Promise.resolve(null),
        ])

        if (!warehouse) {
            throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho được chọn.')
        }
        if (existingUsername) {
            throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Tên đăng nhập đã được sử dụng.')
        }
        if (existingEmail) {
            throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Địa chỉ email này đã được sử dụng.')
        }

        try {
            const created = await tx.user.create({
                data: {
                    username,
                    passwordHash,
                    fullName,
                    email,
                    emailVerifiedAt: email ? new Date() : null,
                    role: 'WAREHOUSE_MANAGER',
                    assignedWarehouseId: warehouse.id,
                    isActive: true,
                },
                select: USER_LIST_SELECT,
            })

            await writeAdminAuditLog(tx, {
                actor,
                action: AuditAction.USER_CREATE_MANAGER,
                targetType: AuditTargetType.USER,
                targetId: created.id,
                warehouseId: warehouse.id,
                summary: `Tạo tài khoản Quản lý kho @${created.username} phụ trách ${warehouse.name}`,
                metadata: {
                    username: created.username,
                    warehouseId: warehouse.id,
                    warehouseName: warehouse.name,
                },
            })

            return { user: formatAdminUserRow(created) }
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError(
                    ErrorCodes.ACCOUNT_EXISTS,
                    'Tên đăng nhập hoặc email đã được sử dụng.'
                )
            }
            throw error
        }
    })
}

export async function updateAdminUserAccount(rawUserId, body, { actor } = {}) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    if (!isPlainObject(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là đối tượng JSON.' }])
    }

    const allowed = ['fullName', 'email', 'warehouseId']
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }
    if (Object.keys(body).length === 0) {
        throw validationError([{ field: 'body', reason: 'Cần ít nhất một trường để cập nhật.' }])
    }

    const fullName = normalizeOptionalFullName(body.fullName, 'fullName')
    const email = normalizeOptionalEmail(body.email, 'email')
    const warehouseId =
        body.warehouseId === undefined
            ? undefined
            : parsePositiveIntId(body.warehouseId, 'warehouseId')

    return runInTransaction(async (tx) => {
        const locked = await tx.$queryRaw`
            SELECT id FROM users WHERE id = ${userId} FOR UPDATE
        `
        if (locked.length === 0) {
            throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
        }

        const existing = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                role: true,
                assignedWarehouseId: true,
            },
        })

        assertMutableTargetUser(existing, actor)

        const updateData = {}
        if (fullName !== undefined) updateData.fullName = fullName
        if (email !== undefined) {
            if (email && email !== existing.email) {
                const dup = await tx.user.findFirst({
                    where: { email, NOT: { id: userId } },
                    select: { id: true },
                })
                if (dup) {
                    throw new AppError(
                        ErrorCodes.ACCOUNT_EXISTS,
                        'Địa chỉ email này đã thuộc về tài khoản khác.'
                    )
                }
            }
            updateData.email = email
            updateData.emailVerifiedAt = email ? new Date() : null
        }

        let warehouseName = null
        if (warehouseId !== undefined) {
            if (existing.role !== 'WAREHOUSE_MANAGER') {
                throw new AppError(
                    ErrorCodes.INVALID_USER_ROLE,
                    'Chỉ có thể phân công kho cho tài khoản Quản lý kho.'
                )
            }
            const warehouse = await tx.warehouse.findUnique({
                where: { id: warehouseId },
                select: { id: true, name: true },
            })
            if (!warehouse) {
                throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho được chọn.')
            }
            updateData.assignedWarehouseId = warehouse.id
            warehouseName = warehouse.name
        }

        try {
            const updated = await tx.user.update({
                where: { id: userId },
                data: updateData,
                select: USER_LIST_SELECT,
            })

            await writeAdminAuditLog(tx, {
                actor,
                action: AuditAction.USER_UPDATE,
                targetType: AuditTargetType.USER,
                targetId: updated.id,
                warehouseId: updated.assignedWarehouseId ?? null,
                summary: `Cập nhật thông tin tài khoản @${updated.username}`,
                metadata: {
                    updatedFields: Object.keys(updateData),
                    ...(warehouseName ? { warehouseName } : {}),
                },
            })

            return { user: formatAdminUserRow(updated) }
        } catch (error) {
            if (isUniqueViolation(error)) {
                throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Địa chỉ email đã được sử dụng.')
            }
            throw error
        }
    })
}

export async function setAdminUserActiveStatus(rawUserId, body, { actor } = {}) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    if (!isPlainObject(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là đối tượng JSON.' }])
    }

    const allowed = ['isActive', 'reason']
    const unknown = Object.keys(body).filter((key) => !allowed.includes(key))
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }

    if (typeof body.isActive !== 'boolean') {
        throw validationError([{ field: 'isActive', reason: 'Trạng thái isActive phải là true hoặc false.' }])
    }

    let reason = null
    if (body.reason !== undefined && body.reason !== null) {
        if (typeof body.reason !== 'string' || body.reason.trim().length > 200) {
            throw validationError([{ field: 'reason', reason: 'Lý do tối đa 200 ký tự.' }])
        }
        reason = body.reason.trim() || null
    }

    return runInTransaction(async (tx) => {
        const locked = await tx.$queryRaw`
            SELECT id FROM users WHERE id = ${userId} FOR UPDATE
        `
        if (locked.length === 0) {
            throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
        }

        const existing = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: USER_LIST_SELECT,
        })

        assertMutableTargetUser(existing, actor)

        if (existing.isActive === body.isActive) {
            return { user: formatAdminUserRow(existing), changed: false }
        }

        const updated = await tx.user.update({
            where: { id: userId },
            data: { isActive: body.isActive },
            select: USER_LIST_SELECT,
        })

        const actionLabel = body.isActive ? 'Mở khóa' : 'Khóa'
        await writeAdminAuditLog(tx, {
            actor,
            action: body.isActive ? AuditAction.USER_UNLOCK : AuditAction.USER_LOCK,
            targetType: AuditTargetType.USER,
            targetId: updated.id,
            warehouseId: updated.assignedWarehouseId ?? null,
            summary: `${actionLabel} tài khoản @${updated.username}${reason ? `: ${reason}` : ''}`,
            metadata: {
                role: updated.role,
                isActive: body.isActive,
                ...(reason ? { reason } : {}),
            },
        })

        return { user: formatAdminUserRow(updated), changed: true }
    })
}

export async function resetAdminUserPassword(rawUserId, body, { actor } = {}) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    if (!isPlainObject(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là đối tượng JSON.' }])
    }

    const unknown = Object.keys(body).filter((key) => key !== 'newPassword')
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }

    const newPassword = validatePasswordValue(body.newPassword, 'newPassword')
    const passwordHash = await hashPassword(newPassword)

    return runInTransaction(async (tx) => {
        const locked = await tx.$queryRaw`
            SELECT id FROM users WHERE id = ${userId} FOR UPDATE
        `
        if (locked.length === 0) {
            throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
        }

        const existing = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: { id: true, username: true, role: true, assignedWarehouseId: true },
        })

        assertMutableTargetUser(existing, actor)

        await tx.user.update({
            where: { id: userId },
            data: { passwordHash },
        })

        await writeAdminAuditLog(tx, {
            actor,
            action: AuditAction.USER_RESET_PASSWORD,
            targetType: AuditTargetType.USER,
            targetId: existing.id,
            warehouseId: existing.assignedWarehouseId ?? null,
            summary: `Đặt lại mật khẩu cho tài khoản @${existing.username}`,
            metadata: {
                role: existing.role,
                resetBy: actor?.username ?? null,
            },
        })

        return { userId: existing.id, username: existing.username }
    })
}

export async function deleteOrAnonymizeAdminUser(rawUserId, { mode = 'delete', actor } = {}) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    if (mode !== 'delete' && mode !== 'anonymize') {
        throw validationError([
            { field: 'mode', reason: 'Chế độ xóa phải là delete hoặc anonymize.' },
        ])
    }

    return runInTransaction(async (tx) => {
        const locked = await tx.$queryRaw`
            SELECT id FROM users WHERE id = ${userId} FOR UPDATE
        `
        if (locked.length === 0) {
            throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
        }

        const existing = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: USER_LIST_SELECT,
        })

        assertMutableTargetUser(existing, actor)

        const counts = existing._count ?? {}
        const orderCount = counts.orders ?? 0
        const otherCount =
            (counts.movements ?? 0) +
            (counts.trackingEvents ?? 0) +
            (counts.auditLogs ?? 0) +
            (counts.idempotencyKeys ?? 0)
        const totalDependencies = orderCount + otherCount

        if (totalDependencies === 0 && mode === 'delete') {
            try {
                if (existing.email && tx.registrationOtp?.deleteMany) {
                    await tx.registrationOtp.deleteMany({ where: { email: existing.email } })
                }
                await tx.user.delete({ where: { id: userId } })

                await writeAdminAuditLog(tx, {
                    actor,
                    action: AuditAction.USER_DELETE,
                    targetType: AuditTargetType.USER,
                    targetId: userId,
                    warehouseId: existing.assignedWarehouseId ?? null,
                    summary: `Xóa vĩnh viễn tài khoản @${existing.username} (${existing.role})`,
                    metadata: {
                        username: existing.username,
                        role: existing.role,
                        mode: 'DELETED',
                    },
                })

                return { userId, mode: 'DELETED' }
            } catch (error) {
                if (isForeignKeyViolation(error)) {
                    throw new AppError(
                        ErrorCodes.USER_HAS_DEPENDENCIES,
                        'Tài khoản đã phát sinh dữ liệu lịch sử nên không thể xóa vĩnh viễn. Vui lòng Khóa hoặc chọn Xóa mềm (ẩn danh hóa).'
                    )
                }
                throw error
            }
        }

        if (mode !== 'anonymize') {
            throw new AppError(
                ErrorCodes.USER_HAS_DEPENDENCIES,
                `Tài khoản @${existing.username} đã có ${orderCount} đơn hàng và ${otherCount} bản ghi nghiệp vụ nên không thể xóa vĩnh viễn để bảo toàn lịch sử. Vui lòng chọn Khóa tài khoản hoặc Xóa mềm (ẩn danh hóa).`
            )
        }

        if (tx.wishlistItem?.deleteMany) {
            await tx.wishlistItem.deleteMany({ where: { userId } })
        }
        if (existing.email && tx.registrationOtp?.deleteMany) {
            await tx.registrationOtp.deleteMany({ where: { email: existing.email } })
        }

        const anonymizedUsername = `deleted_${existing.id}`
        const invalidatedHash = await hashPassword(`deleted_${existing.id}_${Date.now()}`)

        const updated = await tx.user.update({
            where: { id: userId },
            data: {
                username: anonymizedUsername,
                fullName: 'Tài khoản đã xóa',
                email: null,
                emailVerifiedAt: null,
                passwordHash: invalidatedHash,
                isActive: false,
            },
            select: USER_LIST_SELECT,
        })

        await writeAdminAuditLog(tx, {
            actor,
            action: AuditAction.USER_ANONYMIZE,
            targetType: AuditTargetType.USER,
            targetId: userId,
            warehouseId: updated.assignedWarehouseId ?? null,
            summary: `Xóa mềm (ẩn danh hóa) tài khoản @${existing.username} → @${anonymizedUsername}`,
            metadata: {
                previousUsername: existing.username,
                anonymizedUsername,
                role: existing.role,
                orderCount,
                otherCount,
            },
        })

        return {
            userId,
            mode: 'ANONYMIZED',
            user: formatAdminUserRow(updated),
        }
    })
}
