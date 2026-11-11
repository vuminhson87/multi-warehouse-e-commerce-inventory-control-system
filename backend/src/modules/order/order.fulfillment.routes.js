import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { startWarehouseOrderProcessing } from './order.fulfillment.service.js'
import { validateWarehouseOrderStatusBody } from './order.validator.js'

const router = Router()

router.use(requireAuth, requireRole('WAREHOUSE_MANAGER'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.patch('/:orderId/status', async (req, res, next) => {
    try {
        validateWarehouseOrderStatusBody(req.body)
        const data = await startWarehouseOrderProcessing(req.user, req.params.orderId)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

export default router
