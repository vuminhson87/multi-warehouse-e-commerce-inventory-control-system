import crypto from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express, { Router } from 'express'
import prisma from '../../db/prisma.js'
import {
  CacheKeys,
  getOrSetCache,
  invalidateProductCache,
  loadCacheConfig,
} from '../../db/redis.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { runInTransaction } from '../../db/transaction.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { AuditAction, AuditTargetType, writeAdminAuditLog } from '../audit/audit.repository.js'
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
export async function attachStock(client, items, warehouseId) {
  const rows = await client.inventory.findMany({ where: { warehouseId, productId: { in: items.map(p => p.id) } }, select: { productId: true, onHand: true, reserved: true } })
  return items.map(p => ({ ...p, price: Number(p.price), status: p.isActive ? 'ACTIVE' : 'DISCONTINUED', maxAvailable: Math.max(0, ...rows.filter(r => r.productId === p.id).map(r => r.onHand - r.reserved)) }))
}
export async function managementProducts(query, warehouseId) {
  const { page, limit, search } = paging(query)
  const where = search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {}
  const [total, items] = await prisma.$transaction([prisma.product.count({ where }), prisma.product.findMany({ where, orderBy: { id: 'asc' }, skip: (page-1)*limit, take: limit })])
  return { total, page, limit, items: await attachStock(prisma, items, warehouseId) }
}
const handle = fn => async (req,res,next) => { try { await fn(req,res) } catch(e) { next(e) } }
export const catalogRoutes = Router()
catalogRoutes.get('/availability', handle(async (req, res) => {
  const rawProductIds = req.query.productIds
  if (typeof rawProductIds !== 'string' || !rawProductIds.trim() || rawProductIds.length > 1000) {
    throw validationError([{ field: 'productIds', reason: 'Danh sách productIds không hợp lệ.' }])
  }
  const productIds = [...new Set(rawProductIds.split(',').map(value => parsePositiveIntId(value, 'productId')))]
  if (productIds.length > 50) {
    throw validationError([{ field: 'productIds', reason: 'Tối đa 50 sản phẩm.' }])
  }

  const [warehouses, rows] = await Promise.all([
    prisma.warehouse.findMany({ select: { id: true, name: true }, orderBy: { id: 'asc' } }),
    prisma.inventory.findMany({
      where: { productId: { in: productIds } },
      select: { warehouseId: true, productId: true, onHand: true, reserved: true },
    }),
  ])

  res.set('Cache-Control', 'no-store').json({
    success: true,
    data: {
      warehouses,
      items: rows.map(row => ({
        warehouseId: row.warehouseId,
        productId: row.productId,
        available: Math.max(0, row.onHand - row.reserved),
      })),
    },
  })
}))
catalogRoutes.get('/', handle(async (req,res) => {
  const query = paging(req.query)
  const { catalogTtlSeconds } = loadCacheConfig()
  const data = await getOrSetCache(
    CacheKeys.catalogList(query),
    catalogTtlSeconds,
    async () => {
      const result = await listActiveProducts(prisma, query)
      result.items = await attachStock(prisma, result.items)
      return result
    }
  )
  res.set('Cache-Control','no-store').json({ success: true, data })
}))
catalogRoutes.get('/:id', handle(async (req,res) => {
  const productId = parsePositiveIntId(req.params.id,'productId')
  const { catalogTtlSeconds } = loadCacheConfig()
  const data = await getOrSetCache(
    CacheKeys.catalogDetail(productId),
    catalogTtlSeconds,
    async () => {
      const product = await findProductById(prisma, productId)
      if (!product) return undefined
      return (await attachStock(prisma, [product]))[0]
    }
  )
  if (!data) return res.status(404).json({ success: false, error: { code: 'PRODUCT_NOT_FOUND', message: 'Khong tim thay san pham.' } })
  res.set('Cache-Control','no-store').json({ success: true, data })
}))
const ASSET_ORIGIN = 'https://storefront.invalid'
export const UPLOADS_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../uploads'
)
const PRODUCT_UPLOADS_DIR = path.join(UPLOADS_ROOT, 'products')

function detectImageExtension(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'png'
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg'
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'GIF8' &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  ) {
    return 'gif'
  }
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp'
  }
  return null
}

export function normalizeProductImageUrl(value, field = 'imageUrl') {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    throw validationError([{ field, reason: 'Đường dẫn ảnh phải là chuỗi ký tự.' }])
  }

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 500) {
    throw validationError([{ field, reason: 'Đường dẫn ảnh tối đa 500 ký tự.' }])
  }

  let parsed
  try {
    parsed = new URL(trimmed, ASSET_ORIGIN)
  } catch {
    throw validationError([{ field, reason: 'Đường dẫn ảnh không hợp lệ.' }])
  }

  const isInternal =
    (trimmed.startsWith('/images/') || trimmed.startsWith('/uploads/')) &&
    parsed.origin === ASSET_ORIGIN &&
    (parsed.pathname.startsWith('/images/') || parsed.pathname.startsWith('/uploads/'))
  const isExternal =
    /^https?:\/\//i.test(trimmed) &&
    (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
    !parsed.username &&
    !parsed.password

  if (!isInternal && !isExternal) {
    throw validationError([
      { field, reason: 'Đường dẫn ảnh phải là URL http(s) hoặc /images/, /uploads/ hợp lệ.' },
    ])
  }

  return trimmed
}

export const adminProductRoutes = Router()
adminProductRoutes.use(requireAuth, requireRole('ADMIN'))
adminProductRoutes.get('/', handle(async (req,res) => res.json({ success: true, data: await managementProducts(req.query) })))
const fields = ['name','category','price','description','imageUrl']
function checkProduct(body, creating) {
  validateBody(body, fields)
  if (creating && fields.slice(0,3).some(k => body[k] === undefined)) throw validationError([{ field: 'product', reason: 'Thieu ten, danh muc hoac gia.' }])
  if (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 10000)) throw validationError([{ field: 'description', reason: 'Mo ta toi da 10000 ky tu.' }])
  if (body.price !== undefined && (typeof body.price !== 'number' && typeof body.price !== 'string' || !/^\d+(\.\d{1,2})?$/.test(String(body.price)) || Number(body.price) <= 0 || Number(body.price) > 9999999999999.99)) throw validationError([{ field: 'price', reason: 'Gia duong, toi da 2 chu so thap phan.' }])
  if (body.imageUrl !== undefined) {
    body.imageUrl = normalizeProductImageUrl(body.imageUrl, 'imageUrl')
  }
}
async function exists(tx,id) {
  if (!await tx.product.findUnique({where:{id}})) throw new AppError(ErrorCodes.PRODUCT_UNAVAILABLE,'San pham khong ton tai.')
}
adminProductRoutes.post(
  '/upload-image',
  express.raw({
    type: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
    limit: '3mb',
  }),
  handle(async (req, res) => {
    const ext = detectImageExtension(req.body)
    if (!ext) {
      throw validationError([
        {
          field: 'image',
          reason: 'Tệp tải lên phải là ảnh PNG, JPG, WEBP hoặc GIF hợp lệ (tối đa 3MB).',
        },
      ])
    }

    await mkdir(PRODUCT_UPLOADS_DIR, { recursive: true })
    const fileName = `${crypto.randomUUID()}.${ext}`
    await writeFile(path.join(PRODUCT_UPLOADS_DIR, fileName), req.body)

    res.status(201).json({
      success: true,
      data: { imageUrl: `/uploads/products/${fileName}` },
    })
  })
)
adminProductRoutes.post('/', handle(async (req,res) => {
  checkProduct(req.body,true)
  const data = await runInTransaction(async tx => {
    const created = await createProduct(tx, req.body)
    await writeAdminAuditLog(tx, {
      actor: req.user,
      action: AuditAction.PRODUCT_CREATE,
      targetType: AuditTargetType.PRODUCT,
      targetId: created.id,
      summary: `Thêm sản phẩm #${created.id}: ${created.name}`,
      metadata: { sku: created.sku, category: created.category, price: created.price },
    })
    return created
  })
  await invalidateProductCache({ productIds: [data.id] })
  res.status(201).json({ success: true, data })
}))
adminProductRoutes.patch('/:id', handle(async (req,res) => {
  checkProduct(req.body,false)
  const id = parsePositiveIntId(req.params.id,'productId')
  const updatedFields = Object.keys(req.body)
  const data = await runInTransaction(async tx => {
    await exists(tx,id)
    const updated = await updateProduct(tx,id,req.body)
    await writeAdminAuditLog(tx, {
      actor: req.user,
      action: AuditAction.PRODUCT_UPDATE,
      targetType: AuditTargetType.PRODUCT,
      targetId: updated.id,
      summary: `Cập nhật sản phẩm #${updated.id}: ${updated.name}`,
      metadata: { updatedFields, category: updated.category, price: updated.price },
    })
    return updated
  })
  await invalidateProductCache({ productIds: [id] })
  res.json({success:true,data})
}))
adminProductRoutes.post('/:id/discontinue', handle(async (req,res) => {
  validateBody(req.body,[])
  const id = parsePositiveIntId(req.params.id,'productId')
  const data = await runInTransaction(async tx => {
    await exists(tx,id)
    const updated = await discontinueProduct(tx,id)
    await writeAdminAuditLog(tx, {
      actor: req.user,
      action: AuditAction.PRODUCT_DISCONTINUE,
      targetType: AuditTargetType.PRODUCT,
      targetId: updated.id,
      summary: `Ngừng kinh doanh sản phẩm #${updated.id}: ${updated.name}`,
      metadata: { isActive: false },
    })
    return updated
  })
  await invalidateProductCache({ productIds: [id] })
  res.json({success:true,data})
}))

adminProductRoutes.post('/:id/activate',handle(async(req,res)=>{
 validateBody(req.body,[])
 const id=parsePositiveIntId(req.params.id,'productId')
 const data=await runInTransaction(async tx=>{
   await exists(tx,id)
   const updated = await activateProduct(tx,id)
   await writeAdminAuditLog(tx, {
     actor: req.user,
     action: AuditAction.PRODUCT_ACTIVATE,
     targetType: AuditTargetType.PRODUCT,
     targetId: updated.id,
     summary: `Mở bán lại sản phẩm #${updated.id}: ${updated.name}`,
     metadata: { isActive: true },
   })
   return updated
 })
 await invalidateProductCache({ productIds: [id] })
 res.json({success:true,data:(await attachStock(prisma,[data]))[0]})
}))
