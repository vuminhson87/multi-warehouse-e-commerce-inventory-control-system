import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import {
  askChatBotApi,
  getCustomerConversationApi,
  getCustomerUnreadApi,
  sendCustomerMessageApi,
} from '../services/chatApi.js'
import './SupportChatWidget.css'

const WAREHOUSE_OPTIONS = [
  { id: 1, label: 'Kho TP. Hồ Chí Minh (Miền Nam)' },
  { id: 2, label: 'Kho Hà Nội — Bắc Ninh (Miền Bắc)' },
  { id: 3, label: 'Kho Đà Nẵng (Miền Trung)' },
]

const QUICK_TOPICS = [
  {
    key: 'POLICY',
    label: 'Chính sách',
    draft: 'Tôi muốn tìm hiểu về chính sách giao hàng, hủy đơn và bảo hành',
  },
  {
    key: 'PRODUCTS',
    label: 'Sản phẩm',
    draft: 'Tôi cần biết về các sản phẩm nổi bật hiện có',
  },
  {
    key: 'ORDERS',
    label: 'Đơn hàng của tôi',
    draft: 'Hãy kiểm tra giúp tôi trạng thái các đơn hàng gần nhất',
  },
  {
    key: 'VOUCHERS',
    label: 'Mã giảm giá',
    draft: 'Cho tôi biết cách nhận và áp dụng mã giảm giá',
  },
  {
    key: 'WAREHOUSES',
    label: 'Địa chỉ 3 kho',
    draft: 'Cho tôi xem địa chỉ hệ thống 3 kho hàng Bắc – Trung – Nam',
  },
]

const INITIAL_BOT_MESSAGES = [
  {
    id: 'welcome-bot',
    senderType: 'BOT',
    senderName: 'Trợ lý tự động',
    content:
      'Xin chào! Mình là Trợ lý tự động Multi-Warehouse. Bạn hãy chọn mục thường gặp bên dưới, gõ tên sản phẩm cần tìm hoặc bấm "Chat Quản lý kho" để trao đổi trực tiếp với nhân viên kho nhé!',
    createdAt: new Date().toISOString(),
  },
]

function ChatBotBubbleIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M7 9.5C7 7.567 8.567 6 10.5 6H21.5C23.433 6 25 7.567 25 9.5V17.5C25 19.433 23.433 21 21.5 21H19.5L22.5 25L16.5 21H10.5C8.567 21 7 19.433 7 17.5V9.5Z"
        fill="#FFFFFF"
      />
      <rect x="12.2" y="11" width="2.4" height="5" rx="1.2" fill="#38BDF8" />
      <rect x="17.4" y="11" width="2.4" height="5" rx="1.2" fill="#38BDF8" />
    </svg>
  )
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}

function SupportChatWidgetInner({ currentUser, token }) {
  const [isOpen, setIsOpen] = useState(false)
  const [mode, setMode] = useState('BOT') // 'BOT' | 'STAFF'
  const [warehouseId, setWarehouseId] = useState(1)
  const [botMessages, setBotMessages] = useState(INITIAL_BOT_MESSAGES)
  const [staffMessages, setStaffMessages] = useState([])
  const [unreadTotal, setUnreadTotal] = useState(0)
  const [inputText, setInputText] = useState('')
  const [pendingTopic, setPendingTopic] = useState(null)
  const [sending, setSending] = useState(false)
  const [chatError, setChatError] = useState('')

  const endRef = useRef(null)
  const inputRef = useRef(null)
  const msgSeqRef = useRef(1)
  const isCustomer = currentUser?.role === 'CUSTOMER' && Boolean(token)

  function nextLocalId(prefix) {
    msgSeqRef.current += 1
    return `${prefix}-${msgSeqRef.current}`
  }

  // Cuộn xuống tin nhắn mới nhất
  useEffect(() => {
    if (isOpen) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isOpen, mode, botMessages.length, staffMessages.length])

  // Polling nền nhẹ (20s) chỉ kiểm tra số tin chưa đọc khi hộp chat đang đóng
  useEffect(() => {
    if (!isCustomer || isOpen) return undefined
    let active = true
    const controller = new AbortController()

    const fetchUnread = () => {
      if (document.visibilityState !== 'visible') return
      getCustomerUnreadApi(token, { signal: controller.signal })
        .then((data) => {
          if (active) setUnreadTotal(Number(data?.totalUnread || 0))
        })
        .catch(() => {})
    }

    fetchUnread()
    const timer = setInterval(fetchUnread, 20000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [isCustomer, isOpen, token])

  // Smart Polling 3s khi đang mở tab Chat với Quản lý kho và tab đang hiển thị
  useEffect(() => {
    if (!isCustomer || !isOpen || mode !== 'STAFF') return undefined
    let active = true
    const controller = new AbortController()

    const loadConversation = () => {
      if (document.visibilityState !== 'visible') return
      getCustomerConversationApi(token, warehouseId, {
        markRead: true,
        signal: controller.signal,
      })
        .then((data) => {
          if (!active) return
          setStaffMessages(data?.messages || [])
          setUnreadTotal(0)
          setChatError('')
        })
        .catch((err) => {
          if (active && !controller.signal.aborted) {
            setChatError(err.message || 'Không thể tải tin nhắn.')
          }
        })
    }

    loadConversation()
    const timer = setInterval(loadConversation, 3000)
    return () => {
      active = false
      controller.abort()
      clearInterval(timer)
    }
  }, [isCustomer, isOpen, mode, warehouseId, token])

  // Không hiện nút chat khách hàng cho Admin / Quản lý kho
  if (currentUser && currentUser.role !== 'CUSTOMER') {
    return null
  }

  // Chỉ điền sẵn câu mẫu vào ô nhập tin nhắn, chờ khách bấm Gửi (tránh spam & trôi tin nhắn)
  function handleQuickTopic(topicItem) {
    if (sending) return
    setMode('BOT')
    setChatError('')
    setInputText(topicItem.draft)
    setPendingTopic({ key: topicItem.key, draft: topicItem.draft })
    inputRef.current?.focus()
  }

  async function handleSend(e) {
    e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || sending) return
    setChatError('')
    setSending(true)

    try {
      if (mode === 'BOT') {
        const matchedTopic =
          pendingTopic && pendingTopic.draft === trimmed ? pendingTopic.key : ''
        setInputText('')
        setPendingTopic(null)
        setBotMessages((prev) => [
          ...prev,
          {
            id: nextLocalId('u'),
            senderType: 'CUSTOMER',
            content: trimmed,
            createdAt: new Date().toISOString(),
          },
        ])
        const data = await askChatBotApi({
          topic: matchedTopic,
          query: matchedTopic ? '' : trimmed,
          token: isCustomer ? token : null,
        })
        setBotMessages((prev) => [
          ...prev,
          {
            id: nextLocalId('b'),
            senderType: 'BOT',
            senderName: 'Trợ lý tự động',
            content: data?.reply || 'Mình chưa tìm thấy thông tin phù hợp.',
            createdAt: new Date().toISOString(),
          },
        ])
      } else {
        if (!isCustomer) {
          setChatError('Vui lòng đăng nhập tài khoản khách hàng để gửi tin cho Quản lý kho.')
          return
        }
        setInputText('')
        const data = await sendCustomerMessageApi(token, {
          warehouseId,
          content: trimmed,
        })
        if (data?.message) {
          setStaffMessages((prev) => [...prev, data.message])
        }
      }
    } catch (err) {
      setChatError(err.message || 'Gửi tin nhắn thất bại.')
    } finally {
      setSending(false)
    }
  }

  const activeMessages = mode === 'BOT' ? botMessages : staffMessages

  return (
    <>
      <div className="scw-fab-wrap">
        <button
          type="button"
          className="scw-fab-btn"
          aria-label="Mở hộp thoại hỗ trợ khách hàng"
          title="Hỗ trợ trực tuyến"
          onClick={() => setIsOpen((prev) => !prev)}
        >
          <span className="scw-fab-core">
            <ChatBotBubbleIcon />
          </span>
          <span className="scw-online-dot" aria-hidden="true" />
          {unreadTotal > 0 && (
            <span className="scw-unread-badge">{unreadTotal > 9 ? '9+' : unreadTotal}</span>
          )}
        </button>
      </div>

      {isOpen && (
        <section
          className="scw-panel"
          role="dialog"
          aria-label="Hộp thoại hỗ trợ khách hàng"
        >
          <div className="scw-head">
            <div className="scw-head-info">
              <ChatBotBubbleIcon />
              <div>
                <h2 className="scw-head-title">Hỗ trợ Multi-Warehouse</h2>
                <p className="scw-head-sub">
                  {mode === 'BOT'
                    ? 'Trợ lý tự động • Phản hồi tức thì'
                    : 'Kết nối trực tiếp Quản lý kho'}
                </p>
              </div>
            </div>
            <button
              type="button"
              className="scw-head-close"
              aria-label="Đóng hộp chat"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>

          <div className="scw-mode-bar" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'BOT'}
              className={`scw-mode-tab${mode === 'BOT' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('BOT')
                setChatError('')
              }}
            >
              Trợ lý tự động
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'STAFF'}
              className={`scw-mode-tab${mode === 'STAFF' ? ' is-active' : ''}`}
              onClick={() => {
                setMode('STAFF')
                setChatError('')
              }}
            >
              Chat Quản lý kho
            </button>
          </div>

          {mode === 'STAFF' && (
            <div className="scw-warehouse-bar">
              <span>Chọn kho:</span>
              <select
                className="scw-warehouse-select"
                value={warehouseId}
                onChange={(e) => setWarehouseId(Number(e.target.value))}
              >
                {WAREHOUSE_OPTIONS.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="scw-messages">
            {mode === 'STAFF' && !isCustomer ? (
              <div className="scw-empty-staff">
                <strong>Vui lòng đăng nhập tài khoản khách hàng</strong> để chat trực tiếp với Quản lý kho và nhận phản hồi theo từng kho hàng.
              </div>
            ) : activeMessages.length === 0 ? (
              <div className="scw-empty-staff">
                Chưa có tin nhắn nào với kho này. Hãy gửi câu hỏi của bạn bên dưới, Quản lý kho sẽ phản hồi trực tiếp cho bạn!
              </div>
            ) : (
              activeMessages.map((msg) => {
                const isMine = msg.senderType === 'CUSTOMER'
                return (
                  <div
                    key={msg.id}
                    className={`scw-bubble ${
                      isMine
                        ? 'scw-bubble--customer'
                        : msg.senderType === 'STAFF'
                          ? 'scw-bubble--staff'
                          : 'scw-bubble--bot'
                    }`}
                  >
                    <div>{msg.content}</div>
                    <div className="scw-bubble-meta">
                      {isMine ? 'Bạn' : msg.senderName || 'Quản lý kho'} • {formatTime(msg.createdAt)}
                    </div>
                  </div>
                )
              })
            )}
            {chatError && (
              <div style={{ color: '#b91c1c', fontSize: '12px', textAlign: 'center' }} role="alert">
                {chatError}
              </div>
            )}
            <div ref={endRef} />
          </div>

          {mode === 'BOT' && (
            <div className="scw-chips">
              {QUICK_TOPICS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  className="scw-chip"
                  disabled={sending}
                  onClick={() => handleQuickTopic(t)}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                className="scw-chip scw-chip--staff"
                onClick={() => setMode('STAFF')}
              >
                Gặp Quản lý kho
              </button>
            </div>
          )}

          <form className="scw-form" onSubmit={handleSend}>
            <input
              ref={inputRef}
              type="text"
              className="scw-input"
              placeholder={
                mode === 'BOT'
                  ? 'Chọn gợi ý ở trên hoặc gõ câu hỏi / tên sản phẩm...'
                  : isCustomer
                    ? 'Nhập tin nhắn gửi Quản lý kho...'
                    : 'Đăng nhập để nhắn Quản lý kho'
              }
              disabled={sending || (mode === 'STAFF' && !isCustomer)}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value)
                if (pendingTopic && e.target.value.trim() !== pendingTopic.draft) {
                  setPendingTopic(null)
                }
              }}
            />
            <button
              type="submit"
              className="scw-send-btn"
              disabled={sending || !inputText.trim() || (mode === 'STAFF' && !isCustomer)}
            >
              Gửi
            </button>
          </form>
        </section>
      )}
    </>
  )
}

function SupportChatWidget() {
  const { currentUser, token } = useAuth()
  return (
    <SupportChatWidgetInner
      key={currentUser?.id ?? 'guest'}
      currentUser={currentUser}
      token={token}
    />
  )
}

export default SupportChatWidget
