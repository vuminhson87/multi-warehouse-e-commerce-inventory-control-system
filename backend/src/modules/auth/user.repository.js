// M3 - Nguyễn Anh Quân: Tầng lưu trữ người dùng & kiểm tra mật khẩu bcrypt.
// Truy vết: SR-AUTH-01..05, NFR-SEC-01, NFR-SEC-04..05.

import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

function toSafeUser(user) {
    if (!user) return null
    const safe = {
        id: user.id,
        username: user.username,
        fullName: user.fullName ?? null,
        role: user.role,
        assignedWarehouseId: user.assignedWarehouseId ?? null,
        isActive: user.isActive,
    }
    if (user.email !== undefined && user.email !== null) {
        safe.email = user.email
        safe.emailVerifiedAt =
            user.emailVerifiedAt instanceof Date
                ? user.emailVerifiedAt.toISOString()
                : (user.emailVerifiedAt ?? null)
    }
    return safe
}

export async function hashPassword(plainPassword) {
    return bcrypt.hash(String(plainPassword), BCRYPT_ROUNDS)
}

export async function verifyPassword(plainPassword, passwordHash) {
    if (typeof plainPassword !== 'string' || typeof passwordHash !== 'string') {
        return false
    }
    return bcrypt.compare(plainPassword, passwordHash)
}

export async function findUserById(client, userId) {
    const user = await client.user.findUnique({ where: { id: userId } })
    return user && user.isActive ? toSafeUser(user) : null
}

/**
 * SR-AUTH-01, SR-AUTH-02, SR-AUTH-05: Xác thực tài khoản bằng username hoặc Gmail + password (bcrypt).
 * Trả về thông tin user đã loại bỏ `passwordHash`, kèm `role` và `assignedWarehouseId`.
 */
export async function verifyUserCredentials(client, { username, password }) {
    if (typeof username !== 'string' || typeof password !== 'string') {
        return null
    }

    const identifier = username.trim()
    if (!identifier) {
        return null
    }

    let user
    if (identifier.includes('@')) {
        const normalizedEmail = identifier.toLowerCase()
        user = typeof client.user.findFirst === 'function'
            ? await client.user.findFirst({ where: { email: normalizedEmail } })
            : await client.user.findUnique({ where: { email: normalizedEmail } })
    } else {
        user = await client.user.findUnique({
            where: { username: identifier },
        })
    }

    if (!user || !user.isActive) {
        return null
    }

    const matched = await verifyPassword(password, user.passwordHash)
    return matched ? toSafeUser(user) : null
}

export function toSafeManager(user) {
    if (!user) return null
    return {
        ...toSafeUser(user),
        assignedWarehouse: user.assignedWarehouse
            ? {
                  id: user.assignedWarehouse.id,
                  code: user.assignedWarehouse.code,
                  name: user.assignedWarehouse.name,
              }
            : null,
    }
}

export async function listWarehouseManagers(client) {
    const managers = await client.user.findMany({
        where: { role: 'WAREHOUSE_MANAGER' },
        select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            assignedWarehouseId: true,
            isActive: true,
            assignedWarehouse: {
                select: { id: true, code: true, name: true },
            },
        },
        orderBy: { id: 'asc' },
    })

    return managers.map(toSafeManager)
}

export async function createCustomerAccount(
    client,
    { username, password, fullName = null, email = null, emailVerifiedAt = null }
) {
    const passwordHash = await hashPassword(password)
    const data = {
        username: username.trim(),
        passwordHash,
        fullName,
        role: 'CUSTOMER',
        assignedWarehouseId: null,
    }
    if (email !== null && email !== undefined) {
        data.email = String(email).trim().toLowerCase()
        data.emailVerifiedAt = emailVerifiedAt ?? new Date()
    }
    const user = await client.user.create({ data })
    return toSafeUser(user)
}
