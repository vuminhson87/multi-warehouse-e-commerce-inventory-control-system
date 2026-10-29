import { createRequire } from 'node:module'
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { performance } from 'node:perf_hooks'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.UI_TEST_URL ?? 'http://127.0.0.1:5173'
const results = []
for (const channel of ['chrome', 'msedge']) {
  const browser = await chromium.launch({ channel, headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } })
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base + '/products/1')
    await page.getByRole('button', { name: 'Thêm vào giỏ hàng', exact: true }).click()
    await page.goto(base + '/cart')
    await page.getByText('Số lượng: 1', { exact: false }).first().waitFor()
    const start = performance.now()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByText('Số lượng: 2', { exact: false }).first().waitFor()
    assert.match(await page.locator('.cart-summary').innerText(), /31\.980\.000/)
    const updateMs = performance.now() - start
    assert.ok(updateMs <= 2000, 'cart update exceeds 2 seconds')
    await page.getByRole('button', { name: '-', exact: true }).click()
    await page.getByText('Số lượng: 1', { exact: false }).first().waitFor()
    await page.reload()
    await page.getByText('Số lượng: 1', { exact: false }).first().waitFor()
    const overflows = []
    for (const path of ['/products', '/products/1', '/cart', '/login']) {
      await page.goto(base + path)
      const sizes = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }))
      if (sizes.scroll > sizes.width + 1) overflows.push({ path, ...sizes })
      await page.screenshot({ path: `tests/reports/${channel}-${path.replaceAll('/', '_')}-375.png`, fullPage: true })
    }
    await page.goto(base + '/cart')
    await page.getByRole('button', { name: 'Xóa', exact: true }).click()
    assert.equal(await page.locator('.cart-empty').count(), 1)
    results.push({ channel, version: browser.version(), viewport: 375, cart: 'passed', updateMs, overflows, errors })
  } finally { await browser.close() }
}
writeFileSync('tests/reports/latest-browser-result.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
assert.ok(results.every(r => r.overflows.length === 0 && r.errors.length === 0), 'responsive overflow or browser errors detected; see report')
