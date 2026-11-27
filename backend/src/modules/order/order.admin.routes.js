import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { transitionAdminOrderToProcessing } from './order.admin.service.js'
import { addAdminOrderTrackingEvent } from './order.tracking.service.js'
import { listAdminOrders } from './order.query.service.js'
import { validateAdminOrderStatusBody } from './order.validator.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN', 'WAREHOUSE_MANAGER'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

function resolveOrderWarehouseScope(user) {
    if (user.role === 'ADMIN') return undefined
    if (!user.assignedWarehouseId) {
        throw new AppError(ErrorCodes.FORBIDDEN, 'Tài khoản chưa được phân công kho.')
    }
    return user.assignedWarehouseId
}

router.get('/', async (req, res, next) => {
    try {
        const warehouseId = resolveOrderWarehouseScope(req.user)
        const data = await listAdminOrders(req.query, { warehouseId })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

router.patch('/:orderId/status', async (req, res, next) => {
    try {
        const warehouseId = resolveOrderWarehouseScope(req.user)
        validateAdminOrderStatusBody(req.body)
        const data = await transitionAdminOrderToProcessing(req.params.orderId, {
            warehouseId,
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

router.post('/:orderId/tracking', async (req, res, next) => {
    try {
        const warehouseId = resolveOrderWarehouseScope(req.user)
        const data = await addAdminOrderTrackingEvent(req.params.orderId, req.body, {
            warehouseId,
            actor: req.user,
        })
        return res.status(201).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

export default router
