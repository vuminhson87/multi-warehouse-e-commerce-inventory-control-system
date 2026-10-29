import { beforeEach, afterAll, describe, it, expect, vi } from 'vitest'
import { randomUUID } from 'node:crypto'
vi.mock('../../src/modules/payment/mockGateway.js', () => ({ executeMockPayment: vi.fn() }))
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/multi_warehouse_m4_test') throw new Error('Dedicated acceptance database required')
process.env.DEMO_MODE = 'true'
const { default: db } = await import('../../src/db/prisma.js')
const { executeMockPayment: gateway } = await import('../../src/modules/payment/mockGateway.js')
const { createCheckoutOrder } = await import('../../src/modules/order/order.service.js')
const { payOrder } = await import('../../src/modules/payment/payment.service.js')
const { cancelCustomerOrder } = await import('../../src/modules/order/order.cancel.service.js')
const { getCustomerOrderDetail } = await import('../../src/modules/order/order.query.service.js')
const { findInventoryInvariantViolations } = await import('../../src/modules/inventory/inventory.repository.js')
const key = () => ({ idempotencyKey: randomUUID() })
const success = () => ({ result: 'SUCCESS', gatewayRef: randomUUID(), failureReason: null })
let orderId
beforeEach(async () => {
  vi.resetAllMocks()
  await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
  await db.warehouse.create({ data: { id: 1, code: 'PAYMENT-TEST', name: 'Payment test' } })
  await db.user.create({ data: { id: 1, username: 'payment-test', passwordHash: 'unused', role: 'CUSTOMER' } })
  await db.product.create({ data: { id: 1, sku: 'PAYMENT-TEST', name: 'Payment test', category: 'Test', price: '100' } })
  await db.inventory.create({ data: { warehouseId: 1, productId: 1, onHand: 10 } })
  orderId = (await createCheckoutOrder(1, { ...key(), items: [{ productId: 1, quantity: 2 }] })).data.orderId
})
afterAll(async () => db.$disconnect())
async function assertPending() {
  expect(await db.order.findUnique({ where: { id: orderId } })).toMatchObject({ status: 'PendingPayment' })
  expect(await db.paymentAttempt.findMany({ where: { orderId } })).toEqual([expect.objectContaining({ status: 'PENDING', completedAt: null })])
  expect(await db.inventory.findFirst()).toMatchObject({ onHand: 10, reserved: 2 })
  expect(await findInventoryInvariantViolations(db)).toEqual([])
  expect(await getCustomerOrderDetail(1, String(orderId))).toMatchObject({ paymentInProgress: true, canPay: false, canCancel: false })
}
async function assertRetryBlocked(paymentKey) {
  await expect(payOrder(1, String(orderId), paymentKey)).rejects.toMatchObject({ code: 'PAYMENT_IN_PROGRESS' })
  await expect(payOrder(1, String(orderId), key())).rejects.toMatchObject({ code: 'PAYMENT_IN_PROGRESS' })
  await expect(cancelCustomerOrder(1, String(orderId), key())).rejects.toMatchObject({ code: 'PAYMENT_IN_PROGRESS' })
  expect(gateway).toHaveBeenCalledTimes(1)
}
describe('Payment reconciliation: PENDING and REQUEST_OUTCOME_UNKNOWN', () => {
  it('unknown gateway result preserves reservation and forbids blind retries/cancel', async () => {
    gateway.mockRejectedValue(new Error('Injected network failure: gateway outcome unknown'))
    const paymentKey = key()
    await expect(payOrder(1, String(orderId), paymentKey)).rejects.toMatchObject({ code: 'REQUEST_OUTCOME_UNKNOWN', httpStatus: 503 })
    await assertPending()
    await assertRetryBlocked(paymentKey)
    expect(await db.idempotencyRecord.findFirst({ where: { operation: 'PAY_ORDER' } })).toMatchObject({ completedAt: null })
  })
  it('concurrent PENDING cannot be paid/cancelled again; original success consumes once', async () => {
    let resolveGateway, started
    const entered = new Promise(resolve => { started = resolve })
    gateway.mockImplementation(() => { started(); return new Promise(resolve => { resolveGateway = resolve }) })
    const paymentKey = key()
    const original = payOrder(1, String(orderId), paymentKey)
    try {
      await entered
      await assertPending()
      await assertRetryBlocked(paymentKey)
    } finally { resolveGateway(success()) }
    await original
    await payOrder(1, String(orderId), paymentKey)
    expect(gateway).toHaveBeenCalledTimes(1)
    expect(await db.inventory.findFirst()).toMatchObject({ onHand: 8, reserved: 0 })
    expect(await db.paymentAttempt.findMany()).toEqual([expect.objectContaining({ status: 'SUCCEEDED' })])
    expect(await findInventoryInvariantViolations(db)).toEqual([])
  })
  it('gateway success with expired reservation remains unresolved rather than falsely Paid', async () => {
    gateway.mockImplementation(async () => {
      await db.stockReservation.updateMany({ where: { orderId }, data: { expiresAt: new Date(Date.now() - 1000) } })
      return success()
    })
    const paymentKey = key()
    await expect(payOrder(1, String(orderId), paymentKey)).rejects.toMatchObject({ code: 'REQUEST_OUTCOME_UNKNOWN' })
    await assertPending()
    await assertRetryBlocked(paymentKey)
  })
  it('DB failure after consume rolls back stock/order/attempt and retains reconciliation state', async () => {
    gateway.mockResolvedValue(success())
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION test_fail_paid() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected payment finalization failure'; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER test_paid_failure BEFORE UPDATE ON orders FOR EACH ROW WHEN (NEW.status = 'Paid') EXECUTE FUNCTION test_fail_paid()`)
    const paymentKey = key()
    try {
      await expect(payOrder(1, String(orderId), paymentKey)).rejects.toThrow()
      await assertPending()
      await assertRetryBlocked(paymentKey)
      expect(await db.inventoryMovement.count({ where: { type: 'CONSUME' } })).toBe(0)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS test_paid_failure ON orders')
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS test_fail_paid()')
    }
  })
})
