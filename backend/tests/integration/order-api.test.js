
import 'dotenv/config'
import { describe, it, expect, beforeAll } from 'vitest'

const API = process.env.TEST_API_URL || 'http://localhost:3001'
const username = process.env.TEST_CUSTOMER_USERNAME
const password = process.env.TEST_CUSTOMER_PASSWORD

let token

async function request(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })

  return {
    status: response.status,
    body: await response.json(),
  }
}

describe('Member 2 - Order API Integration', () => {
  beforeAll(async () => {
    if (!username || !password) {
      throw new Error(
        'Thiếu TEST_CUSTOMER_USERNAME hoặc TEST_CUSTOMER_PASSWORD'
      )
    }

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })

    expect(login.status).toBe(200)
    expect(login.body.success).toBe(true)

    token = login.body.data.token
  })

  it('UC10 - Lấy lịch sử đơn hàng', async () => {
    const result = await request('/api/orders')

    expect(result.status).toBe(200)
    expect(result.body.success).toBe(true)
    expect(Array.isArray(result.body.data.orders)).toBe(true)
  })

  it('UC10 - Lọc đơn đã thanh toán', async () => {
    const result = await request(
      '/api/orders?status=Paid&page=1&limit=10'
    )

    expect(result.status).toBe(200)

    for (const order of result.body.data.orders) {
      expect(order.status).toBe('Paid')
    }
  })

  it('UC09 - Đọc chi tiết đơn hàng', async () => {
    const history = await request('/api/orders')

    expect(history.status).toBe(200)

    const firstOrder = history.body.data.orders[0]

    expect(firstOrder).toBeDefined()

    const detail = await request(
      `/api/orders/${firstOrder.orderId}`
    )

    expect(detail.status).toBe(200)
    expect(detail.body.data.orderId).toBe(firstOrder.orderId)
    expect(Array.isArray(detail.body.data.items)).toBe(true)
  })

  it('Không cho xem đơn hàng không tồn tại', async () => {
    const result = await request('/api/orders/999999999')

    expect(result.status).toBe(404)
    expect(result.body.error.code).toBe('ORDER_NOT_FOUND')
  })

  it('Không cho truy cập nếu thiếu JWT', async () => {
    const response = await fetch(`${API}/api/orders`)
    expect(response.status).toBe(401)
  })

  it('Không cho truy cập với JWT giả mạo', async () => {
    const response = await fetch(`${API}/api/orders`, {
      headers: {
        Authorization: 'Bearer invalid.token.value',
      },
    })

    expect(response.status).toBe(401)
  })
})
