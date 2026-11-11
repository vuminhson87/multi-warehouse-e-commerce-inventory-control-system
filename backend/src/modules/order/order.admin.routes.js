import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { transitionAdminOrderToProcessing } from './order.admin.service.js'
import { listAdminOrders } from './order.query.service.js'
import { validateAdminOrderStatusBody } from './order.validator.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.get('/', async (req, res, next) => {
    try {
        const data = await listAdminOrders(req.query)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

router.patch('/:orderId/status', async (req, res, next) => {
    try {
        validateAdminOrderStatusBody(req.body)
        const data = await transitionAdminOrderToProcessing(req.params.orderId)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

export default router
