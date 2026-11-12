import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { setTimeout } from 'node:timers/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const api = 'http://127.0.0.1:3109'
const ui = 'http://127.0.0.1:5178'
const channel = process.env.UI_BROWSER_CHANNEL ?? 'chrome'
let viteOutput = ''
const vite = spawn(process.execPath, [
  resolve(root, 'node_modules/vite/bin/vite.js'),
  '--host', '127.0.0.1', '--port', '5178', '--strictPort',
], {
  cwd: root,
  env: { ...process.env, VITE_API_URL: api },
  stdio: ['ignore', 'pipe', 'pipe'],
})
vite.stdout?.on('data', chunk => { viteOutput += chunk.toString() })
vite.stderr?.on('data', chunk => { viteOutput += chunk.toString() })

let browser
const results = []

async function waitForServer(url) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      if ((await fetch(url)).ok) return
    } catch {
      // Wait for Vite to finish starting.
    }
    await setTimeout(250)
  }
  throw new Error(`Vite did not start at ${url}`)
}

async function createOrderPage({ initialStatus = 'Processing', confirmStatus = 200 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  await context.addInitScript(() => {
    sessionStorage.setItem('mw_access_token', 'ui-customer-token')
    sessionStorage.setItem('currentUser', JSON.stringify({ id: 7, username: 'customer', role: 'CUSTOMER' }))
  })

  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  const state = { status: initialStatus, confirmCalls: 0, confirmRequest: null, pageErrors: [], requests: [] }
  page.on('pageerror', error => state.pageErrors.push(error.message))
  page.on('requestfailed', request => state.requests.push(`FAILED ${request.url()}: ${request.failure()?.errorText}`))

  // The app's remote font stylesheet can block module startup in offline CI.
  await page.route('https://fonts.googleapis.com/**', route => route.fulfill({
    status: 200,
    contentType: 'text/css',
    body: '',
  }))

  await page.route(`${api}/**`, async route => {
    const request = route.request()
    const url = new URL(request.url())
    const headers = {
      'access-control-allow-origin': ui,
      'access-control-allow-headers': 'Authorization, Content-Type',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'content-type': 'application/json',
    }

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers })
      return
    }

    if (url.pathname === '/api/auth/me' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({ success: true, data: { user: { id: 7, username: 'customer', role: 'CUSTOMER' } } }),
      })
      return
    }

    if (url.pathname === '/api/orders/31' && request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        headers,
        body: JSON.stringify({
          success: true,
          data: {
            orderId: 31,
            status: state.status,
            totalAmount: '790000.00',
            currency: 'VND',
            warehouseId: 1,
            fulfillmentWarehouseName: 'Kho TP. Hồ Chí Minh',
            customerUsername: 'customer',
            itemCount: 1,
            items: [{ productId: 2, productName: 'Logitech G304', unitPrice: '790000.00', quantity: 1, lineTotal: '790000.00' }],
            hasActiveReservation: false,
            paymentInProgress: false,
            canPay: false,
            canCancel: false,
            payments: [],
            createdAt: '2026-11-12T10:00:00.000Z',
            updatedAt: '2026-11-12T10:05:00.000Z',
            paidAt: '2026-11-12T10:01:00.000Z',
            cancelledAt: null,
          },
        }),
      })
      return
    }

    if (url.pathname === '/api/orders/31/confirm-received' && request.method() === 'POST') {
      state.confirmCalls += 1
      state.confirmRequest = {
        method: request.method(),
        authorization: request.headers().authorization,
      }
      if (confirmStatus === 200) state.status = 'Completed'
      await route.fulfill({
        status: confirmStatus,
        headers,
        body: JSON.stringify(confirmStatus === 200
          ? { success: true, data: { orderId: 31, status: 'Completed', version: 2 } }
          : { success: false, error: { code: 'INVALID_ORDER_STATE', message: 'Đơn chưa thể xác nhận nhận hàng.', details: [] } }),
      })
      return
    }

    await route.fulfill({
      status: 404,
      headers,
      body: JSON.stringify({ success: false, error: { code: 'NOT_FOUND', message: `Unexpected request: ${url.pathname}`, details: [] } }),
    })
  })

  const response = await page.goto(`${ui}/orders/31`, { waitUntil: 'domcontentloaded' })
  try {
    await page.getByRole('heading', { name: 'Chi tiết & Theo dõi đơn hàng: 31' }).waitFor()
  } catch (error) {
    throw new Error(`${error.message}\nHTTP: ${response?.status()}\nURL: ${page.url()}\nBody: ${await page.locator('body').innerText()}\nFailed requests: ${state.requests.join(', ')}\nVite: ${viteOutput}`, { cause: error })
  }
  return { context, page, state }
}

try {
  await waitForServer(ui)
  browser = await chromium.launch({ channel, headless: true })

  const success = await createOrderPage()
  success.page.once('dialog', dialog => dialog.accept())
  await success.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).click()
  await success.page.getByText('Hoàn tất (Completed)', { exact: true }).waitFor()
  assert.equal(success.state.confirmCalls, 1)
  assert.deepEqual(success.state.confirmRequest, {
    method: 'POST',
    authorization: 'Bearer ui-customer-token',
  })
  assert.equal(await success.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).count(), 0)
  assert.deepEqual(success.state.pageErrors, [])
  results.push('Customer confirms a Processing order; the UI reloads and displays Completed')
  await success.context.close()

  const dismissed = await createOrderPage()
  dismissed.page.once('dialog', dialog => dialog.dismiss())
  await dismissed.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).click()
  await dismissed.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).waitFor()
  assert.equal(dismissed.state.confirmCalls, 0)
  assert.equal(await dismissed.page.getByText('Đang xử lý (Processing)', { exact: true }).count(), 1)
  await dismissed.context.close()
  results.push('Dismissing the confirmation dialog keeps the order in Processing without an API request')

  const rejected = await createOrderPage({ confirmStatus: 409 })
  rejected.page.once('dialog', dialog => dialog.accept())
  await rejected.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).click()
  await rejected.page.getByRole('alert').getByText('Đơn chưa thể xác nhận nhận hàng.', { exact: true }).waitFor()
  assert.equal(rejected.state.confirmCalls, 1)
  assert.equal(await rejected.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).count(), 1)
  assert.deepEqual(rejected.state.pageErrors, [])
  results.push('API rejection is shown and the Processing order remains available for retry')
  await rejected.context.close()

  const completed = await createOrderPage({ initialStatus: 'Completed' })
  assert.equal(await completed.page.getByRole('button', { name: '✓ Xác nhận đã nhận hàng' }).count(), 0)
  assert.deepEqual(completed.state.pageErrors, [])
  results.push('The confirmation button is hidden once the order is already Completed')
  await completed.context.close()

  console.log(JSON.stringify({ passed: true, channel, results }, null, 2))
} finally {
  await browser?.close()
  vite.kill()
}
