import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import {
  getWheelStatus,
  listUserVouchers,
  spinDemoGuestWheel,
  spinWelcomeWheel,
} from './wheel.service.js'

const router = Router()

router.get('/status', requireAuth, async (req, res, next) => {
  try {
    const data = await getWheelStatus(req.user.id)
    return res.json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
})

router.post('/spin', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const data = await spinWelcomeWheel(req.user.id)
    return res.status(201).json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
})

// Endpoint quay thử cho chế độ demo (khi chưa đăng nhập)
router.post('/demo-spin', (req, res, next) => {
  try {
    const data = spinDemoGuestWheel()
    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
})

router.get('/vouchers', requireAuth, async (req, res, next) => {
  try {
    const vouchers = await listUserVouchers(req.user.id)
    return res.json({
      success: true,
      data: { vouchers },
    })
  } catch (error) {
    next(error)
  }
})

export default router
