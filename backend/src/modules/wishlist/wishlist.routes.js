import { Router } from 'express'
import prisma from '../../db/prisma.js'
import { requireAuth } from '../../middlewares/requireAuth.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import {
    addWishlistItem,
    listWishlistProductIds,
    removeWishlistItem,
} from './wishlist.repository.js'

const router = Router()

router.use(requireAuth)
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.get('/', async (req, res, next) => {
    try {
        const productIds = await listWishlistProductIds(prisma, req.user.id)
        return res.status(200).json({
            success: true,
            data: { productIds },
        })
    } catch (error) {
        next(error)
    }
})

router.post('/:productId', async (req, res, next) => {
    try {
        const productId = parsePositiveIntId(req.params.productId, 'productId')
        const productIds = await addWishlistItem(prisma, {
            userId: req.user.id,
            productId,
        })
        return res.status(200).json({
            success: true,
            data: { productIds },
        })
    } catch (error) {
        next(error)
    }
})

router.delete('/:productId', async (req, res, next) => {
    try {
        const productId = parsePositiveIntId(req.params.productId, 'productId')
        const productIds = await removeWishlistItem(prisma, {
            userId: req.user.id,
            productId,
        })
        return res.status(200).json({
            success: true,
            data: { productIds },
        })
    } catch (error) {
        next(error)
    }
})

export default router
