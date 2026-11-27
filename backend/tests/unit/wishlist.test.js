import { createServer } from 'node:http'
import express from 'express'
import jwt from 'jsonwebtoken'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
        product: {
            findUnique: vi.fn(),
        },
        wishlistItem: {
            findMany: vi.fn(),
            upsert: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
}))

vi.mock('../../src/db/prisma.js', () => ({ default: prismaMock }))
vi.mock('../../../src/services/apiClient.js', () => ({
    apiRequest: vi.fn(),
}))

import wishlistRoutes from '../../src/modules/wishlist/wishlist.routes.js'
import { errorHandler } from '../../src/middlewares/errorHandler.js'
import { ErrorCodes } from '../../src/shared/errors.js'
import { apiRequest } from '../../../src/services/apiClient.js'
import {
    addWishlistItemApi,
    getWishlistApi,
    removeWishlistItemApi,
} from '../../../src/services/wishlistApi.js'

const JWT_SECRET = 'test-wishlist-secret'
const app = express()
app.use(express.json())
app.use('/api/wishlist', wishlistRoutes)
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
    prismaMock.user.findUnique.mockResolvedValue({
        id: 1,
        username: 'customer',
        fullName: 'Customer',
        role: 'CUSTOMER',
        assignedWarehouseId: null,
        isActive: true,
    })
})

afterEach(() => vi.clearAllMocks())

describe('Wishlist backend API', () => {
    it('requires authentication on GET /api/wishlist', async () => {
        const res = await fetch(`${apiUrl}/api/wishlist`)
        expect(res.status).toBe(401)
    })

    it('lists active wishlist product IDs scoped to the authenticated user', async () => {
        prismaMock.wishlistItem.findMany.mockResolvedValue([
            { productId: 9 },
            { productId: 4 },
        ])

        const res = await fetch(`${apiUrl}/api/wishlist`, {
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(res.status).toBe(200)
        expect(prismaMock.wishlistItem.findMany).toHaveBeenCalledWith({
            where: { userId: 1, product: { isActive: true } },
            select: { productId: true },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        })
        await expect(res.json()).resolves.toEqual({
            success: true,
            data: { productIds: [9, 4] },
        })
    })

    it('rejects inactive or missing products and upserts active products on POST', async () => {
        prismaMock.product.findUnique.mockResolvedValueOnce({ id: 5, isActive: false })

        const inactiveRes = await fetch(`${apiUrl}/api/wishlist/5`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(inactiveRes.status).toBe(409)
        await expect(inactiveRes.json()).resolves.toMatchObject({
            success: false,
            error: { code: ErrorCodes.PRODUCT_UNAVAILABLE },
        })

        prismaMock.product.findUnique.mockResolvedValueOnce({ id: 5, isActive: true })
        prismaMock.wishlistItem.findMany.mockResolvedValueOnce([{ productId: 5 }])

        const okRes = await fetch(`${apiUrl}/api/wishlist/5`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(okRes.status).toBe(200)
        expect(prismaMock.wishlistItem.upsert).toHaveBeenCalledWith({
            where: { userId_productId: { userId: 1, productId: 5 } },
            create: { userId: 1, productId: 5 },
            update: {},
        })
        await expect(okRes.json()).resolves.toEqual({
            success: true,
            data: { productIds: [5] },
        })
    })

    it('removes wishlist items idempotently on DELETE and validates productId', async () => {
        const invalidRes = await fetch(`${apiUrl}/api/wishlist/abc`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(invalidRes.status).toBe(400)

        prismaMock.wishlistItem.findMany.mockResolvedValueOnce([])
        const res = await fetch(`${apiUrl}/api/wishlist/5`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${signToken(1)}` },
        })
        expect(res.status).toBe(200)
        expect(prismaMock.wishlistItem.deleteMany).toHaveBeenCalledWith({
            where: { userId: 1, productId: 5 },
        })
        await expect(res.json()).resolves.toEqual({
            success: true,
            data: { productIds: [] },
        })
    })
})

describe('Wishlist API frontend client', () => {
    it('calls GET, POST, and DELETE wishlist endpoints cleanly', async () => {
        const signal = new AbortController().signal
        apiRequest.mockResolvedValue({ productIds: [3] })

        await expect(getWishlistApi('tok', { signal })).resolves.toEqual({ productIds: [3] })
        expect(apiRequest).toHaveBeenCalledWith('/api/wishlist', { token: 'tok', signal })

        await addWishlistItemApi('tok', 3)
        expect(apiRequest).toHaveBeenCalledWith('/api/wishlist/3', { method: 'POST', token: 'tok' })

        await removeWishlistItemApi('tok', 3)
        expect(apiRequest).toHaveBeenCalledWith('/api/wishlist/3', { method: 'DELETE', token: 'tok' })
    })
})
