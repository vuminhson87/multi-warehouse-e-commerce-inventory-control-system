import { beforeAll,beforeEach,afterAll,describe,it,expect } from 'vitest'
import { randomUUID } from 'node:crypto'
if(!process.env.DATABASE_URL||new URL(process.env.DATABASE_URL).pathname!=='/multi_warehouse_m4_test')throw new Error('Dedicated acceptance database required')
process.env.JWT_SECRET=randomUUID()
const {default:db}=await import('../../src/db/prisma.js')
const {default:app}=await import('../../src/app.js')
const {default:jwt}=await import('jsonwebtoken')
const {createCheckoutOrder}=await import('../../src/modules/order/order.service.js')
let server,base
async function request(path,user,method='GET',body){
 const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(user?{Authorization:'Bearer '+jwt.sign({},process.env.JWT_SECRET,{subject:String(user),algorithm:'HS256'})}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})})
 return {status:response.status,body:await response.json()}
}
beforeAll(async()=>{server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));base='http://127.0.0.1:'+server.address().port})
afterAll(async()=>{await new Promise(resolve=>server.close(resolve));await db.$disconnect()})
beforeEach(async()=>{
 await db.$executeRawUnsafe('TRUNCATE TABLE idempotency_records, inventory_movements, payment_attempts, stock_reservations, order_items, orders, low_stock_alerts, inventories, products, users, warehouses RESTART IDENTITY CASCADE')
 await db.warehouse.createMany({data:[1,2,3].map(i=>({code:'W'+i,name:'Warehouse '+i}))})
 await db.user.createMany({data:[{id:1,username:'customer',passwordHash:'unused',role:'CUSTOMER'},{id:31,username:'manager',passwordHash:'unused',role:'WAREHOUSE_MANAGER',assignedWarehouseId:1},{id:32,username:'admin',passwordHash:'unused',role:'ADMIN'},{id:33,username:'manager2',passwordHash:'unused',role:'WAREHOUSE_MANAGER',assignedWarehouseId:2}]})
 await db.product.create({data:{sku:'CAT-1',name:'Database product',category:'Database category',price:'123.45',description:'Database description'}})
 await db.inventory.createMany({data:[1,2,3].map(warehouseId=>({warehouseId,productId:1,onHand:warehouseId===1?10:5}))})
})
describe('SR-CAT/INV/ALERT/PROD real HTTP data and warehouse scope',()=>{
 it('public catalog/search/detail use active DB data and expose no warehouse rows',async()=>{
  const result=await request('/api/products?search=category')
  expect(result.status).toBe(200)
  expect(result.body.data.items).toHaveLength(1)
  expect(result.body.data.items[0]).toMatchObject({name:'Database product',available:20,maxAvailable:10,status:'ACTIVE'})
  expect(result.body.data.items[0]).not.toHaveProperty('reserved')
  expect(result.body.data.items[0]).not.toHaveProperty('warehouseId')
  const detail=await request('/api/products/1')
  expect(detail.body.data.description).toBe('Database description')
  expect((await request('/api/products?search=missing')).body.data.items).toEqual([])
 })
 it('RBAC denies guests/customers/admin inventory access and managers admin mutations',async()=>{
  expect((await request('/api/inventory')).status).toBe(401)
  expect((await request('/api/inventory',1)).status).toBe(403)
  expect((await request('/api/inventory',32)).status).toBe(403)
  expect((await request('/api/admin/products',31)).status).toBe(403)
  expect((await request('/api/admin/products',1,'POST',{})).status).toBe(403)
 })
 it('manager reads all three warehouses and server aggregate',async()=>{
  expect((await request('/api/inventory',31)).body.data.items).toHaveLength(3)
  expect((await request('/api/inventory?warehouseId=2',31)).body.data.items[0].warehouseId).toBe(2)
  expect((await request('/api/inventory/summary',31)).body.data[0]).toMatchObject({onHand:20,reserved:0,available:20})
 })
 it('cross-warehouse restock/threshold/alerts are forbidden without database changes',async()=>{
  expect((await request('/api/inventory/2/restock',31,'POST',{productId:1,quantity:7})).status).toBe(403)
  expect((await request('/api/inventory/2/threshold',31,'PATCH',{productId:1,threshold:99})).status).toBe(403)
  expect((await request('/api/inventory/alerts?warehouseId=2',31)).status).toBe(403)
  expect(await db.inventory.findUnique({where:{warehouseId_productId:{warehouseId:2,productId:1}}})).toMatchObject({onHand:5,lowStockThreshold:0})
 })
 it('threshold equality opens own alert, restock updates stock and resolves alert',async()=>{
  expect((await request('/api/inventory/1/threshold',31,'PATCH',{productId:1,threshold:10})).status).toBe(200)
  expect((await request('/api/inventory/alerts',31)).body.data).toEqual([expect.objectContaining({warehouseId:1,currentAvailable:10,threshold:10})])
  expect((await request('/api/inventory/alerts',33)).body.data).toEqual([])
  expect((await request('/api/inventory/1/restock',31,'POST',{productId:1,quantity:5})).status).toBe(200)
  expect((await request('/api/inventory/alerts',31)).body.data).toEqual([])
  expect((await request('/api/products/1')).body.data.maxAvailable).toBe(15)
 })
 it.each([0,-1,1.5,'5',100001])('invalid restock quantity %s is rejected',async quantity=>{
  expect((await request('/api/inventory/1/restock',31,'POST',{productId:1,quantity})).status).toBe(400)
  expect(await db.inventoryMovement.count()).toBe(0)
 })
 it('admin creates zero stock for every DB warehouse and input cannot set inventory/role',async()=>{
  const result=await request('/api/admin/products',32,'POST',{name:'New',category:'Test',price:'10.50',description:'Test'})
  expect(result.status).toBe(201)
  expect(await db.inventory.findMany({where:{productId:result.body.data.id}})).toEqual([expect.objectContaining({onHand:0,reserved:0}),expect.objectContaining({onHand:0,reserved:0}),expect.objectContaining({onHand:0,reserved:0})])
  expect((await request('/api/admin/products',32,'POST',{name:'Forged',category:'Test',price:10,warehouseIds:[1]})).status).toBe(400)
 })
 it('admin update/discontinue persists, public catalog hides it while history snapshot survives',async()=>{
  const order=(await createCheckoutOrder(1,{idempotencyKey:randomUUID(),items:[{productId:1,quantity:1}]})).data
  expect((await request('/api/admin/products/1',32,'PATCH',{name:'Renamed',price:'999.99'})).status).toBe(200)
  expect((await request('/api/admin/products/1/discontinue',32,'POST',{})).status).toBe(200)
  expect((await request('/api/products')).body.data.items).toEqual([])
  expect((await request('/api/products/1')).status).toBe(404)
  expect((await request('/api/admin/products',32)).body.data.items[0]).toMatchObject({status:'DISCONTINUED',name:'Renamed'})
  expect((await request('/api/orders/'+order.orderId,1)).body.data.items[0]).toMatchObject({productName:'Database product',unitPrice:'123.45'})
 })
 it('admin reactivation restores catalog visibility without inventory/history changes',async()=>{
  const order=(await createCheckoutOrder(1,{idempotencyKey:randomUUID(),items:[{productId:1,quantity:1}]})).data
  await request('/api/admin/products/1/discontinue',32,'POST',{})
  const before=await db.inventory.findMany({orderBy:{warehouseId:'asc'}})
  expect((await request('/api/admin/products/1/activate',1,'POST',{})).status).toBe(403)
  expect((await request('/api/admin/products/1/activate',31,'POST',{})).status).toBe(403)
  expect((await request('/api/admin/products/1/activate',undefined,'POST',{})).status).toBe(401)
  expect((await request('/api/admin/products/1/activate',32,'POST',{onHand:99})).status).toBe(400)
  expect((await request('/api/admin/products/1/activate',32,'POST',{})).status).toBe(200)
  expect((await request('/api/products/1')).body.data).toMatchObject({isActive:true,status:'ACTIVE',discontinuedAt:null})
  expect(await db.inventory.findMany({orderBy:{warehouseId:'asc'}})).toEqual(before)
  expect((await request('/api/orders/'+order.orderId,1)).body.data.items[0]).toMatchObject({productName:'Database product',unitPrice:'123.45'})
  expect((await request('/api/admin/products/9999/activate',32,'POST',{})).status).toBe(409)
 })
 it('validates pagination, ID, price precision and ignores no sensitive client fields',async()=>{
  for(const path of ['/api/products?limit=101','/api/products?page=1abc','/api/products?search[x]=test','/api/products/1abc'])expect((await request(path)).status).toBe(400)
  for(const price of [false,{},'1.999',-1])expect((await request('/api/admin/products/1',32,'PATCH',{price})).status).toBe(400)
  expect((await request('/api/inventory/1/restock',31,'POST',{productId:1,quantity:1,warehouseId:2})).status).toBe(400)
 })
})
