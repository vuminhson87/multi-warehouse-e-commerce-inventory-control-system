import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getStaffConversationDetailApi,
  listStaffConversationsApi,
  sendStaffReplyApi,
  updateStaffConversationStatusApi,
} from '../services/chatApi.js'
import { formatDateTime } from '../constants/order'
import './StaffChatInboxPage.css'

const STATUS_LABELS = {
  OPEN: 'Chờ trả lời',
  REPLIED: 'Đã phản hồi',
  CLOSED: 'Đã đóng',
}

const CANNED_REPLIES = [
  'Chào bạn, kho đã tiếp nhận câu hỏi và đang kiểm tra thông tin giúp bạn nhé!',
  'Sản phẩm bạn quan tâm hiện đang có sẵn tại kho. Bạn có thể đặt hàng ngay trên website.',
  'Đơn hàng của bạn đang được kho đóng gói và sẽ sớm bàn giao cho đơn vị vận chuyển.',
]

function StaffChatInboxPage() {
  const { currentUser, token } = useAuth()
  const [conversations, setConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [activeConv, setActiveConv] = useState(null)
  const [messages, setMessages] = useState([])
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [warehouseFilter, setWarehouseFilter] = useState('ALL')
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)

  const endRef = useRef(null)
  const isAdmin = currentUser?.role === 'ADMIN'
  const canAccess =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'WAREHOUSE_MANAGER'

  // Tải danh sách hội thoại + Polling 3s khi tab đang hiển thị
  useEffect(() => {
    if (!token || !canAccess) return undefined
    let active = true
    const controller = new AbortController()

    const fetchList = () => {
      if (document.visibilityState !== 'visible') return
      listStaffConversationsApi(token, {
        warehouseId: isAdmin ? warehouseFilter : undefined,
        status: statusFilter,
        signal: controller.signal,
      })
        .then((data) => {
          if (!active) return
          const list = data?.conversations || []
          setConversations(list)
          setError('')
          setSelectedId((prev) => {
            if (prev && list.some((c) => c.id === prev)) return prev
            return list[0]?.id ?? null
          })
        })
        .catch((err) => {
          if (active && !controller.signal.aborted) {
            setError(err.message || 'Không thể tải danh sách tin nhắn.')
          }
        })
    }

    fetchList()
    const timer = setInterval(fetchList, 3000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [token, canAccess, isAdmin, warehouseFilter, statusFilter, revision])

  // Tải chi tiết hội thoại đang chọn + Polling 3s
  useEffect(() => {
    if (!token || !canAccess || !selectedId) {
      return undefined
    }
    let active = true
    const controller = new AbortController()

    const fetchDetail = () => {
      if (document.visibilityState !== 'visible') return
      getStaffConversationDetailApi(token, selectedId, { signal: controller.signal })
        .then((data) => {
          if (!active) return
          setActiveConv(data?.conversation || null)
          setMessages(data?.messages || [])
        })
        .catch(() => {})
    }

    fetchDetail()
    const timer = setInterval(fetchDetail, 3000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [token, canAccess, selectedId])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, selectedId])

  if (!currentUser) return <Navigate to="/login" replace />
  if (!canAccess) return <Navigate to="/" replace />

  async function handleSendReply(e) {
    e.preventDefault()
    const trimmed = replyText.trim()
    if (!trimmed || !selectedId || sending) return

    setSending(true)
    setError('')
    try {
      const data = await sendStaffReplyApi(token, selectedId, trimmed)
      setReplyText('')
      if (data?.message) setMessages((prev) => [...prev, data.message])
      if (data?.conversation) setActiveConv(data.conversation)
      setRevision((v) => v + 1)
    } catch (err) {
      setError(err.message || 'Không thể gửi tin nhắn phản hồi.')
    } finally {
      setSending(false)
    }
  }

  async function handleToggleStatus() {
    if (!activeConv || sending) return
    const nextStatus = activeConv.status === 'CLOSED' ? 'OPEN' : 'CLOSED'
    setSending(true)
    try {
      const data = await updateStaffConversationStatusApi(token, activeConv.id, nextStatus)
      if (data?.conversation) setActiveConv(data.conversation)
      setRevision((v) => v + 1)
    } catch (err) {
      setError(err.message || 'Không thể cập nhật trạng thái hội thoại.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="mgmt-page">
      <div className="mgmt-head">
        <div>
          <h1>Tin nhắn khách hàng</h1>
          <p>
            {isAdmin
              ? 'Theo dõi và trả lời trực tiếp tin nhắn hỗ trợ từ khách hàng trên cả 3 kho.'
              : 'Hộp thư trả lời trực tiếp tin nhắn từ khách hàng gửi đến kho bạn phụ trách.'}
          </p>
        </div>
        <div className="mgmt-head__actions">
          <button
            type="button"
            className="mgmt-btn mgmt-btn--ghost"
            onClick={() => setRevision((v) => v + 1)}
          >
            Làm mới
          </button>
        </div>
      </div>

      {error && (
        <div className="mgmt-alert mgmt-alert--danger" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="sci-grid">
        {/* Cột trái: danh sách hội thoại */}
        <section className="sci-list-card">
          <div className="sci-list-filters">
            <div className="sci-filter-row">
              <select
                className="sci-select"
                aria-label="Lọc trạng thái hội thoại"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="OPEN">Chờ trả lời</option>
                <option value="REPLIED">Đã phản hồi</option>
                <option value="CLOSED">Đã đóng</option>
              </select>

              {isAdmin && (
                <select
                  className="sci-select"
                  aria-label="Lọc theo kho"
                  value={warehouseFilter}
                  onChange={(e) => setWarehouseFilter(e.target.value)}
                >
                  <option value="ALL">Tất cả kho</option>
                  <option value="1">Kho TP. HCM</option>
                  <option value="2">Kho Hà Nội</option>
                  <option value="3">Kho Đà Nẵng</option>
                </select>
              )}
            </div>
          </div>

          <div className="sci-conv-list">
            {conversations.length === 0 ? (
              <div className="sci-empty">Chưa có tin nhắn nào từ khách hàng.</div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  className={`sci-conv-item${conv.id === selectedId ? ' is-active' : ''}`}
                  onClick={() => setSelectedId(conv.id)}
                >
                  <div className="sci-conv-top">
                    <span className="sci-conv-customer">
                      {conv.customerFullName || conv.customerUsername}
                    </span>
                    {conv.unreadByStaff > 0 && (
                      <span className="sci-conv-unread">{conv.unreadByStaff}</span>
                    )}
                  </div>
                  <div className="sci-conv-meta">
                    <span>{conv.warehouseName}</span>
                    <span>{STATUS_LABELS[conv.status] || conv.status}</span>
                  </div>
                  <div className="sci-conv-preview">
                    {conv.lastMessagePreview || 'Bắt đầu cuộc hội thoại'}
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* Cột phải: nội dung chat & phản hồi */}
        <section className="sci-thread-card">
          {!selectedId || !activeConv ? (
            <div className="sci-empty">
              Chọn một hội thoại bên trái để xem chi tiết và trả lời khách hàng.
            </div>
          ) : (
            <>
              <div className="sci-thread-head">
                <div>
                  <strong style={{ fontSize: 15 }}>
                    {activeConv.customerFullName || activeConv.customerUsername}
                  </strong>
                  <div style={{ fontSize: 12.5, color: '#71717a' }}>
                    @{activeConv.customerUsername}
                    {activeConv.customerEmail ? ` • ${activeConv.customerEmail}` : ''} •{' '}
                    {activeConv.warehouseName}
                  </div>
                </div>
                <button
                  type="button"
                  className="mgmt-btn mgmt-btn--ghost"
                  disabled={sending}
                  onClick={handleToggleStatus}
                >
                  {activeConv.status === 'CLOSED' ? 'Mở lại hội thoại' : 'Đánh dấu đã giải quyết'}
                </button>
              </div>

              <div className="sci-thread-messages">
                {messages.map((msg) => {
                  const isStaff = msg.senderType === 'STAFF'
                  return (
                    <div
                      key={msg.id}
                      className={`sci-msg ${isStaff ? 'sci-msg--staff' : 'sci-msg--customer'}`}
                    >
                      <div>{msg.content}</div>
                      <div className="sci-msg-meta">
                        {isStaff ? msg.senderName || 'Nhân viên kho' : activeConv.customerUsername} •{' '}
                        {formatDateTime(msg.createdAt)}
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef} />
              </div>

              <div className="sci-quick-replies">
                {CANNED_REPLIES.map((tpl) => (
                  <button
                    key={tpl}
                    type="button"
                    className="sci-quick-btn"
                    onClick={() => setReplyText(tpl)}
                  >
                    {tpl.slice(0, 42)}…
                  </button>
                ))}
              </div>

              <form className="sci-reply-form" onSubmit={handleSendReply}>
                <input
                  type="text"
                  className="sci-reply-input"
                  placeholder="Nhập câu trả lời gửi khách hàng..."
                  disabled={sending}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                />
                <button
                  type="submit"
                  className="mgmt-btn mgmt-btn--primary"
                  disabled={sending || !replyText.trim()}
                >
                  {sending ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default StaffChatInboxPage
