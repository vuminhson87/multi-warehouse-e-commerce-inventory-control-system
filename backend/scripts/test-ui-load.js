import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.UI_TEST_URL ?? 'http://127.0.0.1:5173'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const contexts = [], samples = []
const deadline = setTimeout(() => {
  writeFileSync('tests/reports/ui-load-timeout.json', JSON.stringify({ completed: false, reason: '5 minute timeout', samples }, null, 2))
  Promise.race([browser.close(), new Promise(resolve => setTimeout(resolve, 5000))]).finally(() => process.exit(1))
}, 300000)
const products = Array.from({ length: 120 }, (_, i) => ({ id: i + 1, name: `M4 Product ${i + 1}`, category: 'M4', price: 123, description: 'Load fixture', status: 'ACTIVE' }))
try {
  const pages = await Promise.all(Array.from({ length: 30 }, async () => {
    const context = await browser.newContext()
    contexts.push(context)
    await context.addInitScript(data => {
      localStorage.setItem('admin_products', JSON.stringify(data))
      localStorage.setItem('cart_guest', JSON.stringify([{ productId: 1, quantity: 1 }]))
    }, products)
    const page = await context.newPage()
    page.setDefaultTimeout(60000)
    await page.goto(base + '/products')
    await page.locator('.product-card').nth(119).waitFor()
    return page
  }))
  // Warm applications first; a barrier starts each group together.
  await Promise.all(pages.map(async (page, user) => {
    const start = performance.now()
    await page.getByPlaceholder('Tìm kiếm sản phẩm...').fill('M4 Product 120')
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.product-card').length === 1)
    samples.push({ user, group: 'catalogSearch', ms: performance.now() - start })
    await page.goto(base + '/cart')
    await page.getByText('Số lượng: 1', { exact: false }).first().waitFor()
  }))
  await Promise.all(pages.map(async (page, user) => {
    const start = performance.now()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByText('Số lượng: 2', { exact: false }).first().waitFor()
    assert.match(await page.locator('.cart-summary').innerText(), /246/)
    samples.push({ user, group: 'cartUpdate', ms: performance.now() - start })
  }))
  const p95 = group => { const values = samples.filter(s => s.group === group).map(s => s.ms).sort((a,b) => a-b); return values[Math.ceil(values.length * .95) - 1] }
  const report = { at: new Date().toISOString(), users: 30, products: 120, source: 'frontend localStorage fixture; no catalog API exists yet', browser: browser.version(), catalogSearchP95Ms: p95('catalogSearch'), cartUpdateP95Ms: p95('cartUpdate'), samples }
  writeFileSync('tests/reports/latest-ui-load-result.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, samples: samples.length }))
  assert.ok(report.catalogSearchP95Ms <= 3000, 'Catalog search P95 exceeds 3 seconds')
  assert.ok(report.cartUpdateP95Ms <= 2000, 'Cart update P95 exceeds 2 seconds')
} finally { clearTimeout(deadline); await Promise.all(contexts.map(c => c.close())); await browser.close() }
