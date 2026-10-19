// M3 - Nguyễn Anh Quân: Tầng lưu trữ người dùng & kiểm tra mật khẩu bcrypt.
// Truy vết: SR-AUTH-01..05, NFR-SEC-01, NFR-SEC-04..05.

import bcrypt from 'bcryptjs'

const BCRYPT_ROUNDS = 10

function toSafeUser(user) {
    if (!user) return null
    return {
        id: user.id,
        username: user.username,
        fullName: user.fullName ?? null,
        role: user.role,
        assignedWarehouseId: user.assignedWarehouseId ?? null,
        isActive: user.isActive,
    }
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
 * SR-AUTH-01, SR-AUTH-02, SR-AUTH-05: Xác thực tài khoản bằng username + password (bcrypt).
 * Trả về thông tin user đã loại bỏ `passwordHash`, kèm `role` và `assignedWarehouseId`.
 */
export async function verifyUserCredentials(client, { username, password }) {
    if (typeof username !== 'string' || typeof password !== 'string') {
        return null
    }

    const user = await client.user.findUnique({
        where: { username: username.trim() },
    })

    if (!user || !user.isActive) {
        return null
    }

    const matched = await verifyPassword(password, user.passwordHash)
    return matched ? toSafeUser(user) : null
}
