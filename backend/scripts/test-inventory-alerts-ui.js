import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
import jwt from 'jsonwebtoken'
import { chromium } from 'playwright'
import { PrismaClient } from '@prisma/client'

const databaseUrl = process.env.ACCEPTANCE_DATABASE_URL ??
    'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
if (new URL(databaseUrl).pathname !== '/multi_warehouse_m4_test') {
    throw new Error('Refusing to reset a database that is not multi_warehouse_m4_test')
}

const apiPort = Number(process.env.INVENTORY_ALERTS_API_PORT ?? 3305)
const uiPort = Number(process.env.INVENTORY_ALERTS_UI_PORT ?? 5175)
const apiUrl = `http://127.0.0.1:${apiPort}`
const uiUrl = `http://127.0.0.1:${uiPort}`
const secret = `inventory-alerts-${Date.now()}`
const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } })
const checks = []
let backend
let frontend
let browser

async function waitForServer(url) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
        try {
            if ((await fetch(url)).ok) return
        } catch {
            // The local server is still starting.
        }
        await setTimeout(500)
    }
    throw new Error(`Server did not become ready: ${url}`)
}

try {
    await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
    await db.warehouse.create({ data: { code: 'ALERT-1', name: 'Kho cảnh báo' } })
    await db.user.create({
        data: {
            id: 1,
            username: 'alert-manager',
            passwordHash: 'unused',
            role: 'WAREHOUSE_MANAGER',
            assignedWarehouseId: 1,
        },
    })
    await db.product.create({
        data: {
            id: 1,
            sku: 'ALERT-1',
            name: 'Sản phẩm tồn thấp',
            category: 'Test',
            price: '100.00',
        },
    })
    await db.inventory.create({
        data: {
            warehouseId: 1,
            productId: 1,
            onHand: 3,
            reserved: 0,
            lowStockThreshold: 5,
        },
    })
    await db.lowStockAlert.create({
        data: {
            warehouseId: 1,
            productId: 1,
            availableAtTrigger: 3,
            threshold: 5,
        },
    })

    backend = spawn(process.execPath, ['src/server.js'], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            DATABASE_URL: databaseUrl,
            JWT_SECRET: secret,
            PORT: String(apiPort),
            CORS_ORIGIN: uiUrl,
            REDIS_ENABLED: 'false',
        },
        stdio: 'ignore',
    })
    frontend = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(uiPort), '--strictPort'], {
        cwd: '..',
        env: { ...process.env, VITE_API_URL: apiUrl },
        stdio: 'ignore',
    })

    await waitForServer(`${apiUrl}/api/health`)
    await waitForServer(uiUrl)
    browser = await chromium.launch({
        channel: process.env.UI_BROWSER_CHANNEL ?? 'chrome',
        headless: true,
    })

    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const user = {
        id: 1,
        username: 'alert-manager',
        fullName: null,
        role: 'WAREHOUSE_MANAGER',
        assignedWarehouseId: 1,
        isActive: true,
    }
    const token = jwt.sign({}, secret, { subject: '1', algorithm: 'HS256' })
    await context.addInitScript(({ sessionUser, sessionToken }) => {
        sessionStorage.setItem('mw_access_token', sessionToken)
        sessionStorage.setItem('currentUser', JSON.stringify(sessionUser))
    }, { sessionUser: user, sessionToken: token })
    const page = await context.newPage()
    page.setDefaultTimeout(15000)

    await page.route('**/api/inventory/alerts', route => route.abort())
    await page.goto(`${uiUrl}/inventory/alerts`)
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Thử tải lại', exact: true }).count(), 1)
    await page.unroute('**/api/inventory/alerts')
    await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click()
    await page.getByLabel('Ngưỡng', { exact: true }).waitFor()
    await page.getByText('Sản phẩm tồn thấp', { exact: true }).waitFor()
    checks.push({ test: 'Alert API failure is shown and retry loads alert data', passed: true })

    const thresholdInput = page.getByLabel('Ngưỡng', { exact: true })
    await page.route('**/api/inventory/1/threshold', route => route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
            success: false,
            error: { code: 'TEST_THRESHOLD_REJECTED', message: 'Không thể lưu ngưỡng thử nghiệm.', details: [] },
        }),
    }))
    await thresholdInput.fill('7')
    await page.getByRole('button', { name: 'Lưu ngưỡng', exact: true }).click()
    await page.getByRole('alert').getByText('Không thể lưu ngưỡng thử nghiệm.', { exact: true }).waitFor()
    assert.equal(await thresholdInput.inputValue(), '7')
    await page.unroute('**/api/inventory/1/threshold')
    checks.push({ test: 'Threshold save API error is shown and preserves the entered value', passed: true })

    await page.getByRole('button', { name: 'Lưu ngưỡng', exact: true }).click()
    await page.getByRole('status').getByText('Đã lưu ngưỡng cảnh báo.', { exact: true }).waitFor()
    await page.locator('tbody').getByText('Sản phẩm tồn thấp', { exact: true }).waitFor()
    const savedInventory = await db.inventory.findFirst({ where: { warehouseId: 1, productId: 1 } })
    assert.equal(savedInventory.lowStockThreshold, 7)
    const alertRow = page.locator('tbody tr').filter({ hasText: 'Sản phẩm tồn thấp' })
    assert.match(await alertRow.innerText(), /\b7\b/)
    checks.push({ test: 'Threshold save persists to the database and refreshes the alert row', passed: true })

    writeFileSync('tests/reports/inventory-alerts-ui.json', JSON.stringify({
        at: new Date().toISOString(),
        passed: true,
        checks,
    }, null, 2))
    console.log(JSON.stringify(checks, null, 2))
} catch (error) {
    writeFileSync('tests/reports/inventory-alerts-ui.json', JSON.stringify({
        at: new Date().toISOString(),
        passed: false,
        error: error.message,
        checks,
    }, null, 2))
    throw error
} finally {
    await browser?.close()
    backend?.kill()
    frontend?.kill()
    await db.$disconnect()
}
