import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import {
    assignWarehouseToManager,
    listWarehouseManagerAssignments,
} from './admin-users.service.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.get('/', async (req, res, next) => {
    try {
        const data = await listWarehouseManagerAssignments()
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

router.patch('/:userId/warehouse', async (req, res, next) => {
    try {
        const data = await assignWarehouseToManager(req.params.userId, req.body, {
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

export default router
