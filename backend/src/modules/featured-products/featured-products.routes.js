import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import {
    listPublicFeaturedSlides,
    listAdminFeaturedSlides,
    replaceAdminFeaturedSlides,
} from './featured-products.service.js'

const handle = (fn) => async (req, res, next) => {
    try {
        await fn(req, res)
    } catch (e) {
        next(e)
    }
}

export const publicFeaturedRoutes = Router()

publicFeaturedRoutes.get(
    '/',
    handle(async (req, res) => {
        const slides = await listPublicFeaturedSlides()
        res.set('Cache-Control', 'no-store').json({
            success: true,
            data: { slides },
        })
    })
)

export const adminFeaturedRoutes = Router()

adminFeaturedRoutes.use(requireAuth, requireRole('ADMIN'))

adminFeaturedRoutes.get(
    '/',
    handle(async (req, res) => {
        const slides = await listAdminFeaturedSlides()
        res.set('Cache-Control', 'no-store').json({
            success: true,
            data: { slides },
        })
    })
)

adminFeaturedRoutes.put(
    '/',
    handle(async (req, res) => {
        const slides = await replaceAdminFeaturedSlides(req.body)
        res.set('Cache-Control', 'no-store').json({
            success: true,
            data: { slides },
        })
    })
)

