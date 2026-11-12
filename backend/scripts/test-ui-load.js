import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
const require = createRequire(import.meta.url)
const { chromium } = require(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const base = process.env.UI_TEST_URL ?? 'http://127.0.0.1:5173'
let browser
const contexts = [], samples = []
const deadline = setTimeout(() => {
  writeFileSync('tests/reports/ui-load-timeout.json', JSON.stringify({ completed: false, reason: '5 minute timeout', samples }, null, 2))
  Promise.race([browser?.close(), new Promise(resolve => setTimeout(resolve, 5000))]).finally(() => process.exit(1))
}, 300000)
const api = process.env.UI_TEST_API_URL ?? 'http://127.0.0.1:3001'
const products=[]
for(let page=1;;page++) {
 const response=await fetch(api+'/api/products?limit=100&page='+page)
 if(!response.ok)throw new Error('Catalog API unavailable')
 const {data}=await response.json()
 products.push(...data.items)
 if(products.length>=data.total)break
}
assert.ok(products.length>=100&&products.length<=300,'Seed 100-300 active DB products before UI load test')
const stocked=products.find(p=>p.maxAvailable>=2)
assert.ok(stocked,'At least one product needs 2 available units at one warehouse')
const search=stocked.name
const expected=products.filter(p=>(p.name+' '+p.category).toLowerCase().includes(search.toLowerCase())).length
try {
  browser=await chromium.launch({channel:'chrome',headless:true})
  const pages = await Promise.all(Array.from({ length: 30 }, async () => {
    const context = await browser.newContext()
    contexts.push(context)
    await context.addInitScript(data => {
      localStorage.setItem('cart_guest', JSON.stringify([{ productId: data.id, quantity: 1 }]))
    }, stocked)
    const page = await context.newPage()
    page.setDefaultTimeout(60000)
    await page.goto(base + '/products')
    await page.locator('.product-card').nth(products.length-1).waitFor()
    return page
  }))
  // Warm applications first; a barrier starts each group together.
  await Promise.all(pages.map(async (page, user) => {
    const start = performance.now()
    await page.getByPlaceholder('Tìm kiếm sản phẩm...').fill(search)
    await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click()
    await page.waitForFunction(count => document.querySelectorAll('.product-card').length === count,expected)
    samples.push({ user, group: 'catalogSearch', ms: performance.now() - start })
    await page.goto(base + '/cart')
    await page.getByText('Số lượng: 1', { exact: false }).first().waitFor()
  }))
  await Promise.all(pages.map(async (page, user) => {
    const start = performance.now()
    await page.getByRole('button', { name: '+', exact: true }).click()
    await page.getByText('Số lượng: 2', { exact: false }).first().waitFor()
    assert.ok((await page.locator('.cart-summary').innerText()).includes((Number(stocked.price)*2).toLocaleString('vi-VN')))
    samples.push({ user, group: 'cartUpdate', ms: performance.now() - start })
  }))
  const p95 = group => { const values = samples.filter(s => s.group === group).map(s => s.ms).sort((a,b) => a-b); return values[Math.ceil(values.length * .95) - 1] }
  const report = { at: new Date().toISOString(), users: 30, products: products.length, source: 'Catalog API backed by PostgreSQL; cart persists product IDs and quantities only', browser: browser.version(), catalogSearchP95Ms: p95('catalogSearch'), cartUpdateP95Ms: p95('cartUpdate'), samples }
  writeFileSync('tests/reports/latest-ui-load-result.json', JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ ...report, samples: samples.length }))
  assert.ok(report.catalogSearchP95Ms <= 3000, 'Catalog search P95 exceeds 3 seconds')
  assert.ok(report.cartUpdateP95Ms <= 2000, 'Cart update P95 exceeds 2 seconds')
} finally { clearTimeout(deadline); await Promise.all(contexts.map(c => c.close())); await browser?.close() }
