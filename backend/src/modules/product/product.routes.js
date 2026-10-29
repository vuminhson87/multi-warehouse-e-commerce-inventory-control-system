import { Router } from 'express'
import prisma from '../../db/prisma.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { runInTransaction } from '../../db/transaction.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { validationError, AppError, ErrorCodes } from '../../shared/errors.js'
import { listActiveProducts, findProductById, createProduct, updateProduct, discontinueProduct, activateProduct } from './product.repository.js'

export function paging(query) {
  if(Object.keys(query).some(k=>!['page','limit','search','category','warehouseId','productId'].includes(k))) throw validationError([{field:'query',reason:'Tham so khong duoc phep.'}])
  const page = query.page === undefined ? 1 : parsePositiveIntId(query.page, 'page')
  const limit = query.limit === undefined ? 100 : parsePositiveIntId(query.limit, 'limit')
  if (limit > 100) throw validationError([{ field: 'limit', reason: 'Toi da 100.' }])
  for (const field of ['search', 'category']) if (query[field] !== undefined && (typeof query[field] !== 'string' || query[field].length > 200)) throw validationError([{ field, reason: 'Chuoi toi da 200 ky tu.' }])
  return { page, limit, search: query.search, category: query.category }
}
export function validateBody(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(k => !allowed.includes(k))) throw validationError([{ field: 'body', reason: 'Du lieu khong hop le hoac co truong khong duoc phep.' }])
}
export async function attachStock(client, items) {
  const rows = await client.inventory.findMany({ where: { productId: { in: items.map(p => p.id) } }, select: { productId: true, onHand: true, reserved: true } })
  return items.map(p => ({ ...p, price: Number(p.price), status: p.isActive ? 'ACTIVE' : 'DISCONTINUED', maxAvailable: Math.max(0, ...rows.filter(r => r.productId === p.id).map(r => r.onHand - r.reserved)) }))
}
export async function managementProducts(query) {
  const { page, limit, search } = paging(query)
  const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {}
  const [total, items] = await prisma.$transaction([prisma.product.count({ where }), prisma.product.findMany({ where, orderBy: { id: 'asc' }, skip: (page-1)*limit, take: limit })])
  return { total, page, limit, items: await attachStock(prisma, items) }
}
const handle = fn => async (req,res,next) => { try { await fn(req,res) } catch(e) { next(e) } }
export const catalogRoutes = Router()
catalogRoutes.get('/', handle(async (req,res) => {
  const data = await listActiveProducts(prisma, paging(req.query))
  data.items = await attachStock(prisma, data.items)
  res.set('Cache-Control','no-store').json({ success: true, data })
}))
catalogRoutes.get('/:id', handle(async (req,res) => {
  const product = await findProductById(prisma, parsePositiveIntId(req.params.id,'productId'))
  if (!product) return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Khong tim thay san pham.' } })
  res.set('Cache-Control','no-store').json({ success: true, data: (await attachStock(prisma,[product]))[0] })
}))
export const adminProductRoutes = Router()
adminProductRoutes.use(requireAuth, requireRole('ADMIN'))
adminProductRoutes.get('/', handle(async (req,res) => res.json({ success: true, data: await managementProducts(req.query) })))
const fields = ['name','category','price','description']
function checkProduct(body, creating) {
  validateBody(body, fields)
  if (creating && fields.slice(0,3).some(k => body[k] === undefined)) throw validationError([{ field: 'product', reason: 'Thieu ten, danh muc hoac gia.' }])
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 10000)) throw validationError([{ field: 'description', reason: 'Mo ta toi da 10000 ky tu.' }])
  if (body.price !== undefined && (typeof body.price !== 'number' && typeof body.price !== 'string' || !/^\d+(\.\d{1,2})?$/.test(String(body.price)) || Number(body.price) <= 0 || Number(body.price) > 9999999999999.99)) throw validationError([{ field: 'price', reason: 'Gia duong, toi da 2 chu so thap phan.' }])
}
async function exists(tx,id) {
  if (!await tx.product.findUnique({where:{id}})) throw new AppError(ErrorCodes.PRODUCT_UNAVAILABLE,'San pham khong ton tai.')
}
adminProductRoutes.post('/', handle(async (req,res) => {
  checkProduct(req.body,true)
  const data = await runInTransaction(tx => createProduct(tx, req.body))
  res.status(201).json({ success: true, data })
}))
adminProductRoutes.patch('/:id', handle(async (req,res) => {
  checkProduct(req.body,false)
  const id = parsePositiveIntId(req.params.id,'productId')
  const data = await runInTransaction(async tx => { await exists(tx,id); return updateProduct(tx,id,req.body) })
  res.json({success:true,data})
}))
adminProductRoutes.post('/:id/discontinue', handle(async (req,res) => {
  validateBody(req.body,[])
  const id = parsePositiveIntId(req.params.id,'productId')
  const data = await runInTransaction(async tx => { await exists(tx,id); return discontinueProduct(tx,id) })
  res.json({success:true,data})
}))

adminProductRoutes.post('/:id/activate',handle(async(req,res)=>{
 validateBody(req.body,[])
 const id=parsePositiveIntId(req.params.id,'productId')
 const data=await runInTransaction(async tx=>{await exists(tx,id);return activateProduct(tx,id)})
 res.json({success:true,data:(await attachStock(prisma,[data]))[0]})
}))
