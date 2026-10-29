import { describe, it, expect, vi, afterEach } from 'vitest'
vi.mock('../../src/db/prisma.js', () => ({ default: { order: { findFirst: vi.fn() } } }))
import prisma from '../../src/db/prisma.js'
import { getCustomerOrderDetail } from '../../src/modules/order/order.query.service.js'
import { executeMockPayment } from '../../src/modules/payment/mockGateway.js'

afterEach(() => { vi.useRealTimers(); vi.clearAllMocks() })

describe('M4 - SR-PAY-01/02 mock gateway', () => {
  it.each([
    ['SUCCESS', null],
    ['FAILED', 'MOCK_PAYMENT_DECLINED'],
    ['INCOMPLETE', 'MOCK_PAYMENT_INCOMPLETE'],
  ])('returns %s without accessing storage', async (simulate, failureReason) => {
    vi.useFakeTimers()
    const pending = executeMockPayment({ orderId: 1, paymentAttemptId: 1, amount: '100.00', simulate })
    await vi.runAllTimersAsync()
    expect(await pending).toEqual({ result: simulate, failureReason, gatewayRef: expect.any(String) })
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
  })
  it.each([
    { orderId: 0 }, { orderId: 1.5 }, { paymentAttemptId: -1 },
    { paymentAttemptId: Number.MAX_SAFE_INTEGER + 1 }, { amount: null }, { simulate: 'INVALID' },
  ])('rejects invalid gateway input %j', async (invalid) => {
    await expect(executeMockPayment({ orderId: 1, paymentAttemptId: 1, amount: '100', ...invalid })).rejects.toThrow(TypeError)
  })
})

describe('M4 - SR-AUTH-04 / SR-TRACK-02 ownership query', () => {
  it('restricts lookup to both order ID and authenticated customer ID', async () => {
    prisma.order.findFirst.mockResolvedValue(null)
    await expect(getCustomerOrderDetail(7, '42')).rejects.toThrow()
    expect(prisma.order.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 42, customerId: 7 } }))
  })
  it('rejects malformed order ID before reading storage', async () => {
    await expect(getCustomerOrderDetail(7, '1 OR 1=1')).rejects.toThrow()
    expect(prisma.order.findFirst).not.toHaveBeenCalled()
  })
})
