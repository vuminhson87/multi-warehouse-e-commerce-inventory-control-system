import { spawn, spawnSync } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
const url = process.env.ACCEPTANCE_DATABASE_URL ?? 'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
if (new URL(url).pathname !== '/multi_warehouse_m4_test') throw new Error('Dedicated M4 database required')
const env = { ...process.env, DATABASE_URL: url, JWT_SECRET: 'm4-isolated-test-server-only', PORT: '3301', REDIS_ENABLED: 'false', TEST_API_URL: 'http://127.0.0.1:3301', TEST_CUSTOMER_USERNAME: 'customer', TEST_CUSTOMER_PASSWORD: '123456' }
const { PrismaClient } = await import('@prisma/client')
const fixtureDb = new PrismaClient({ datasources: { db: { url } } })
try {
  await fixtureDb.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
} finally { await fixtureDb.$disconnect() }
const seed = spawnSync(process.execPath, ['prisma/seed.js'], { env, stdio: 'inherit' })
if (seed.status !== 0) process.exit(seed.status ?? 1)
const server = spawn(process.execPath, ['src/server.js'], { env, stdio: ['ignore', 'ignore', 'pipe'] })
server.stderr.on('data', data => process.stderr.write(data))
try {
  let ready = false
  for (let i = 0; i < 30; i++) {
    try { const response = await fetch(env.TEST_API_URL + '/api/health'); if (response.ok) { ready = true; break } } catch { /* startup */ }
    await setTimeout(500)
  }
  if (!ready) throw new Error('Isolated backend did not become ready')
  const login = await fetch(env.TEST_API_URL + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'customer', password: '123456' }) })
  if (!login.ok) throw new Error('Fixture login failed')
  const { data } = await login.json()
  const fixture = await fetch(env.TEST_API_URL + '/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + data.token }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), items: [{ productId: 1, quantity: 1 }] }) })
  if (fixture.status !== 201) throw new Error('Fixture order failed')
  const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/integration'], { env, stdio: 'inherit' })
  process.exitCode = result.status ?? 1
} finally { server.kill() }
