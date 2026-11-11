import { Router } from 'express'
import prisma from '../../db/prisma.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { runInTransaction } from '../../db/transaction.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { paging, validateBody, managementProducts } from '../product/product.routes.js'
import { listInventory, getInventorySummary, listOpenAlerts, restockInventory, setLowStockThreshold } from './inventory.repository.js'
const router = Router()
router.use(requireAuth, requireRole('ADMIN', 'WAREHOUSE_MANAGER'))
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
const handle = fn => async (req, res, next) => { try { await fn(req, res) } catch (error) { next(error) } }

function warehouseScope(req, raw = req.query.warehouseId) {
  const assigned = req.user.assignedWarehouseId
  if (req.user.role === 'WAREHOUSE_MANAGER' && !assigned) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Tài khoản chưa được phân công kho.')
  }

  const warehouseId = raw === undefined
    ? req.user.role === 'ADMIN' ? undefined : assigned
    : parsePositiveIntId(raw, 'warehouseId')

  if (req.user.role === 'WAREHOUSE_MANAGER' && warehouseId !== assigned) {
    throw new AppError(ErrorCodes.FORBIDDEN, 'Chỉ được thao tác kho được phân công.')
  }

  return warehouseId
}

router.get('/products', handle(async (req, res) => {
  const data = await managementProducts(req.query, warehouseScope(req))
  res.json({ success: true, data })
}))
router.get('/warehouses', handle(async (req, res) => {
  const warehouseId = warehouseScope(req)
  const data = await prisma.warehouse.findMany({
    where: { id: warehouseId },
    select: { id: true, name: true, code: true },
    orderBy: { id: 'asc' },
  })
  res.json({ success: true, data })
}))
router.get('/summary', handle(async (req, res) => {
  const warehouseId = warehouseScope(req)
  const productId = req.query.productId === undefined ? undefined : parsePositiveIntId(req.query.productId, 'productId')
  const data = await getInventorySummary(prisma, { warehouseId, productId })
  res.json({ success: true, data })
}))
router.get('/alerts', handle(async (req, res) => {
  const data = await listOpenAlerts(prisma, { warehouseId: warehouseScope(req) })
  res.json({ success: true, data })
}))
router.get('/', handle(async (req, res) => {
  const warehouseId = warehouseScope(req)
  const productId = req.query.productId === undefined ? undefined : parsePositiveIntId(req.query.productId, 'productId')
  const data = await listInventory(prisma, { ...paging(req.query), warehouseId, productId })
  res.json({ success: true, data })
}))
const requireWarehouseManager = requireRole('WAREHOUSE_MANAGER')
router.post('/:warehouseId/restock',requireWarehouseManager,handle(async (req,res) => {
  const warehouseId=warehouseScope(req, req.params.warehouseId)
  validateBody(req.body,['productId','quantity'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => restockInventory(tx,{warehouseId,productId,quantity:req.body.quantity,actorUserId:req.user.id}))
  res.json({success:true,data})
}))
router.patch('/:warehouseId/threshold',requireWarehouseManager,handle(async (req,res) => {
  const warehouseId=warehouseScope(req, req.params.warehouseId)
  validateBody(req.body,['productId','threshold'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => setLowStockThreshold(tx,{warehouseId,productId,threshold:req.body.threshold}))
  res.json({success:true,data})
}))
export default router
