import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { txMock, prismaMock, runInTransaction } = vi.hoisted(() => {
    const txMock = {
        $queryRaw: vi.fn(),
        warehouse: {
            findUnique: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findUniqueOrThrow: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn(),
        },
        wishlistItem: {
            deleteMany: vi.fn(),
        },
        registrationOtp: {
            deleteMany: vi.fn(),
        },
        adminAuditLog: {
            create: vi.fn(),
        },
    }

    const prismaMock = {
        $transaction: vi.fn((ops) => Promise.all(ops)),
        user: {
            findMany: vi.fn(),
            count: vi.fn(),
            findUnique: vi.fn(),
            update: vi.fn(),
        },
        warehouse: {
            findMany: vi.fn(),
        },
        order: {
            findMany: vi.fn(),
        },
    }

    return {
        txMock,
        prismaMock,
        runInTransaction: vi.fn(),
    }
})

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))
vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import adminAccountsRoutes from '../../src/modules/auth/admin-accounts.routes.js'
import authRoutes from '../../src/modules/auth/auth.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { AuditAction } from '../../src/modules/audit/audit.repository.js'
import {
    createWarehouseManagerAccount,
    deleteOrAnonymizeAdminUser,
    resetAdminUserPassword,
    setAdminUserActiveStatus,
    updateAdminUserAccount,
} from '../../src/modules/auth/admin-accounts.service.js'
import { hashPassword } from '../../src/modules/auth/user.repository.js'
import { ErrorCodes } from '../../src/shared/errors.js'
import { apiRequest } from '../../../src/services/apiClient.js'
import {
    deleteAdminUserApi,
    getAdminUsersApi,
    setAdminUserStatusApi,
} from '../../../src/services/adminUserApi.js'
import { changePasswordApi, updateProfileApi } from '../../../src/services/authApi.js'

const JWT_SECRET = 'test-admin-user-management-secret'
const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use('/api/admin/users', adminAccountsRoutes)
app.use(errorHandler)

const server = createServer(app)
let apiUrl
let originalJwtSecret

function signToken(userId) {
    return jwt.sign({}, JWT_SECRET, {
        algorithm: 'HS256',
        subject: String(userId),
        expiresIn: '1h',
    })
}

const makeUserRow = (overrides = {}) => ({
    id: 21,
    username: 'khach01',
    fullName: 'Nguyễn Văn A',
    email: 'khach01@gmail.com',
    emailVerifiedAt: new Date('2026-11-27T08:00:00.000Z'),
    role: 'CUSTOMER',
    assignedWarehouseId: null,
    assignedWarehouse: null,
    isActive: true,
    createdAt: new Date('2026-11-27T08:00:00.000Z'),
    updatedAt: new Date('2026-11-27T08:00:00.000Z'),
    _count: {
        orders: 0,
        wishlistItems: 1,
        movements: 0,
        trackingEvents: 0,
        auditLogs: 0,
        idempotencyKeys: 0,
    },
    ...overrides,
})

beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = JWT_SECRET
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
    if (originalJwtSecret === undefined) delete process.env.JWT_SECRET
    else process.env.JWT_SECRET = originalJwtSecret
    await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
    )
})

beforeEach(() => {
    vi.clearAllMocks()
    runInTransaction.mockImplementation((work) => work(txMock))
    prismaMock.$transaction.mockImplementation((ops) => Promise.all(ops))
})

afterEach(() => vi.clearAllMocks())

describe('Admin user account management service', () => {
    const adminActor = { id: 1, username: 'admin', role: 'ADMIN' }

    it('creates a Warehouse Manager account with warehouse binding and audit log', async () => {
        txMock.warehouse.findUnique.mockResolvedValueOnce({ id: 2, code: 'HN', name: 'Kho Hà Nội' })
        txMock.user.findUnique.mockResolvedValueOnce(null)
        txMock.user.findFirst.mockResolvedValueOnce(null)
        txMock.user.create.mockResolvedValueOnce(
            makeUserRow({
                id: 30,
                username: 'kho_hn_2',
                role: 'WAREHOUSE_MANAGER',
                assignedWarehouseId: 2,
                assignedWarehouse: { id: 2, code: 'HN', name: 'Kho Hà Nội' },
            })
        )

        const res = await createWarehouseManagerAccount(
            {
                username: 'kho_hn_2',
                password: 'manager-password-123',
                fullName: 'Quản lý kho HN',
                email: 'khohn2@gmail.com',
                warehouseId: 2,
            },
            { actor: adminActor }
        )

        expect(res.user.username).toBe('kho_hn_2')
        expect(res.user.assignedWarehouseId).toBe(2)
        expect(txMock.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: AuditAction.USER_CREATE_MANAGER,
                targetId: 30,
                warehouseId: 2,
            }),
        })
    })

    it('blocks Admin from modifying, locking, resetting, or deleting self or other ADMIN accounts', async () => {
        txMock.$queryRaw.mockResolvedValue([{ id: 1 }])
        txMock.user.findUniqueOrThrow.mockResolvedValue(
            makeUserRow({ id: 1, username: 'admin', role: 'ADMIN' })
        )

        await expect(
            setAdminUserActiveStatus(1, { isActive: false }, { actor: adminActor })
        ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN })

        await expect(
            deleteOrAnonymizeAdminUser(1, { mode: 'delete', actor: adminActor })
        ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN })

        await expect(
            updateAdminUserAccount(1, { fullName: 'X' }, { actor: adminActor })
        ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN })
    })

    it('locks and unlocks a customer account and logs the reason', async () => {
        txMock.$queryRaw.mockResolvedValueOnce([{ id: 21 }])
        txMock.user.findUniqueOrThrow.mockResolvedValueOnce(makeUserRow({ isActive: true }))
        txMock.user.update.mockResolvedValueOnce(makeUserRow({ isActive: false }))

        const res = await setAdminUserActiveStatus(
            21,
            { isActive: false, reason: 'Tài khoản nghi ngờ gian lận' },
            { actor: adminActor }
        )

        expect(res.changed).toBe(true)
        expect(res.user.isActive).toBe(false)
        expect(txMock.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                action: AuditAction.USER_LOCK,
                targetId: 21,
            }),
        })
    })

    it('resets password securely without recording password in audit log metadata', async () => {
        txMock.$queryRaw.mockResolvedValueOnce([{ id: 21 }])
        txMock.user.findUniqueOrThrow.mockResolvedValueOnce({
            id: 21,
            username: 'khach01',
            role: 'CUSTOMER',
            assignedWarehouseId: null,
        })

        const res = await resetAdminUserPassword(
            21,
            { newPassword: 'new-strong-password' },
            { actor: adminActor }
        )

        expect(res).toEqual({ userId: 21, username: 'khach01' })
        const updateArg = txMock.user.update.mock.calls[0][0]
        expect(updateArg.data.passwordHash).not.toBe('new-strong-password')
        const auditArg = txMock.adminAuditLog.create.mock.calls[0][0].data
        expect(auditArg.action).toBe(AuditAction.USER_RESET_PASSWORD)
        expect(JSON.stringify(auditArg.metadata)).not.toContain('new-strong-password')
    })

    it('hard-deletes clean users, blocks hard-delete when orders exist, and supports anonymize mode', async () => {
        // 1. Clean user -> hard delete succeeds
        txMock.$queryRaw.mockResolvedValueOnce([{ id: 21 }])
        txMock.user.findUniqueOrThrow.mockResolvedValueOnce(makeUserRow())

        const deleted = await deleteOrAnonymizeAdminUser(21, {
            mode: 'delete',
            actor: adminActor,
        })
        expect(deleted).toEqual({ userId: 21, mode: 'DELETED' })
        expect(txMock.registrationOtp.deleteMany).toHaveBeenCalledWith({
            where: { email: 'khach01@gmail.com' },
        })
        expect(txMock.user.delete).toHaveBeenCalledWith({ where: { id: 21 } })

        // 2. User with orders -> hard delete blocked with 409 USER_HAS_DEPENDENCIES
        txMock.$queryRaw.mockResolvedValueOnce([{ id: 22 }])
        txMock.user.findUniqueOrThrow.mockResolvedValueOnce(
            makeUserRow({
                id: 22,
                username: 'buyer01',
                email: 'buyer01@gmail.com',
                _count: {
                    orders: 3,
                    wishlistItems: 2,
                    movements: 0,
                    trackingEvents: 0,
                    auditLogs: 0,
                    idempotencyKeys: 3,
                },
            })
        )

        await expect(
            deleteOrAnonymizeAdminUser(22, { mode: 'delete', actor: adminActor })
        ).rejects.toMatchObject({ code: ErrorCodes.USER_HAS_DEPENDENCIES, httpStatus: 409 })

        // 3. User with orders + mode='anonymize' -> anonymizes user, frees email, preserves FK
        txMock.$queryRaw.mockResolvedValueOnce([{ id: 22 }])
        txMock.user.findUniqueOrThrow.mockResolvedValueOnce(
            makeUserRow({
                id: 22,
                username: 'buyer01',
                email: 'buyer01@gmail.com',
                _count: {
                    orders: 3,
                    wishlistItems: 2,
                    movements: 0,
                    trackingEvents: 0,
                    auditLogs: 0,
                    idempotencyKeys: 3,
                },
            })
        )
        txMock.user.update.mockResolvedValueOnce(
            makeUserRow({
                id: 22,
                username: 'deleted_22',
                fullName: 'Tài khoản đã xóa',
                email: null,
                emailVerifiedAt: null,
                isActive: false,
            })
        )

        const anonymized = await deleteOrAnonymizeAdminUser(22, {
            mode: 'anonymize',
            actor: adminActor,
        })
        expect(anonymized.mode).toBe('ANONYMIZED')
        expect(anonymized.user.username).toBe('deleted_22')
        expect(anonymized.user.email).toBeNull()
        expect(anonymized.user.isActive).toBe(false)
        expect(txMock.wishlistItem.deleteMany).toHaveBeenCalledWith({ where: { userId: 22 } })
        expect(txMock.adminAuditLog.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ action: AuditAction.USER_ANONYMIZE, targetId: 22 }),
        })
    })
})

describe('Admin user routes RBAC & self-service profile/password routes', () => {
    it('enforces ADMIN-only access on /api/admin/users', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 2,
            username: 'warehouse',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
            isActive: true,
        })

        const forbiddenRes = await fetch(`${apiUrl}/api/admin/users`, {
            headers: { Authorization: `Bearer ${signToken(2)}` },
        })
        expect(forbiddenRes.status).toBe(403)
    })

    it('lets an authenticated user update own fullName and change own password', async () => {
        const currentHash = await hashPassword('old-password-123')
        prismaMock.user.findUnique.mockResolvedValueOnce({
            id: 21,
            username: 'khach01',
            fullName: 'Cũ',
            role: 'CUSTOMER',
            assignedWarehouseId: null,
            isActive: true,
        })
        prismaMock.user.update.mockResolvedValueOnce({
            id: 21,
            username: 'khach01',
            fullName: 'Tên Mới',
            role: 'CUSTOMER',
            assignedWarehouseId: null,
            isActive: true,
            email: 'khach01@gmail.com',
            emailVerifiedAt: new Date('2026-11-27T08:00:00.000Z'),
        })

        const profileRes = await fetch(`${apiUrl}/api/auth/profile`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(21)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ fullName: '  Tên Mới  ' }),
        })
        expect(profileRes.status).toBe(200)
        await expect(profileRes.json()).resolves.toMatchObject({
            success: true,
            data: { user: { fullName: 'Tên Mới' } },
        })

        // Wrong current password -> 401
        prismaMock.user.findUnique
            .mockResolvedValueOnce({
                id: 21,
                username: 'khach01',
                role: 'CUSTOMER',
                assignedWarehouseId: null,
                isActive: true,
            })
            .mockResolvedValueOnce({
                id: 21,
                passwordHash: currentHash,
                isActive: true,
            })

        const badPassRes = await fetch(`${apiUrl}/api/auth/password`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(21)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentPassword: 'wrong-password',
                newPassword: 'new-password-456',
            }),
        })
        expect(badPassRes.status).toBe(401)

        // Correct current password -> 200
        prismaMock.user.findUnique
            .mockResolvedValueOnce({
                id: 21,
                username: 'khach01',
                role: 'CUSTOMER',
                assignedWarehouseId: null,
                isActive: true,
            })
            .mockResolvedValueOnce({
                id: 21,
                passwordHash: currentHash,
                isActive: true,
            })
        prismaMock.user.update.mockResolvedValueOnce({ id: 21 })

        const okPassRes = await fetch(`${apiUrl}/api/auth/password`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${signToken(21)}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                currentPassword: 'old-password-123',
                newPassword: 'new-password-456',
            }),
        })
        expect(okPassRes.status).toBe(200)
    })

    it('calls admin user and self-service profile frontend clients properly', async () => {
        apiRequest.mockResolvedValue({ ok: true })
        await getAdminUsersApi('adm', { role: 'CUSTOMER', status: 'ACTIVE', search: 'an' })
        expect(apiRequest).toHaveBeenCalledWith(
            '/api/admin/users?page=1&limit=20&role=CUSTOMER&status=ACTIVE&search=an',
            { token: 'adm', signal: undefined }
        )

        await setAdminUserStatusApi('adm', 21, { isActive: false, reason: 'spam' })
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/users/21/status', {
            method: 'PATCH',
            token: 'adm',
            body: { isActive: false, reason: 'spam' },
        })

        await deleteAdminUserApi('adm', 22, { mode: 'anonymize' })
        expect(apiRequest).toHaveBeenCalledWith('/api/admin/users/22?mode=anonymize', {
            method: 'DELETE',
            token: 'adm',
        })

        await updateProfileApi('usr', { fullName: 'Duy An' })
        expect(apiRequest).toHaveBeenCalledWith('/api/auth/profile', {
            method: 'PATCH',
            token: 'usr',
            body: { fullName: 'Duy An' },
        })

        await changePasswordApi('usr', {
            currentPassword: 'old-password',
            newPassword: 'new-password',
        })
        expect(apiRequest).toHaveBeenCalledWith('/api/auth/password', {
            method: 'PATCH',
            token: 'usr',
            body: { currentPassword: 'old-password', newPassword: 'new-password' },
        })
    })
})
