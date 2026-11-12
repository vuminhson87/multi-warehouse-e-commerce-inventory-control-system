import { beforeAll, beforeEach, afterAll, describe, it, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'

// Dedicated database only: never truncate the development database.
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/multi_warehouse_m4_test') {
  throw new Error('Run npm run test:acceptance against the dedicated multi_warehouse_m4_test database.')
}
process.env.DEMO_MODE = 'true'
process.env.JWT_SECRET = randomUUID()
const { default: db } = await import('../../src/db/prisma.js')
const { default: app } = await import('../../src/app.js')
const { default: jwt } = await import('jsonwebtoken')
const { createCheckoutOrder } = await import('../../src/modules/order/order.service.js')
const { payOrder } = await import('../../src/modules/payment/payment.service.js')
const { cancelCustomerOrder } = await import('../../src/modules/order/order.cancel.service.js')
const { reserveStock, findInventoryInvariantViolations, setLowStockThreshold, listOpenAlerts, restockInventory } = await import('../../src/modules/inventory/inventory.repository.js')
const body = () => ({ idempotencyKey: randomUUID() })
const checkout = (customerId = 1, quantity = 1) => createCheckoutOrder(customerId, { ...body(), items: [{ productId: 1, quantity }] })
const inventory = () => db.inventory.findUniqueOrThrow({ where: { warehouseId_productId: { warehouseId: 1, productId: 1 } } })
let server, base
async function request(path, userId, role = 'CUSTOMER', method = 'GET', data) {
  const token = userId ? jwt.sign({ role }, process.env.JWT_SECRET, { subject: String(userId), algorithm: 'HS256' }) : null
  const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(data ? { body: JSON.stringify(data) } : {}) })
  return { status: response.status, body: await response.json() }
}
beforeAll(async () => {
  await db.$connect()
  server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
})
afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await db.$disconnect() })
beforeEach(async () => {
  await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
  await db.warehouse.createMany({ data: [1, 2, 3].map(id => ({ id, code: `M4-${id}`, name: `Warehouse ${id}` })) })
  await db.user.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ id: i + 1, username: `m4-${i + 1}`, passwordHash: 'not-a-login-password', role: 'CUSTOMER' })) })
  await db.user.create({ data: { id: 31, username: 'manager', passwordHash: 'not-a-login-password', role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 1 } })
  await db.product.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ id: i + 1, sku: `M4-${i + 1}`, name: `Product ${i + 1}`, category: 'M4', price: '123.45' })) })
  await db.inventory.createMany({ data: [1, 2, 3].flatMap(warehouseId => Array.from({ length: 120 }, (_, i) => ({ warehouseId, productId: i + 1, onHand: warehouseId === 1 ? 10 : 0 }))) })
})

describe('M4 PostgreSQL / HTTP acceptance', () => {
  it('T03 no split: disjoint warehouse stock does not create order or partial reserve', async () => {
    await db.inventory.updateMany({ where: { productId: 2 }, data: { onHand: 0 } })
    await db.inventory.update({ where: { warehouseId_productId: { warehouseId: 2, productId: 2 } }, data: { onHand: 10 } })
    await expect(createCheckoutOrder(1, { ...body(), items: [{ productId: 1, quantity: 1 }, { productId: 2, quantity: 1 }] })).rejects.toMatchObject({ code: 'OUT_OF_STOCK' })
    expect(await db.order.count()).toBe(0)
    expect((await inventory()).reserved).toBe(0)
  })
  it('T04/T05/T19 price comes from DB, payment replay consumes once, paid cancel restores once', async () => {
    const order = (await checkout(1, 2)).data
    expect(order.totalAmount).toBe('246.90')
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 2 })
    const payment = body()
    await payOrder(1, String(order.orderId), payment)
    await payOrder(1, String(order.orderId), payment)
    expect(await inventory()).toMatchObject({ onHand: 8, reserved: 0 })
    expect(await db.paymentAttempt.count()).toBe(1)
    const cancel = body()
    await cancelCustomerOrder(1, String(order.orderId), cancel)
    await cancelCustomerOrder(1, String(order.orderId), cancel)
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 0 })
    expect(await db.inventoryMovement.count({ where: { type: 'RESTORE' } })).toBe(1)
  })
  it.each(['FAILED', 'INCOMPLETE'])('T06 %s releases and retry reserves before paying', async simulate => {
    const { orderId } = (await checkout()).data
    await payOrder(1, String(orderId), { ...body(), simulate })
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 0 })
    expect(await db.order.findUnique({ where: { id: orderId } })).toMatchObject({ status: 'PendingPayment' })
    await payOrder(1, String(orderId), body())
    expect(await inventory()).toMatchObject({ onHand: 9, reserved: 0 })
  })
  it('T07 retry after release rejects exhausted warehouse', async () => {
    const { orderId } = (await checkout()).data
    await payOrder(1, String(orderId), { ...body(), simulate: 'FAILED' })
    await checkout(2, 10)
    await expect(payOrder(1, String(orderId), body())).rejects.toMatchObject({ code: 'OUT_OF_STOCK' })
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 10 })
  })
  it('T13 HTTP ownership, role checked from DB rather than token claim', async () => {
    const { orderId } = (await checkout()).data
    expect((await request(`/api/orders/${orderId}`, 2)).status).toBe(404)
    expect((await request(`/api/orders/${orderId}/cancel`, 2, 'CUSTOMER', 'POST', body())).status).toBe(404)
    expect((await request('/api/orders', 31, 'CUSTOMER')).status).toBe(403)
    expect((await request('/api/orders')).status).toBe(401)
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 1 })
  })
  it('T14 pending cancel releases held stock', async () => {
    const { orderId } = (await checkout()).data
    await cancelCustomerOrder(1, String(orderId), body())
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 0 })
  })
  it.each(['Processing', 'Completed', 'Cancelled'])('T16 refuses cancellation in %s', async status => {
    const { orderId } = (await checkout()).data
    await db.order.update({ where: { id: orderId }, data: { status } })
    await expect(cancelCustomerOrder(1, String(orderId), body())).rejects.toThrow()
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 1 })
  })
  it('T17 history snapshot survives product rename and discontinue', async () => {
    const { orderId } = (await checkout()).data
    await db.product.update({ where: { id: 1 }, data: { name: 'Renamed', price: '999.00', isActive: false } })
    const detail = await request(`/api/orders/${orderId}`, 1)
    expect(detail.status).toBe(200)
    expect(detail.body.data.items[0]).toMatchObject({ productName: 'Product 1', unitPrice: '123.45' })
    await expect(checkout(2)).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE' })
  })
  it('T18 real transaction rollback after inventory update', async () => {
    await expect(db.$transaction(async tx => {
      await reserveStock(tx, { items: [{ productId: 1, quantity: 2 }] })
      throw new Error('M4 injected failure')
    })).rejects.toThrow('M4 injected failure')
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 0 })
    expect(await db.inventoryMovement.count()).toBe(0)
  })
  it('T12 threshold equality opens one alert and restock resolves it', async () => {
    await db.$transaction(tx => setLowStockThreshold(tx, { warehouseId: 1, productId: 1, threshold: 10 }))
    const alerts = await listOpenAlerts(db, { warehouseId: 1 })
    expect(alerts.filter(a => a.productId === 1)).toHaveLength(1)
    expect(await listOpenAlerts(db, { warehouseId: 2 })).toHaveLength(0)
    await db.$transaction(tx => restockInventory(tx, { warehouseId: 1, productId: 1, quantity: 1 }))
    expect(await listOpenAlerts(db, { warehouseId: 1 })).toHaveLength(0)
  })
  it('T18 cancel restore is rolled back when updating the order fails', async () => {
    const { orderId } = (await checkout()).data
    await payOrder(1, String(orderId), body())
    await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION m4_fail_cancel() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'M4 cancel failure'; END $$`)
    await db.$executeRawUnsafe(`CREATE TRIGGER m4_cancel_failure BEFORE UPDATE ON orders FOR EACH ROW WHEN (NEW.status = 'Cancelled') EXECUTE FUNCTION m4_fail_cancel()`)
    try {
      await expect(cancelCustomerOrder(1, String(orderId), body())).rejects.toThrow()
      expect(await inventory()).toMatchObject({ onHand: 9, reserved: 0 })
      expect(await db.order.findUnique({ where: { id: orderId } })).toMatchObject({ status: 'Paid' })
      expect(await db.inventoryMovement.count({ where: { type: 'RESTORE' } })).toBe(0)
    } finally {
      await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS m4_cancel_failure ON orders')
      await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS m4_fail_cancel()')
    }
  })
  it('T08/T21 30 concurrent customers / 120 products / 3 warehouses: zero oversell and reservation P95', async () => {
    const samples = await Promise.all(Array.from({ length: 30 }, async (_, i) => {
      const start = performance.now()
      const response = await request('/api/orders', i + 1, 'CUSTOMER', 'POST', { ...body(), items: [{ productId: 1, quantity: 1 }] })
      return { status: response.status, ms: performance.now() - start, body: response.body }
    }))
    const success = samples.filter(s => s.status === 201)
    expect(success).toHaveLength(10)
    for (const sample of samples) expect([201, 409]).toContain(sample.status)
    expect(await inventory()).toMatchObject({ onHand: 10, reserved: 10 })
    expect(await db.stockReservation.aggregate({ _sum: { quantity: true }, where: { status: 'ACTIVE' } })).toMatchObject({ _sum: { quantity: 10 } })
    expect(await findInventoryInvariantViolations(db)).toHaveLength(0)
    await Promise.all(success.map(s => payOrder(samples.indexOf(s) + 1, String(s.body.data.orderId), body())))
    expect(await inventory()).toMatchObject({ onHand: 0, reserved: 0 })
    expect(await findInventoryInvariantViolations(db)).toHaveLength(0)
    const durations = samples.map(s => s.ms).sort((a, b) => a - b)
    const p95 = durations[Math.ceil(durations.length * .95) - 1]
    const report = { at: new Date().toISOString(), users: 30, products: 120, warehouses: 3, requests: samples.length, created: success.length, rejected: samples.length - success.length, reservationHttpP95Ms: p95, thresholdMs: 5000, invariantViolations: 0, samples }
    writeFileSync('tests/reports/latest-load-result.json', JSON.stringify(report, null, 2))
    expect(p95).toBeLessThanOrEqual(5000)
  }, 60000)
})
