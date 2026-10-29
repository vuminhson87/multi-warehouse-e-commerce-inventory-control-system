
import { Router } from 'express'

import {
  requireAuth,
  requireRole,
} from '../../middlewares/requireAuth.js'

import { createCheckoutOrder } from './order.service.js'
import { payOrder } from '../payment/payment.service.js'
import { cancelCustomerOrder } from './order.cancel.service.js'

import {
  listCustomerOrders,
  getCustomerOrderDetail,
} from './order.query.service.js'

const router = Router()

router.use(requireAuth)
router.use(requireRole('CUSTOMER'))

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// UC04 - Tạo đơn hàng
router.post('/', async (req, res, next) => {
  try {
    const result = await createCheckoutOrder(
      req.user.id,
      req.body
    )

    return res.status(result.statusCode).json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    next(error)
  }
})

// UC10 - Danh sách và lịch sử đơn hàng
router.get('/', async (req, res, next) => {
  try {
    const data = await listCustomerOrders(
      req.user.id,
      req.query
    )

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
})

// UC09 - Xem chi tiết và trạng thái đơn hàng
router.get('/:orderId', async (req, res, next) => {
  try {
    const data = await getCustomerOrderDetail(
      req.user.id,
      req.params.orderId
    )

    return res.status(200).json({
      success: true,
      data,
    })
  } catch (error) {
    next(error)
  }
})

// UC04 - Thanh toán và retry
router.post('/:orderId/payments', async (req, res, next) => {
  try {
    const result = await payOrder(
      req.user.id,
      req.params.orderId,
      req.body
    )

    return res.status(result.statusCode).json(
      result.body
    )
  } catch (error) {
    next(error)
  }
})


 // UC11 - Customer hủy đơn hàng
router.post('/:orderId/cancel', async (req, res, next) => {
  try {
    const result = await cancelCustomerOrder(
      req.user.id,
      req.params.orderId,
      req.body
    )

    res.set('Cache-Control', 'no-store')

    return res.status(result.statusCode).json(
      result.body
    )
  } catch (error) {
    next(error)
  }
})

export default router
