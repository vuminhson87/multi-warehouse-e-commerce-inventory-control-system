
import 'dotenv/config'
import { randomUUID } from 'node:crypto'
import { describe, it, expect, beforeAll } from 'vitest'

const API = process.env.TEST_API_URL ?? 'http://localhost:3001'

const username = process.env.TEST_CUSTOMER_USERNAME
const password = process.env.TEST_CUSTOMER_PASSWORD
const productId = Number(process.env.TEST_PRODUCT_ID ?? 1)

let token
let orderId
let createBody
let cancelBody

async function api(path, method = 'GET', body) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token
        ? { Authorization: `Bearer ${token}` }
        : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('Member 2 - Order Write Integration', () => {
  beforeAll(async () => {
    if (!username || !password) {
      throw new Error('Thiếu tài khoản kiểm thử.')
    }

    const login = await api('/api/auth/login', 'POST', {
      username,
      password,
    })

    expect(login.status).toBe(200)
    token = login.body.data.token
  })

  it('UC04 - Tạo đơn hàng mới', async () => {
    createBody = {
      idempotencyKey: randomUUID(),
      items: [{ productId, quantity: 1 }],
    }

    const result = await api(
      '/api/orders',
      'POST',
      createBody
    )

    expect(result.status).toBe(201)
    expect(result.body.success).toBe(true)
    expect(result.body.data.status).toBe('PendingPayment')

    orderId = result.body.data.orderId
    expect(orderId).toBeGreaterThan(0)
  })

  it('UC04 - Gửi trùng không tạo đơn mới', async () => {
    const replay = await api(
      '/api/orders',
      'POST',
      createBody
    )

    expect(replay.status).toBe(200)
    expect(replay.body.data.orderId).toBe(orderId)
    expect(replay.body.data.replayed).toBe(true)
  })

  it('UC11 - Hủy đơn chưa thanh toán', async () => {
    cancelBody = {
      idempotencyKey: randomUUID(),
    }

    const result = await api(
      `/api/orders/${orderId}/cancel`,
      'POST',
      cancelBody
    )

    expect(result.status).toBe(200)
    expect(result.body.data.status).toBe('Cancelled')
  })

  it('UC11 - Gửi trùng yêu cầu hủy', async () => {
    const replay = await api(
      `/api/orders/${orderId}/cancel`,
      'POST',
      cancelBody
    )

    expect(replay.status).toBe(200)
    expect(replay.body.data.status).toBe('Cancelled')
  })

  it('UC09 - Trạng thái cuối cùng đã được lưu', async () => {
    const result = await api(`/api/orders/${orderId}`)

    expect(result.status).toBe(200)
    expect(result.body.data.status).toBe('Cancelled')
    expect(result.body.data.canPay).toBe(false)
  })
})
