import crypto from 'node:crypto'
import { Router } from 'express'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { sendContactSupportEmail } from '../../services/mailer.js'

const ALLOWED_TOPICS = Object.freeze([
  'Tư vấn sản phẩm',
  'Kiểm tra & hỗ trợ đơn hàng',
  'Bảo hành & Đổi trả',
  'Mã giảm giá & Thanh toán',
  'Hợp tác / Khiếu nại khác',
])

const WAREHOUSE_LABELS = Object.freeze({
  HCM: 'Kho HCM Mega SOC (TP. Hồ Chí Minh)',
  HN: 'Kho BN A/B Mega SOC (Bắc Ninh — Miền Bắc)',
  DN: 'Kho Đà Nẵng SOC (TP. Đà Nẵng)',
})

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_REGEX = /^[0-9+\-\s().]{8,20}$/

const RATE_WINDOW_MS = 10 * 60 * 1000
const RATE_MAX_REQUESTS = 5
const rateBucket = new Map()

function checkContactRateLimit(ip) {
  const now = Date.now()
  const key = String(ip || 'unknown')
  const entries = (rateBucket.get(key) || []).filter((ts) => now - ts < RATE_WINDOW_MS)
  if (entries.length >= RATE_MAX_REQUESTS) {
    throw new AppError(
      ErrorCodes.TOO_MANY_REQUESTS,
      'Bạn đã gửi quá nhiều yêu cầu liên hệ. Vui lòng thử lại sau vài phút.'
    )
  }
  entries.push(now)
  rateBucket.set(key, entries)
}

export function validateContactBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw validationError([{ field: 'body', reason: 'Dữ liệu gửi lên không hợp lệ.' }])
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const phone = typeof body.phone === 'string' ? body.phone.trim() : ''
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const warehouseCode = typeof body.warehouseCode === 'string' ? body.warehouseCode.trim().toUpperCase() : ''
  const orderCode = typeof body.orderCode === 'string' ? body.orderCode.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''

  const errors = []
  if (fullName.length < 2 || fullName.length > 120) {
    errors.push({ field: 'fullName', reason: 'Họ tên phải từ 2 đến 120 ký tự.' })
  }
  if (!EMAIL_REGEX.test(email) || email.length > 120) {
    errors.push({ field: 'email', reason: 'Địa chỉ email không hợp lệ.' })
  }
  if (phone && !PHONE_REGEX.test(phone)) {
    errors.push({ field: 'phone', reason: 'Số điện thoại không hợp lệ.' })
  }
  if (!ALLOWED_TOPICS.includes(topic)) {
    errors.push({ field: 'topic', reason: 'Vui lòng chọn chủ đề hỗ trợ hợp lệ.' })
  }
  if (warehouseCode && !WAREHOUSE_LABELS[warehouseCode]) {
    errors.push({ field: 'warehouseCode', reason: 'Mã kho không hợp lệ.' })
  }
  if (orderCode.length > 32) {
    errors.push({ field: 'orderCode', reason: 'Mã đơn hàng tối đa 32 ký tự.' })
  }
  if (message.length < 10 || message.length > 2000) {
    errors.push({ field: 'message', reason: 'Nội dung liên hệ phải từ 10 đến 2000 ký tự.' })
  }

  if (errors.length > 0) {
    throw validationError(errors)
  }

  return {
    fullName,
    email,
    phone,
    topic,
    warehouseCode: warehouseCode || null,
    warehouseName: warehouseCode ? WAREHOUSE_LABELS[warehouseCode] : '',
    orderCode,
    message,
  }
}

const router = Router()

router.post('/', async (req, res, next) => {
  try {
    checkContactRateLimit(req.ip)
    const input = validateContactBody(req.body)
    const referenceCode = `CSKH-${crypto.randomBytes(3).toString('hex').toUpperCase()}`

    const mailResult = await sendContactSupportEmail({
      referenceCode,
      ...input,
    })

    return res.status(201).json({
      success: true,
      data: {
        referenceCode,
        delivery: mailResult.delivery,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    next(error)
  }
})

export default router
