import { createServer } from 'node:http'
import express from 'express'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('../../src/db/prisma.js', () => ({
    default: {
        user: {
            findUnique: vi.fn(),
            create: vi.fn(),
        },
    },
}))

import prisma from '../../src/db/prisma.js'
import authRoutes from '../../src/modules/auth/auth.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { verifyPassword } from '../../src/modules/auth/user.repository.js'

const app = express()
app.use(express.json())
app.use('/api/auth', authRoutes)
app.use(errorHandler)

const server = createServer(app)
let apiUrl

async function register(body) {
    return fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
}

beforeAll(async () => {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
    apiUrl = `http://127.0.0.1:${server.address().port}`
})

afterAll(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
})

afterEach(() => vi.clearAllMocks())

describe('POST /api/auth/register', () => {
    it('creates a customer account, trims public fields, and never returns the password hash', async () => {
        prisma.user.findUnique.mockResolvedValue(null)
        prisma.user.create.mockImplementation(async ({ data }) => ({
            id: 41,
            ...data,
            isActive: true,
        }))

        const response = await register({
            username: '  new_customer  ',
            password: 'strong-pass-123',
            fullName: '  New Customer  ',
        })
        const body = await response.json()

        expect(response.status).toBe(201)
        expect(body).toMatchObject({
            success: true,
            data: { user: {
                id: 41,
                username: 'new_customer',
                fullName: 'New Customer',
                role: 'CUSTOMER',
                assignedWarehouseId: null,
                isActive: true,
            } },
        })
        expect(body.data.user).not.toHaveProperty('passwordHash')

        const createCall = prisma.user.create.mock.calls[0][0]
        expect(createCall.data.username).toBe('new_customer')
        expect(createCall.data.passwordHash).not.toBe('strong-pass-123')
        await expect(verifyPassword('strong-pass-123', createCall.data.passwordHash)).resolves.toBe(true)
    })

    it.each([
        ['username ngắn hơn giới hạn', { username: 'ab', password: 'strong-pass-123' }],
        ['password ngắn hơn giới hạn', { username: 'valid_user', password: 'short' }],
        ['fullName chỉ có khoảng trắng', { username: 'valid_user', password: 'strong-pass-123', fullName: '   ' }],
        ['trường ngoài hợp đồng', { username: 'valid_user', password: 'strong-pass-123', role: 'ADMIN' }],
    ])('rejects %s without writing a user', async (_caseName, body) => {
        const response = await register(body)
        const result = await response.json()

        expect(response.status).toBe(400)
        expect(result.error.code).toBe('VALIDATION_ERROR')
        expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('rejects a username that already exists', async () => {
        prisma.user.findUnique.mockResolvedValue({ id: 12 })

        const response = await register({ username: 'existing_user', password: 'strong-pass-123' })
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.error.code).toBe('ACCOUNT_EXISTS')
        expect(prisma.user.create).not.toHaveBeenCalled()
    })

    it('maps a concurrent unique-username conflict to ACCOUNT_EXISTS', async () => {
        prisma.user.findUnique.mockResolvedValue(null)
        prisma.user.create.mockRejectedValue({ code: 'P2002' })

        const response = await register({ username: 'racing_user', password: 'strong-pass-123' })
        const body = await response.json()

        expect(response.status).toBe(409)
        expect(body.error.code).toBe('ACCOUNT_EXISTS')
    })
})
