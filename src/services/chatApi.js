import { apiRequest } from './apiClient.js'

export function askChatBotApi({ topic = '', query = '', token = null } = {}) {
  const path = token ? '/api/chat/bot/auth' : '/api/chat/bot'
  return apiRequest(path, {
    method: 'POST',
    token: token || undefined,
    body: { topic, query },
  })
}

export function getCustomerUnreadApi(token, { signal } = {}) {
  return apiRequest('/api/chat/customer/unread', { token, signal })
}

export function getCustomerConversationApi(
  token,
  warehouseId = 1,
  { markRead = false, signal } = {}
) {
  const q = new URLSearchParams({
    warehouseId: String(warehouseId),
    markRead: String(Boolean(markRead)),
  })
  return apiRequest(`/api/chat/customer/conversation?${q}`, { token, signal })
}

export function sendCustomerMessageApi(token, { warehouseId, content }) {
  return apiRequest('/api/chat/customer/messages', {
    method: 'POST',
    token,
    body: { warehouseId: Number(warehouseId), content },
  })
}

export function listStaffConversationsApi(
  token,
  { warehouseId, status, signal } = {}
) {
  const q = new URLSearchParams()
  if (warehouseId && warehouseId !== 'ALL') q.set('warehouseId', String(warehouseId))
  if (status && status !== 'ALL') q.set('status', status)
  const qs = q.toString()
  return apiRequest(`/api/chat/staff/conversations${qs ? `?${qs}` : ''}`, {
    token,
    signal,
  })
}

export function getStaffConversationDetailApi(token, conversationId, { signal } = {}) {
  return apiRequest(
    `/api/chat/staff/conversations/${encodeURIComponent(String(conversationId))}`,
    { token, signal }
  )
}

export function sendStaffReplyApi(token, conversationId, content) {
  return apiRequest(
    `/api/chat/staff/conversations/${encodeURIComponent(String(conversationId))}/reply`,
    {
      method: 'POST',
      token,
      body: { content },
    }
  )
}

export function updateStaffConversationStatusApi(token, conversationId, status) {
  return apiRequest(
    `/api/chat/staff/conversations/${encodeURIComponent(String(conversationId))}/status`,
    {
      method: 'PATCH',
      token,
      body: { status },
    }
  )
}
