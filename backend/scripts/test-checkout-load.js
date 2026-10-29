import { spawn, spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { writeFileSync, readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { setTimeout } from 'node:timers/promises'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
const url = process.env.ACCEPTANCE_DATABASE_URL ?? 'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
if (new URL(url).pathname !== '/multi_warehouse_m4_test') throw new Error('Dedicated acceptance database required')
const db = new PrismaClient({ datasources: { db: { url } } })
const docker = process.env.DOCKER_EXE ?? 'docker'
const secret = randomUUID()
const image = process.env.K6_IMAGE ?? 'grafana/k6:1.3.0'
let server
try {
  const version = spawnSync(docker, ['run', '--rm', image, 'version'], { encoding: 'utf8' })
  if (version.status !== 0) throw new Error(version.stderr || version.error?.message)
  await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
  await db.warehouse.createMany({ data: [1,2,3].map(id => ({ id, code: `LOAD-${id}`, name: `Load warehouse ${id}` })) })
  await db.user.createMany({ data: Array.from({ length: 30 }, (_, i) => ({ id: i+1, username: `load-${i+1}`, role: 'CUSTOMER', passwordHash: 'not-used' })) })
  await db.product.createMany({ data: Array.from({ length: 120 }, (_, i) => ({ id: i+1, sku: `LOAD-${i+1}`, name: `Load product ${i+1}`, category: 'Load', price: '100' })) })
  await db.inventory.createMany({ data: [1,2,3].flatMap(warehouseId => Array.from({ length: 120 }, (_, i) => ({ warehouseId, productId: i+1, onHand: warehouseId === 1 ? 10 : 0 }))) })
  server = spawn(process.execPath, ['src/server.js'], { env: { ...process.env, DATABASE_URL: url, JWT_SECRET: secret, PORT: '3302', REDIS_ENABLED: 'false' }, stdio: ['ignore', 'ignore', 'pipe'] })
  server.stderr.on('data', data => process.stderr.write(data))
  let ready = false
  for (let i=0; i<30; i++) {
    try { const response = await fetch('http://127.0.0.1:3302/api/health'); if (response.ok) { ready = true; break } } catch { /* startup */ }
    await setTimeout(500)
  }
  if (!ready) throw new Error('Load test server unavailable')
  const fixtures = Array.from({ length: 30 }, (_, i) => ({ key: randomUUID(), token: jwt.sign({}, secret, { subject: String(i+1), algorithm: 'HS256', expiresIn: '5m' }) }))
  const result = spawnSync(docker, ['run', '--rm', '-e', 'CHECKOUT_FIXTURES', '-e', 'API_URL=http://host.docker.internal:3302', '-v', `${resolve('tests/load/checkout.k6.js')}:/scripts/checkout.js:ro`, '-v', `${resolve('tests/reports')}:/reports`, image, 'run', '--summary-export=/reports/k6-summary.json', '/scripts/checkout.js'], { env: { ...process.env, CHECKOUT_FIXTURES: JSON.stringify(fixtures) }, stdio: 'inherit', timeout: 180000 })
  const inventory = await db.inventory.findMany({ where: { productId: 1 }, orderBy: { warehouseId: 'asc' } })
  const orders = await db.order.findMany({ include: { items: true, reservations: true } })
  const totalReserved = inventory.reduce((s,i) => s+i.reserved, 0)
  const activeQuantity = orders.flatMap(o => o.reservations).filter(r => r.status === 'ACTIVE').reduce((s,r) => s+r.quantity, 0)
  const invariants = inventory.every(i => i.onHand >= 0 && i.reserved >= 0 && i.reserved <= i.onHand) && totalReserved === 10 && activeQuantity === 10 && orders.length === 10 && orders.every(o => o.status === 'PendingPayment' && o.fulfillmentWarehouseId === 1 && o.items.length === 1)
  const summary = JSON.parse(readFileSync('tests/reports/k6-summary.json', 'utf8'))
  const report = { at: new Date().toISOString(), k6: version.stdout.trim(), image, dataset: { products: 120, warehouses: 3, customers: 30, initialStock: 10 }, k6ExitCode: result.status, passed: result.status === 0 && invariants, invariants, orders: orders.length, activeQuantity, totalReserved, inventory, reservationP95Ms: summary.metrics.reservation_duration?.['p(95)'] }
  writeFileSync('tests/reports/k6-reconciliation.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
  assert.equal(result.status, 0, 'k6 thresholds failed')
  assert.ok(invariants, 'Post-load PostgreSQL reconciliation failed')
} finally { server?.kill(); await db.$disconnect() }
