import prisma from '../../db/prisma.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { parsePositiveIntId } from '../order/order.validator.js'

const ALLOWED_STATUSES = Object.freeze(['OPEN', 'REPLIED', 'CLOSED'])

const ORDER_STATUS_VI = Object.freeze({
  PendingPayment: 'Chờ thanh toán',
  Paid: 'Đã thanh toán',
  Processing: 'Đang xử lý',
  Completed: 'Hoàn tất',
  Cancelled: 'Đã hủy',
})

export function validateMessageContent(raw) {
  const content = typeof raw === 'string' ? raw.trim() : ''
  if (content.length < 1 || content.length > 1000) {
    throw validationError([
      { field: 'content', reason: 'Nội dung tin nhắn phải từ 1 đến 1000 ký tự.' },
    ])
  }
  return content
}

export async function generateAutoBotReply(
  { topic = '', query = '' } = {},
  { customerId = null, client = prisma } = {}
) {
  let normalizedTopic = String(topic || '').trim().toUpperCase()
  let normalizedQuery = String(query || '').trim()

  // Tự nhận diện chủ đề khi khách tự gõ hoặc chỉnh nhẹ câu mẫu
  if (!normalizedTopic && normalizedQuery) {
    const qLower = normalizedQuery.toLowerCase()
    if (qLower.includes('chính sách') || qLower.includes('bảo hành') || qLower.includes('hủy đơn')) {
      normalizedTopic = 'POLICY'
    } else if (qLower.includes('mã giảm giá') || qLower.includes('voucher') || qLower.includes('vòng quay')) {
      normalizedTopic = 'VOUCHERS'
    } else if (qLower.includes('địa chỉ') || qLower.includes('3 kho') || qLower.includes('chi nhánh')) {
      normalizedTopic = 'WAREHOUSES'
    } else if (qLower.includes('đơn hàng')) {
      normalizedTopic = 'ORDERS'
    } else if (qLower.includes('sản phẩm nổi bật')) {
      normalizedTopic = 'PRODUCTS'
      normalizedQuery = ''
    }
  }

  if (normalizedTopic === 'POLICY') {
    return {
      topic: 'POLICY',
      reply:
        'Chính sách Multi-Warehouse:\n' +
        '• Xử lý đơn đa kho: Mỗi đơn hàng được chọn 1 kho gần/đủ hàng nhất (HCM, Hà Nội, Đà Nẵng) giao trọn gói.\n' +
        '• Giữ chỗ tồn kho: Tự động giữ hàng 15 phút khi chờ thanh toán.\n' +
        '• Hủy đơn & hoàn mã: Khách tự hủy khi đơn Chờ thanh toán hoặc Đã thanh toán; tồn kho và mã giảm giá còn hạn sẽ hoàn trả ngay.\n' +
        '• Bảo hành: 12 tháng chính hãng, đổi trả trong 7 ngày nếu lỗi nhà sản xuất.',
    }
  }

  if (normalizedTopic === 'VOUCHERS') {
    return {
      topic: 'VOUCHERS',
      reply:
        'Ưu đãi & Mã giảm giá:\n' +
        '• Bạn có thể bấm nút Vòng quay 7 màu ở góc màn hình để quay mã giảm 5% – 20% tổng giá trị đơn hàng.\n' +
        '• Xem lại toàn bộ mã và bật lại vòng quay (nếu lỡ tắt) tại Menu trái → Mã giảm giá.\n' +
        '• Áp dụng trực tiếp mã tại bước Xác nhận đơn hàng (Checkout).',
    }
  }

  if (normalizedTopic === 'WAREHOUSES') {
    return {
      topic: 'WAREHOUSES',
      reply:
        'Hệ thống 3 trung tâm kho vận của Multi-Warehouse:\n' +
        '1. Miền Bắc (HN) — Kho BN A/B Mega SOC: KCN VSIP, Từ Sơn, Bắc Ninh.\n' +
        '2. Miền Trung (DN) — Kho Đà Nẵng SOC: KCN Hòa Cầm, Cẩm Lệ, Đà Nẵng.\n' +
        '3. Miền Nam (HCM) — Kho HCM Mega SOC: KCN Tân Phú Trung, Củ Chi, TP. HCM.\n' +
        'Bạn có thể xem bản đồ chi tiết tại mục Liên hệ trên thanh menu.',
    }
  }

  if (normalizedTopic === 'ORDERS') {
    if (!customerId) {
      return {
        topic: 'ORDERS',
        reply:
          'Vui lòng đăng nhập tài khoản khách hàng để trợ lý tự động tra cứu trạng thái các đơn hàng gần nhất của bạn.',
      }
    }

    const orders = await client.order.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      include: { fulfillmentWarehouse: { select: { name: true } } },
    })

    if (!orders.length) {
      return {
        topic: 'ORDERS',
        reply:
          'Tài khoản của bạn hiện chưa có đơn hàng nào. Hãy thêm sản phẩm vào giỏ và trải nghiệm đặt hàng nhé!',
      }
    }

    const lines = orders.map(
      (o) =>
        `• Đơn #${o.id}: ${ORDER_STATUS_VI[o.status] || o.status} — ${Number(
          o.totalAmount
        ).toLocaleString('vi-VN')} VNĐ (${o.fulfillmentWarehouse?.name || 'Đa kho'})`
    )
    return {
      topic: 'ORDERS',
      reply: `3 đơn hàng gần nhất của bạn:\n${lines.join('\n')}\nNếu cần hỗ trợ thêm, hãy bấm "Chat với Quản lý kho".`,
    }
  }

  if (normalizedTopic === 'PRODUCTS' || normalizedQuery) {
    const where = {
      isActive: true,
      ...(normalizedQuery
        ? {
            OR: [
              { name: { contains: normalizedQuery, mode: 'insensitive' } },
              { category: { contains: normalizedQuery, mode: 'insensitive' } },
            ],
          }
        : {}),
    }

    const products = await client.product.findMany({
      where,
      take: 4,
      orderBy: { id: 'asc' },
      select: { id: true, name: true, price: true, category: true },
    })

    if (!products.length) {
      return {
        topic: 'PRODUCTS',
        reply: `Mình chưa tìm thấy sản phẩm khớp với "${normalizedQuery}". Bạn có thể gõ từ khóa khác (ví dụ: MacBook, Dell, Logitech, Keychron) hoặc bấm "Chat với Quản lý kho" để được tư vấn trực tiếp.`,
      }
    }

    const lines = products.map(
      (p) =>
        `• ${p.name} (${p.category}) — ${Number(p.price).toLocaleString('vi-VN')} VNĐ`
    )
    return {
      topic: 'PRODUCTS',
      reply:
        (normalizedQuery
          ? `Sản phẩm phù hợp với "${normalizedQuery}":\n`
          : 'Một số sản phẩm nổi bật đang kinh doanh:\n') +
        lines.join('\n') +
        '\nBạn có thể gõ tên sản phẩm muốn tìm hoặc chuyển sang chat trực tiếp với Quản lý kho.',
    }
  }

  return {
    topic: 'GENERAL',
    reply:
      'Xin chào! Mình là Trợ lý tự động Multi-Warehouse. Bạn hãy chọn một chủ đề nhanh (Chính sách, Sản phẩm, Đơn hàng, Mã giảm giá) hoặc chọn "Chat với Quản lý kho" để trao đổi trực tiếp với nhân viên kho nhé!',
  }
}

function formatMessage(m) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    senderType: m.senderType,
    senderUserId: m.senderUserId ?? null,
    senderName: m.sender?.fullName || m.sender?.username || (m.senderType === 'BOT' ? 'Trợ lý tự động' : null),
    content: m.content,
    createdAt: new Date(m.createdAt).toISOString(),
  }
}

function formatConversationSummary(conv) {
  const lastMsg = conv.messages?.[0] || null
  return {
    id: conv.id,
    customerId: conv.customerId,
    customerUsername: conv.customer?.username ?? '',
    customerFullName: conv.customer?.fullName ?? null,
    customerEmail: conv.customer?.email ?? null,
    warehouseId: conv.warehouseId,
    warehouseCode: conv.warehouse?.code ?? '',
    warehouseName: conv.warehouse?.name ?? `Kho #${conv.warehouseId}`,
    status: conv.status,
    unreadByStaff: conv.unreadByStaff ?? 0,
    unreadByCustomer: conv.unreadByCustomer ?? 0,
    lastMessageAt: new Date(conv.lastMessageAt).toISOString(),
    lastMessagePreview: lastMsg ? lastMsg.content : '',
    lastSenderType: lastMsg ? lastMsg.senderType : null,
  }
}

export async function getCustomerConversation(
  customerId,
  rawWarehouseId = 1,
  { markRead = false, client = prisma } = {}
) {
  const warehouseId = parsePositiveIntId(rawWarehouseId, 'warehouseId')
  const warehouse = await client.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, code: true, name: true },
  })
  if (!warehouse) {
    throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho hàng.')
  }

  const conv = await client.supportConversation.findUnique({
    where: {
      customerId_warehouseId: {
        customerId,
        warehouseId,
      },
    },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      customer: { select: { id: true, username: true, fullName: true, email: true } },
      messages: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { sender: { select: { username: true, fullName: true } } },
      },
    },
  })

  if (!conv) {
    return {
      conversation: null,
      warehouse,
      messages: [],
    }
  }

  if (markRead && conv.unreadByCustomer > 0) {
    await client.supportConversation.update({
      where: { id: conv.id },
      data: { unreadByCustomer: 0 },
    })
    conv.unreadByCustomer = 0
  }

  return {
    conversation: formatConversationSummary(conv),
    warehouse,
    messages: conv.messages.map(formatMessage),
  }
}

export async function getCustomerUnreadSummary(customerId, client = prisma) {
  const rows = await client.supportConversation.findMany({
    where: { customerId },
    select: { warehouseId: true, unreadByCustomer: true },
  })
  const totalUnread = rows.reduce((sum, r) => sum + (r.unreadByCustomer || 0), 0)
  return { totalUnread, byWarehouse: rows }
}

export async function sendCustomerMessage(
  customerId,
  { warehouseId: rawWarehouseId = 1, content: rawContent },
  client = prisma
) {
  const warehouseId = parsePositiveIntId(rawWarehouseId, 'warehouseId')
  const content = validateMessageContent(rawContent)

  const warehouse = await client.warehouse.findUnique({
    where: { id: warehouseId },
    select: { id: true, code: true, name: true },
  })
  if (!warehouse) {
    throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho hàng.')
  }

  const now = new Date()
  const conv = await client.supportConversation.upsert({
    where: {
      customerId_warehouseId: { customerId, warehouseId },
    },
    create: {
      customerId,
      warehouseId,
      status: 'OPEN',
      unreadByStaff: 1,
      unreadByCustomer: 0,
      lastMessageAt: now,
    },
    update: {
      status: 'OPEN',
      unreadByStaff: { increment: 1 },
      unreadByCustomer: 0,
      lastMessageAt: now,
    },
    include: {
      warehouse: { select: { id: true, code: true, name: true } },
      customer: { select: { id: true, username: true, fullName: true, email: true } },
    },
  })

  const message = await client.supportMessage.create({
    data: {
      conversationId: conv.id,
      senderType: 'CUSTOMER',
      senderUserId: customerId,
      content,
    },
    include: { sender: { select: { username: true, fullName: true } } },
  })

  return {
    conversation: formatConversationSummary(conv),
    message: formatMessage(message),
  }
}

function assertStaffScope(actor, warehouseId) {
  if (actor.role === 'ADMIN') return
  if (
    actor.role === 'WAREHOUSE_MANAGER' &&
    Number(actor.assignedWarehouseId) === Number(warehouseId)
  ) {
    return
  }
  throw new AppError(
    ErrorCodes.FORBIDDEN,
    'Bạn chỉ được xem và trả lời tin nhắn thuộc kho mình phụ trách.'
  )
}

export async function listStaffConversations(
  actor,
  { warehouseId: rawWarehouseId, status } = {},
  client = prisma
) {
  const where = {}

  if (actor.role === 'WAREHOUSE_MANAGER') {
    if (!actor.assignedWarehouseId) {
      throw new AppError(ErrorCodes.FORBIDDEN, 'Tài khoản quản lý kho chưa được phân công kho.')
    }
    where.warehouseId = Number(actor.assignedWarehouseId)
  } else if (rawWarehouseId !== undefined && rawWarehouseId !== '' && rawWarehouseId !== 'ALL') {
    where.warehouseId = parsePositiveIntId(rawWarehouseId, 'warehouseId')
  }

  if (status && status !== 'ALL') {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw validationError([{ field: 'status', reason: 'Trạng thái hội thoại không hợp lệ.' }])
    }
    where.status = status
  }

  const conversations = await client.supportConversation.findMany({
    where,
    orderBy: [{ unreadByStaff: 'desc' }, { lastMessageAt: 'desc' }],
    include: {
      customer: { select: { id: true, username: true, fullName: true, email: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      messages: {
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
      },
    },
  })

  const totalUnread = conversations.reduce((sum, c) => sum + (c.unreadByStaff || 0), 0)
  return {
    conversations: conversations.map(formatConversationSummary),
    totalUnread,
  }
}

export async function getStaffConversationDetail(actor, rawId, client = prisma) {
  const conversationId = parsePositiveIntId(rawId, 'conversationId')
  const conv = await client.supportConversation.findUnique({
    where: { id: conversationId },
    include: {
      customer: { select: { id: true, username: true, fullName: true, email: true } },
      warehouse: { select: { id: true, code: true, name: true } },
      messages: {
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        include: { sender: { select: { username: true, fullName: true } } },
      },
    },
  })

  if (!conv) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy cuộc hội thoại.')
  }

  assertStaffScope(actor, conv.warehouseId)

  if (conv.unreadByStaff > 0) {
    await client.supportConversation.update({
      where: { id: conv.id },
      data: { unreadByStaff: 0 },
    })
    conv.unreadByStaff = 0
  }

  return {
    conversation: formatConversationSummary(conv),
    messages: conv.messages.map(formatMessage),
  }
}

export async function sendStaffReply(actor, rawId, rawContent, client = prisma) {
  const conversationId = parsePositiveIntId(rawId, 'conversationId')
  const content = validateMessageContent(rawContent)

  const existing = await client.supportConversation.findUnique({
    where: { id: conversationId },
  })
  if (!existing) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy cuộc hội thoại.')
  }

  assertStaffScope(actor, existing.warehouseId)

  const now = new Date()
  const message = await client.supportMessage.create({
    data: {
      conversationId,
      senderType: 'STAFF',
      senderUserId: actor.id,
      content,
    },
    include: { sender: { select: { username: true, fullName: true } } },
  })

  const updated = await client.supportConversation.update({
    where: { id: conversationId },
    data: {
      status: 'REPLIED',
      unreadByStaff: 0,
      unreadByCustomer: { increment: 1 },
      lastMessageAt: now,
    },
    include: {
      customer: { select: { id: true, username: true, fullName: true, email: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })

  return {
    conversation: formatConversationSummary(updated),
    message: formatMessage(message),
  }
}

export async function updateStaffConversationStatus(actor, rawId, status, client = prisma) {
  const conversationId = parsePositiveIntId(rawId, 'conversationId')
  if (!ALLOWED_STATUSES.includes(status)) {
    throw validationError([{ field: 'status', reason: 'Trạng thái hội thoại không hợp lệ.' }])
  }

  const existing = await client.supportConversation.findUnique({
    where: { id: conversationId },
  })
  if (!existing) {
    throw new AppError(ErrorCodes.ORDER_NOT_FOUND, 'Không tìm thấy cuộc hội thoại.')
  }

  assertStaffScope(actor, existing.warehouseId)

  const updated = await client.supportConversation.update({
    where: { id: conversationId },
    data: { status, unreadByStaff: 0 },
    include: {
      customer: { select: { id: true, username: true, fullName: true, email: true } },
      warehouse: { select: { id: true, code: true, name: true } },
    },
  })

  return { conversation: formatConversationSummary(updated) }
}
