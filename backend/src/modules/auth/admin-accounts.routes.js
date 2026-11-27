import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import {
    createWarehouseManagerAccount,
    deleteOrAnonymizeAdminUser,
    getAdminUserDetail,
    listAdminUsers,
    resetAdminUserPassword,
    setAdminUserActiveStatus,
    updateAdminUserAccount,
} from './admin-accounts.service.js'

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.get('/', async (req, res, next) => {
    try {
        const data = await listAdminUsers(req.query)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.get('/:userId', async (req, res, next) => {
    try {
        const data = await getAdminUserDetail(req.params.userId)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.post('/warehouse-managers', async (req, res, next) => {
    try {
        const data = await createWarehouseManagerAccount(req.body, { actor: req.user })
        return res.status(201).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.patch('/:userId', async (req, res, next) => {
    try {
        const data = await updateAdminUserAccount(req.params.userId, req.body, {
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.patch('/:userId/status', async (req, res, next) => {
    try {
        const data = await setAdminUserActiveStatus(req.params.userId, req.body, {
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.post('/:userId/reset-password', async (req, res, next) => {
    try {
        const data = await resetAdminUserPassword(req.params.userId, req.body, {
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

router.delete('/:userId', async (req, res, next) => {
    try {
        const mode = req.query.mode === 'anonymize' ? 'anonymize' : 'delete'
        const data = await deleteOrAnonymizeAdminUser(req.params.userId, {
            mode,
            actor: req.user,
        })
        return res.status(200).json({ success: true, data })
    } catch (error) {
        return next(error)
    }
})

export default router
