import { Router } from 'express'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import {
  generateAutoBotReply,
  getCustomerConversation,
  getCustomerUnreadSummary,
  getStaffConversationDetail,
  listStaffConversations,
  sendCustomerMessage,
  sendStaffReply,
  updateStaffConversationStatus,
} from './chat.service.js'

const router = Router()

// Chống spam tin nhắn: tối đa 20 tin / phút / user
const MSG_RATE_WINDOW_MS = 60 * 1000
const MSG_RATE_MAX = 20
const msgBuckets = new Map()

function enforceMessageRateLimit(key) {
  const now = Date.now()
  const arr = (msgBuckets.get(key) || []).filter((ts) => now - ts < MSG_RATE_WINDOW_MS)
  if (arr.length >= MSG_RATE_MAX) {
    throw new AppError(
      ErrorCodes.TOO_MANY_REQUESTS,
      'Bạn đang gửi tin nhắn quá nhanh. Vui lòng chờ giây lát.'
    )
  }
  arr.push(now)
  msgBuckets.set(key, arr)
}

// 1. Trợ lý tự động (công khai cho cả khách vãng lai; nếu có JWT thì đọc thêm đơn hàng)
router.post('/bot', async (req, res, next) => {
  try {
    const { topic, query } = req.body || {}
    const data = await generateAutoBotReply({ topic, query })
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// Phiên bản có đăng nhập để Bot tra cứu đơn hàng của chính khách
router.post('/bot/auth', requireAuth, async (req, res, next) => {
  try {
    const { topic, query } = req.body || {}
    const data = await generateAutoBotReply(
      { topic, query },
      { customerId: req.user.role === 'CUSTOMER' ? req.user.id : null }
    )
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// 2. Khách hàng xem số tin chưa đọc (nhẹ, dùng cho polling nền khi đóng hộp chat)
router.get('/customer/unread', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const data = await getCustomerUnreadSummary(req.user.id)
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// 3. Khách hàng lấy hội thoại với 1 kho cụ thể
router.get('/customer/conversation', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    const warehouseId = req.query.warehouseId || 1
    const markRead = req.query.markRead === 'true'
    const data = await getCustomerConversation(req.user.id, warehouseId, { markRead })
    return res.json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// 4. Khách hàng gửi tin nhắn cho Quản lý kho
router.post('/customer/messages', requireAuth, requireRole('CUSTOMER'), async (req, res, next) => {
  try {
    enforceMessageRateLimit(`cust:${req.user.id}`)
    const data = await sendCustomerMessage(req.user.id, req.body || {})
    return res.status(201).json({ success: true, data })
  } catch (error) {
    next(error)
  }
})

// 5. Quản lý kho / Admin xem danh sách hội thoại (tự khóa theo kho phụ trách nếu là WAREHOUSE_MANAGER)
router.get(
  '/staff/conversations',
  requireAuth,
  requireRole('WAREHOUSE_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await listStaffConversations(req.user, {
        warehouseId: req.query.warehouseId,
        status: req.query.status,
      })
      return res.json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }
)

// 6. Quản lý kho / Admin xem chi tiết tin nhắn 1 hội thoại
router.get(
  '/staff/conversations/:id',
  requireAuth,
  requireRole('WAREHOUSE_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await getStaffConversationDetail(req.user, req.params.id)
      return res.json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }
)

// 7. Quản lý kho / Admin trả lời khách hàng
router.post(
  '/staff/conversations/:id/reply',
  requireAuth,
  requireRole('WAREHOUSE_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      enforceMessageRateLimit(`staff:${req.user.id}`)
      const data = await sendStaffReply(req.user, req.params.id, req.body?.content)
      return res.status(201).json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }
)

// 8. Quản lý kho / Admin cập nhật trạng thái hội thoại (OPEN / REPLIED / CLOSED)
router.patch(
  '/staff/conversations/:id/status',
  requireAuth,
  requireRole('WAREHOUSE_MANAGER', 'ADMIN'),
  async (req, res, next) => {
    try {
      const data = await updateStaffConversationStatus(
        req.user,
        req.params.id,
        req.body?.status
      )
      return res.json({ success: true, data })
    } catch (error) {
      next(error)
    }
  }
)

export default router
