import { createServer } from 'node:http'
import express from 'express'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { sendMailMock, txMock, prismaMock, runInTransaction } = vi.hoisted(() => {
    const txMock = {
        $queryRaw: vi.fn(),
        registrationOtp: {
            update: vi.fn(),
        },
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
    }

    const prismaMock = {
        user: {
            findUnique: vi.fn(),
            findFirst: vi.fn(),
            create: vi.fn(),
        },
        registrationOtp: {
            findFirst: vi.fn(),
            count: vi.fn(),
            updateMany: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
        },
    }

    return {
        sendMailMock: vi.fn(),
        txMock,
        prismaMock,
        runInTransaction: vi.fn(),
    }
})

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../src/db/transaction.js', () => ({ runInTransaction }))
vi.mock('../../src/services/mailer.js', async () => {
    const actual = await vi.importActual('../../src/services/mailer.js')
    return {
        ...actual,
        sendRegistrationOtpEmail: sendMailMock,
    }
})
vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import authRoutes from '../../src/modules/auth/auth.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { formatFromHeader, readSmtpConfig, shouldLogOtpToConsole } from '../../src/services/mailer.js'
import {
    deriveDefaultUsernameFromGmail,
    hashOtpCode,
    OTP_MAX_VERIFY_ATTEMPTS,
    requestRegistrationOtp,
    verifyOtpHash,
    verifyRegistrationOtpAndCreateUser,
} from '../../src/modules/auth/otp.service.js'
import { verifyUserCredentials, hashPassword } from '../../src/modules/auth/user.repository.js'
import { ErrorCodes } from '../../src/shared/errors.js'
import { apiRequest } from '../../../src/services/apiClient.js'
import {
    requestRegisterOtpApi,
    verifyRegisterOtpApi,
} from '../../../src/services/authApi.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use(errorHandler)

const server = createServer(app)
let apiUrl
let originalJwtSecret

beforeAll(async () => {
    originalJwtSecret = process.env.JWT_SECRET
    process.env.JWT_SECRET = 'test-otp-jwt-secret'
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
    sendMailMock.mockResolvedValue({ delivery: 'email' })
})

afterEach(() => vi.clearAllMocks())

describe('Gmail OTP registration service', () => {
    it('derives default username from prefix before @gmail.com and supports dots', () => {
        expect(deriveDefaultUsernameFromGmail('duyan746@gmail.com')).toBe('duyan746')
        expect(deriveDefaultUsernameFromGmail('Duy.An746@Gmail.com')).toBe('duy_an746')
        expect(deriveDefaultUsernameFromGmail('')).toBe('')
    })

    it('rejects non-gmail addresses and duplicate email/username before sending OTP', async () => {
        await expect(
            requestRegistrationOtp(prismaMock, {
                email: 'duyan746@yahoo.com',
                password: 'strong-pass-123',
            })
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })

        prismaMock.user.findUnique.mockResolvedValueOnce(null)
        prismaMock.user.findFirst.mockResolvedValueOnce({ id: 9 })

        await expect(
            requestRegistrationOtp(prismaMock, {
                email: 'duyan746@gmail.com',
                password: 'strong-pass-123',
            })
        ).rejects.toMatchObject({ code: ErrorCodes.ACCOUNT_EXISTS })
        expect(sendMailMock).not.toHaveBeenCalled()
    })

    it('enforces 60s resend cooldown and stores hashed 6-digit OTP with 3-minute TTL', async () => {
        const now = new Date('2026-11-27T10:00:00.000Z')
        prismaMock.user.findUnique.mockResolvedValue(null)
        prismaMock.user.findFirst.mockResolvedValue(null)
        prismaMock.registrationOtp.findFirst.mockResolvedValueOnce(null)
        prismaMock.registrationOtp.count.mockResolvedValueOnce(0)
        prismaMock.registrationOtp.create.mockResolvedValueOnce({ id: 1 })

        const res = await requestRegistrationOtp(
            prismaMock,
            {
                email: 'duyan746@gmail.com',
                password: 'strong-pass-123',
            },
            { now }
        )

        expect(res).toEqual({
            email: 'duyan746@gmail.com',
            username: 'duyan746',
            expiresInSeconds: 180,
            cooldownSeconds: 60,
            delivery: 'email',
        })
        expect(sendMailMock).toHaveBeenCalledTimes(1)
        const mailArg = sendMailMock.mock.calls[0][0]
        expect(mailArg.to).toBe('duyan746@gmail.com')
        expect(mailArg.username).toBe('duyan746')
        expect(mailArg.code).toMatch(/^\d{6}$/)
        expect(mailArg.ttlSeconds).toBe(180)

        const createdData = prismaMock.registrationOtp.create.mock.calls[0][0].data
        expect(createdData.codeHash).not.toBe(mailArg.code)
        expect(
            verifyOtpHash({
                email: 'duyan746@gmail.com',
                code: mailArg.code,
                expectedHash: createdData.codeHash,
            })
        ).toBe(true)
        expect(createdData.expiresAt.getTime() - now.getTime()).toBe(180_000)

        // Cooldown: request 20s later -> TOO_MANY_REQUESTS (429)
        prismaMock.registrationOtp.findFirst.mockResolvedValueOnce({
            id: 1,
            createdAt: now,
            consumedAt: null,
        })
        prismaMock.registrationOtp.count.mockResolvedValueOnce(1)

        await expect(
            requestRegistrationOtp(
                prismaMock,
                {
                    email: 'duyan746@gmail.com',
                    password: 'strong-pass-123',
                },
                { now: new Date(now.getTime() + 20_000) }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.TOO_MANY_REQUESTS, httpStatus: 429 })
    })

    it('creates verified customer account with custom username when OTP matches within 3 minutes', async () => {
        const now = new Date('2026-11-27T10:02:00.000Z')
        const codeHash = hashOtpCode({ email: 'duyan746@gmail.com', code: '654321' })

        txMock.$queryRaw.mockResolvedValueOnce([
            {
                id: 15,
                codeHash,
                expiresAt: new Date('2026-11-27T10:03:00.000Z'),
                consumedAt: null,
                attempts: 0,
            },
        ])
        txMock.user.findUnique.mockResolvedValueOnce(null)
        txMock.user.findFirst.mockResolvedValueOnce(null)
        txMock.user.create.mockImplementationOnce(async ({ data }) => ({
            id: 50,
            ...data,
            isActive: true,
        }))

        const result = await verifyRegistrationOtpAndCreateUser(
            prismaMock,
            {
                email: 'duyan746@gmail.com',
                username: 'custom_duyan',
                fullName: 'Duy An',
                password: 'strong-pass-123',
                otp: '654321',
            },
            { now }
        )

        expect(result.user).toMatchObject({
            id: 50,
            username: 'custom_duyan',
            email: 'duyan746@gmail.com',
            fullName: 'Duy An',
            role: 'CUSTOMER',
        })
        expect(txMock.registrationOtp.update).toHaveBeenCalledWith({
            where: { id: 15 },
            data: { consumedAt: now },
        })
    })

    it('rejects expired OTPs and tracks failed attempts until max attempts', async () => {
        const now = new Date('2026-11-27T10:04:00.000Z')
        const codeHash = hashOtpCode({ email: 'duyan746@gmail.com', code: '654321' })

        // Expired OTP
        txMock.$queryRaw.mockResolvedValueOnce([
            {
                id: 16,
                codeHash,
                expiresAt: new Date('2026-11-27T10:03:00.000Z'),
                consumedAt: null,
                attempts: 0,
            },
        ])

        await expect(
            verifyRegistrationOtpAndCreateUser(
                prismaMock,
                {
                    email: 'duyan746@gmail.com',
                    username: 'duyan746',
                    password: 'strong-pass-123',
                    otp: '654321',
                },
                { now }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })
        expect(txMock.registrationOtp.update).toHaveBeenCalledWith({
            where: { id: 16 },
            data: { consumedAt: now },
        })

        // Wrong OTP on attempt 5 consumes OTP
        txMock.$queryRaw.mockResolvedValueOnce([
            {
                id: 17,
                codeHash,
                expiresAt: new Date('2026-11-27T10:06:00.000Z'),
                consumedAt: null,
                attempts: OTP_MAX_VERIFY_ATTEMPTS - 1,
            },
        ])

        await expect(
            verifyRegistrationOtpAndCreateUser(
                prismaMock,
                {
                    email: 'duyan746@gmail.com',
                    username: 'duyan746',
                    password: 'strong-pass-123',
                    otp: '000000',
                },
                { now }
            )
        ).rejects.toMatchObject({ code: ErrorCodes.VALIDATION_ERROR })
        expect(txMock.registrationOtp.update).toHaveBeenCalledWith({
            where: { id: 17 },
            data: { attempts: OTP_MAX_VERIFY_ATTEMPTS, consumedAt: now },
        })
    })

    it('supports login by either username or verified Gmail address', async () => {
        const passwordHash = await hashPassword('strong-pass-123')
        prismaMock.user.findFirst.mockResolvedValueOnce({
            id: 50,
            username: 'duyan746',
            email: 'duyan746@gmail.com',
            emailVerifiedAt: new Date('2026-11-27T10:02:00.000Z'),
            fullName: 'Duy An',
            passwordHash,
            role: 'CUSTOMER',
            assignedWarehouseId: null,
            isActive: true,
        })

        const loggedIn = await verifyUserCredentials(prismaMock, {
            username: '  DuYan746@Gmail.com ',
            password: 'strong-pass-123',
        })

        expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
            where: { email: 'duyan746@gmail.com' },
        })
        expect(loggedIn).toMatchObject({
            id: 50,
            username: 'duyan746',
            email: 'duyan746@gmail.com',
            role: 'CUSTOMER',
        })
    })

    it('exposes /api/auth/register/request-otp and /verify-otp routes cleanly', async () => {
        prismaMock.user.findUnique.mockResolvedValueOnce(null)
        prismaMock.user.findFirst.mockResolvedValueOnce(null)
        prismaMock.registrationOtp.findFirst.mockResolvedValueOnce(null)
        prismaMock.registrationOtp.count.mockResolvedValueOnce(0)
        prismaMock.registrationOtp.create.mockResolvedValueOnce({ id: 21 })

        const reqOtpRes = await fetch(`${apiUrl}/api/auth/register/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'duyan746@gmail.com',
                password: 'strong-pass-123',
            }),
        })
        expect(reqOtpRes.status).toBe(200)
        await expect(reqOtpRes.json()).resolves.toMatchObject({
            success: true,
            data: {
                email: 'duyan746@gmail.com',
                username: 'duyan746',
                expiresInSeconds: 180,
            },
        })
    })

    it('normalizes Google App Passwords with spaces and detects SMTP readiness', () => {
        expect(
            readSmtpConfig({
                SMTP_USER: ' demo.otp@gmail.com ',
                SMTP_PASS: ' abcd efgh ijkl mnop ',
            })
        ).toEqual({
            host: 'smtp.gmail.com',
            port: 465,
            user: 'demo.otp@gmail.com',
            pass: 'abcdefghijklmnop',
            from: 'demo.otp@gmail.com',
            configured: true,
        })

        expect(readSmtpConfig({ SMTP_USER: '', SMTP_PASS: '' }).configured).toBe(false)
    })

    it('formats SMTP_FROM cleanly without double wrapping and auto-enables terminal OTP log outside production', () => {
        expect(formatFromHeader('demo@gmail.com')).toBe('"Multi-Warehouse" <demo@gmail.com>')
        expect(formatFromHeader('Multi-Warehouse <demo@gmail.com>')).toBe(
            'Multi-Warehouse <demo@gmail.com>'
        )

        expect(shouldLogOtpToConsole({})).toBe(true)
        expect(shouldLogOtpToConsole({ NODE_ENV: 'development' })).toBe(true)
        expect(shouldLogOtpToConsole({ NODE_ENV: 'production' })).toBe(false)
        expect(shouldLogOtpToConsole({ NODE_ENV: 'production', OTP_LOG_TO_CONSOLE: 'true' })).toBe(true)
        expect(shouldLogOtpToConsole({ NODE_ENV: 'development', OTP_LOG_TO_CONSOLE: 'false' })).toBe(false)
    })
})

describe('Frontend Auth OTP API client', () => {
    it('calls request-otp and verify-otp endpoints', async () => {
        apiRequest.mockResolvedValue({ ok: true })

        await requestRegisterOtpApi({
            email: 'duyan746@gmail.com',
            username: 'duyan746',
            password: 'strong-pass-123',
            fullName: 'Duy An',
        })
        expect(apiRequest).toHaveBeenCalledWith('/api/auth/register/request-otp', {
            method: 'POST',
            body: {
                email: 'duyan746@gmail.com',
                username: 'duyan746',
                password: 'strong-pass-123',
                fullName: 'Duy An',
            },
        })

        await verifyRegisterOtpApi({
            email: 'duyan746@gmail.com',
            username: 'duyan746',
            password: 'strong-pass-123',
            otp: '123456',
        })
        expect(apiRequest).toHaveBeenCalledWith('/api/auth/register/verify-otp', {
            method: 'POST',
            body: {
                email: 'duyan746@gmail.com',
                username: 'duyan746',
                password: 'strong-pass-123',
                otp: '123456',
            },
        })
    })
})
