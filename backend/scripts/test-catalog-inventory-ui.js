import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { setTimeout } from 'node:timers/promises'
import { writeFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
const url=process.env.ACCEPTANCE_DATABASE_URL??'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse_m4_test?schema=public&connection_limit=40'
if(new URL(url).pathname!=='/multi_warehouse_m4_test')throw new Error('Dedicated test DB required')
const db=new PrismaClient({datasources:{db:{url}}})
const secret=randomUUID(),api='http://127.0.0.1:3303',ui='http://127.0.0.1:5174'
let backend,frontend,browser
const channel=process.env.UI_BROWSER_CHANNEL??'chrome'
const checks=[]
async function ready(base){for(let i=0;i<60;i++){try{if((await fetch(base)).ok)return}catch{/*startup*/}await setTimeout(500)}throw new Error('Server not ready: '+base)}
try{
 await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
 await db.warehouse.createMany({data:[1,2,3].map(i=>({code:'UI-'+i,name:'Warehouse '+i}))})
 await db.user.createMany({data:[{id:1,username:'customer',role:'CUSTOMER',passwordHash:'unused'},{id:31,username:'manager',role:'WAREHOUSE_MANAGER',assignedWarehouseId:1,passwordHash:'unused'},{id:32,username:'admin',role:'ADMIN',passwordHash:'unused'}]})
 await db.product.create({data:{sku:'UI-1',name:'Database product',category:'Laptop',price:'123.45',description:'Read from PostgreSQL'}})
 await db.inventory.createMany({data:[1,2,3].map(warehouseId=>({warehouseId,productId:1,onHand:warehouseId===1?10:0}))})
 backend=spawn(process.execPath,['src/server.js'],{env:{...process.env,DATABASE_URL:url,JWT_SECRET:secret,PORT:'3303',CORS_ORIGIN:ui,DEMO_MODE:'true',REDIS_ENABLED:'false'},stdio:'ignore'})
 frontend=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174','--strictPort'],{cwd:'..',env:{...process.env,VITE_API_URL:api},stdio:'ignore'})
 await ready(api+'/api/health');await ready(ui)
 browser=await chromium.launch({channel,headless:true})
 async function pageFor(id){
  const context=await browser.newContext({viewport:{width:375,height:812}})
  const user=id?await db.user.findUnique({where:{id}}):null
  if(user)delete user.passwordHash
  const token=user?jwt.sign({},secret,{subject:String(id),algorithm:'HS256'}):null
  await context.addInitScript(({user,token})=>{
   localStorage.setItem('admin_products',JSON.stringify([{id:1,name:'FORGED LOCAL PRODUCT',price:1,status:'ACTIVE'}]))
   localStorage.setItem('warehouse_inventory',JSON.stringify([{warehouseId:1,productId:1,onHand:99999,reserved:0}]))
   if(token){sessionStorage.setItem('mw_access_token',token);sessionStorage.setItem('currentUser',JSON.stringify(user))}
  },{user,token})
  const page=await context.newPage();page.setDefaultTimeout(15000)
  page.on('pageerror',error=>checks.push({pageError:error.message}))
  return page
 }
 const guest=await pageFor()
 await guest.goto(ui+'/products/1')
 await guest.getByRole('heading',{name:'Database product',exact:true}).waitFor()
 assert.equal(await guest.getByText('FORGED LOCAL PRODUCT').count(),0)
 await guest.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click()
 await guest.goto(ui+'/cart')
 await guest.getByText('Số lượng: 1').first().waitFor()
 checks.push({test:'Catalog/cart ignore forged localStorage and use PostgreSQL product',passed:true})
 const customer=await pageFor(1)
 await customer.goto(ui+'/products/1')
 await customer.getByRole('button',{name:'Thêm vào giỏ hàng',exact:true}).click()
 await customer.goto(ui+'/checkout')
 await customer.locator('button').filter({hasText:'Xác nhận'}).last().click()
 await customer.waitForURL('**/order-result/*')
 await customer.getByText('Database product',{exact:false}).first().waitFor()
 const stock=await db.inventory.findFirst({where:{warehouseId:1,productId:1}})
 assert.equal(stock.onHand,10);assert.equal(stock.reserved,1)
 checks.push({test:'Customer checkout reserves via backend only',passed:true})
 const manager=await pageFor(31)
 await manager.goto(ui+'/inventory/warehouses')
 await manager.getByRole('button',{name:'Nhập hàng',exact:true}).first().click()
 await manager.getByLabel('Số lượng nhập').fill('5')
 await manager.getByRole('button',{name:'Lưu',exact:true}).click()
 await manager.getByText('Đã nhập bổ sung vào kho.',{exact:true}).waitFor()
 await manager.waitForFunction(()=>document.querySelector('tbody tr')?.innerText.includes('15'))
 assert.equal((await db.inventory.findFirst({where:{warehouseId:1,productId:1}})).onHand,15)
 await manager.locator('select').selectOption('2')
 assert.equal(await manager.getByRole('button',{name:'Nhập hàng',exact:true}).count(),0)
 checks.push({test:'Manager restock persists, other warehouse is read-only',passed:true})
 await manager.goto(ui+'/inventory/alerts')
 await manager.getByLabel('Ngưỡng',{exact:true}).fill('14')
 await manager.getByRole('button',{name:'Lưu ngưỡng',exact:true}).click()
 await manager.getByText('Đã lưu ngưỡng tại kho của bạn.').waitFor()
 await manager.locator('tbody').getByText('Database product',{exact:true}).waitFor()
 checks.push({test:'Threshold equality alert comes from database',passed:true})
 const draft=manager.getByLabel('Ngưỡng',{exact:true})
 await draft.fill('13');await draft.focus()
 const beforeY=(await manager.getByRole('heading',{name:'Cảnh báo tồn kho thấp',exact:true}).boundingBox()).y
 let inventoryRequests=0
 manager.on('request',request=>{if(request.url().includes('/api/inventory?'))inventoryRequests++})
 const background=manager.waitForResponse(response=>response.url().includes('/api/inventory/summary')&&response.ok())
 await manager.evaluate(()=>{for(let i=0;i<3;i++)window.dispatchEvent(new Event('warehouse-data-changed'))})
 await background
 await manager.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 assert.equal(await draft.inputValue(),'13')
 assert.ok(await draft.evaluate(el=>el===document.activeElement))
 assert.equal((await manager.getByRole('heading',{name:'Cảnh báo tồn kho thấp',exact:true}).boundingBox()).y,beforeY)
 assert.equal(inventoryRequests,1)
 checks.push({test:'Background refresh is coalesced, preserves draft/focus and heading position',passed:true})
 await manager.route(/\/api\/inventory\?/,route=>route.abort())
 await manager.evaluate(()=>window.dispatchEvent(new Event('warehouse-data-changed')))
 await manager.locator('.alerts-page > p[role="alert"]').waitFor()
 assert.equal(await draft.inputValue(),'13')
 assert.equal((await manager.getByRole('heading',{name:'Cảnh báo tồn kho thấp',exact:true}).boundingBox()).y,beforeY)
 assert.equal(await manager.locator('tbody tr').count(),1)
 await manager.unroute(/\/api\/inventory\?/)
 await manager.evaluate(()=>window.dispatchEvent(new Event('warehouse-data-changed')))
 await manager.locator('.alerts-page > p[role="alert"]').waitFor({state:'detached'})
 checks.push({test:'Background network failure retains inventory and form without layout shift',passed:true})
 await manager.goto(ui+'/inventory')
 await manager.getByRole('searchbox').fill('Database')
 await manager.locator('#warehouse-filter').selectOption('2')
 await manager.waitForFunction(()=>document.querySelectorAll('.inventory-table:last-child tbody tr').length>0)
 assert.equal(await manager.getByRole('searchbox').evaluate(el=>getComputedStyle(el).borderRadius),'10px')
 assert.equal(await manager.locator('#warehouse-filter').evaluate(el=>getComputedStyle(el).borderRadius),'10px')
 await manager.screenshot({path:'tests/reports/api-ui-'+channel+'-warehouse-filters-375.png',fullPage:true})
 const dashboardWidth=await manager.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}))
 assert.ok(dashboardWidth.scroll<=dashboardWidth.width+1)
 checks.push({test:'Warehouse search/filter controls styled and usable at 375px',passed:true})
 await manager.goto(ui+'/inventory/alerts')
 await manager.locator('tbody').getByText('Database product',{exact:true}).waitFor()
 const admin=await pageFor(32)
 await admin.goto(ui+'/admin/products/1/edit')
 await admin.locator('input[name="name"]').fill('Renamed in database')
 await admin.locator('button[type="submit"]').click()
 await admin.waitForURL('**/admin/products')
 await admin.getByText('Renamed in database',{exact:true}).waitFor()
 assert.equal((await db.product.findUnique({where:{id:1}})).name,'Renamed in database')
 await admin.getByLabel('Trạng thái kinh doanh của Renamed in database').selectOption('DISCONTINUED')
 await admin.waitForFunction(()=>{const select=document.querySelector('select[aria-label^="Trạng thái kinh doanh"]');return select?.value==='DISCONTINUED'&&!select.disabled})
 await guest.goto(ui+'/products')
 await guest.getByText('Không tìm thấy sản phẩm phù hợp.',{exact:true}).waitFor()
 checks.push({test:'Admin update/discontinue persists and public catalog hides discontinued product',passed:true})
 const stockBefore=await db.inventory.findMany({orderBy:{warehouseId:'asc'}})
 await admin.getByLabel('Trạng thái kinh doanh của Renamed in database').click()
 await admin.screenshot({path:'tests/reports/api-ui-'+channel+'-status-dropdown.png',fullPage:true})
 await admin.keyboard.press('Escape')
 await admin.getByLabel('Trạng thái kinh doanh của Renamed in database').selectOption('ACTIVE')
 await admin.waitForFunction(()=>{const select=document.querySelector('select[aria-label^="Trạng thái kinh doanh"]');return select?.value==='ACTIVE'&&!select.disabled})
 await guest.reload()
 await guest.getByRole('heading',{name:'Renamed in database',exact:true}).waitFor()
 assert.deepEqual(await db.inventory.findMany({orderBy:{warehouseId:'asc'}}),stockBefore)
 checks.push({test:'Admin reactivation returns product to catalog without changing inventory',passed:true})
 const offline=await pageFor()
 await offline.route('**/api/products**',route=>route.abort())
 await offline.goto(ui+'/products')
 await offline.getByRole('alert').first().waitFor()
 assert.equal(await offline.getByText('FORGED LOCAL PRODUCT').count(),0)
 checks.push({test:'API failure shows error without local mock fallback',passed:true})
 for(const [page,name] of [[guest,'catalog'],[manager,'alerts'],[admin,'admin']]){
  const width=await page.evaluate(()=>({scroll:document.documentElement.scrollWidth,width:innerWidth}))
  assert.ok(width.scroll<=width.width+1,name+' horizontal overflow at 375px')
  await page.screenshot({path:'tests/reports/api-ui-'+channel+'-'+name+'-375.png',fullPage:true})
 }
 assert.ok(!checks.some(c=>c.pageError))
 writeFileSync('tests/reports/catalog-inventory-ui-'+channel+'.json',JSON.stringify({at:new Date().toISOString(),passed:true,channel,checks},null,2))
 console.log(JSON.stringify(checks,null,2))
}catch(error){writeFileSync('tests/reports/catalog-inventory-ui.json',JSON.stringify({at:new Date().toISOString(),passed:false,channel,error:error.message,checks},null,2));throw error}
finally{await browser?.close();backend?.kill();frontend?.kill();await db.$disconnect()}
