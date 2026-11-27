import { Router } from 'express'
import prisma from '../../db/prisma.js'
import {
  CacheKeys,
  getOrSetCache,
  invalidateInventoryCache,
  loadCacheConfig,
} from '../../db/redis.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { runInTransaction } from '../../db/transaction.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { paging, validateBody, managementProducts } from '../product/product.routes.js'
import {
  MovementType,
  adjustInventory,
  listInventory,
  listInventoryMovements,
  getInventorySummary,
  listOpenAlerts,
  restockInventory,
  setLowStockThreshold,
  syncAllLowStockAlerts,
} from './inventory.repository.js'
const router = Router()
router.use(requireAuth, requireRole('ADMIN', 'WAREHOUSE_MANAGER'))
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
const handle = fn => async (req, res, next) => { try { await fn(req, res) } catch (error) { next(error) } }

function assertAssignedManagerWarehouse(req) {
  const assigned = req.user.assignedWarehouseId
  if (req.user.role === 'WAREHOUSE_MANAGER' && !assigned) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Tài khoản chưa được phân công kho.')
  }
  return assigned
}

// Nghiệp vụ 5A: Quản lý kho được XEM tồn kho của tất cả các kho và tổng tồn kho toàn hệ thống.
function readAllWarehousesScope(req, raw = req.query.warehouseId) {
  assertAssignedManagerWarehouse(req)
  return raw === undefined ? undefined : parsePositiveIntId(raw, 'warehouseId')
}

// Khóa chặt phạm vi thao tác (cảnh báo, biến động, nhập hàng, đặt ngưỡng, kiểm kê) theo đúng kho phụ trách.
function assignedWarehouseScope(req, raw = req.query.warehouseId) {
  const assigned = assertAssignedManagerWarehouse(req)

  const warehouseId = raw === undefined
    ? req.user.role === 'ADMIN' ? undefined : assigned
    : parsePositiveIntId(raw, 'warehouseId')

  if (req.user.role === 'WAREHOUSE_MANAGER' && warehouseId !== assigned) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Chỉ được thao tác kho được phân công.')
  }

  return warehouseId
}

router.get('/products', handle(async (req, res) => {
  const data = await managementProducts(req.query, assignedWarehouseScope(req))
  res.json({ success: true, data })
}))
router.get('/warehouses', handle(async (req, res) => {
  const warehouseId = readAllWarehousesScope(req)
  const data = await prisma.warehouse.findMany({
    where: { id: warehouseId },
    select: { id: true, name: true, code: true },
    orderBy: { id: 'asc' },
  })
  res.json({ success: true, data })
}))
router.get('/summary', handle(async (req, res) => {
  const warehouseId = readAllWarehousesScope(req)
  const productId = req.query.productId === undefined ? undefined : parsePositiveIntId(req.query.productId, 'productId')
  const { inventoryTtlSeconds } = loadCacheConfig()
  const data = await getOrSetCache(
    CacheKeys.inventorySummary({ warehouseId, productId }),
    inventoryTtlSeconds,
    () => getInventorySummary(prisma, { warehouseId, productId })
  )
  res.json({ success: true, data })
}))
router.get('/alerts', handle(async (req, res) => {
  const warehouseId = assignedWarehouseScope(req)
  await syncAllLowStockAlerts(prisma, { warehouseId })
  const data = await listOpenAlerts(prisma, { warehouseId })
  res.json({ success: true, data })
}))
function parseMovementQuery(query = {}) {
  const allowed = ['page', 'limit', 'warehouseId', 'productId', 'type', 'search']
  const unknown = Object.keys(query).filter(key => !allowed.includes(key))
  if (unknown.length > 0) {
    throw validationError(unknown.map(field => ({ field, reason: 'Tham số không được phép.' })))
  }

  const page = query.page === undefined ? 1 : parsePositiveIntId(query.page, 'page')
  const limit = query.limit === undefined ? 20 : parsePositiveIntId(query.limit, 'limit')
  if (limit > 100) {
    throw validationError([{ field: 'limit', reason: 'Tối đa 100.' }])
  }

  const productId = query.productId === undefined
    ? undefined
    : parsePositiveIntId(query.productId, 'productId')

  let type
  if (query.type !== undefined && query.type !== '') {
    if (!Object.values(MovementType).includes(query.type)) {
      throw validationError([{ field: 'type', reason: 'Loại biến động tồn kho không hợp lệ.' }])
    }
    type = query.type
  }

  let search
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 200) {
      throw validationError([{ field: 'search', reason: 'Chuỗi tìm kiếm tối đa 200 ký tự.' }])
    }
    search = query.search.trim() || undefined
  }

  return { page, limit, productId, type, search }
}

router.get('/movements', handle(async (req, res) => {
  const warehouseId = assignedWarehouseScope(req)
  const filters = parseMovementQuery(req.query)
  const data = await listInventoryMovements(prisma, { ...filters, warehouseId })
  res.json({ success: true, data })
}))

router.get('/', handle(async (req, res) => {
  const warehouseId = readAllWarehousesScope(req)
  const productId = req.query.productId === undefined ? undefined : parsePositiveIntId(req.query.productId, 'productId')
  const data = await listInventory(prisma, { ...paging(req.query), warehouseId, productId })
  res.json({ success: true, data })
}))
const requireWarehouseManager = requireRole('WAREHOUSE_MANAGER')
router.post('/:warehouseId/restock',requireWarehouseManager,handle(async (req,res) => {
  const warehouseId=assignedWarehouseScope(req, req.params.warehouseId)
  validateBody(req.body,['productId','quantity'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => restockInventory(tx,{warehouseId,productId,quantity:req.body.quantity,actorUserId:req.user.id}))
  await invalidateInventoryCache({ warehouseIds: [warehouseId], productIds: [productId] })
  res.json({success:true,data})
}))
router.patch('/:warehouseId/threshold',requireWarehouseManager,handle(async (req,res) => {
  const warehouseId=assignedWarehouseScope(req, req.params.warehouseId)
  validateBody(req.body,['productId','threshold'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => setLowStockThreshold(tx,{warehouseId,productId,threshold:req.body.threshold}))
  await invalidateInventoryCache({ warehouseIds: [warehouseId], productIds: [productId] })
  res.json({success:true,data})
}))
router.patch('/:warehouseId/adjust', requireWarehouseManager, handle(async (req, res) => {
  const warehouseId = assignedWarehouseScope(req, req.params.warehouseId)
  validateBody(req.body, ['productId', 'onHand', 'note'])
  const productId = parsePositiveIntId(req.body.productId, 'productId')
  const data = await runInTransaction(tx => adjustInventory(tx, {
    warehouseId,
    productId,
    newOnHand: req.body.onHand,
    actorUserId: req.user.id,
    note: req.body.note,
  }))
  await invalidateInventoryCache({ warehouseIds: [warehouseId], productIds: [productId] })
  res.json({ success: true, data })
}))
export default router
