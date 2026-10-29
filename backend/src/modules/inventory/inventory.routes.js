import { Router } from 'express'
import prisma from '../../db/prisma.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { runInTransaction } from '../../db/transaction.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'
import { paging, validateBody, managementProducts } from '../product/product.routes.js'
import { listInventory, getInventorySummary, listOpenAlerts, restockInventory, setLowStockThreshold } from './inventory.repository.js'
const router = Router()
router.use(requireAuth,requireRole('WAREHOUSE_MANAGER'))
router.use((req,res,next) => { res.set('Cache-Control','no-store'); next() })
const handle = fn => async (req,res,next) => { try { await fn(req,res) } catch(e) { next(e) } }
function ownWarehouse(req, raw) {
  const id = parsePositiveIntId(raw ?? req.user.assignedWarehouseId,'warehouseId')
  if (id !== req.user.assignedWarehouseId) throw new AppError(ErrorCodes.FORBIDDEN,'Chi duoc thao tac kho duoc phan cong.')
  return id
}
router.get('/products',handle(async (req,res) => res.json({success:true,data:await managementProducts(req.query)})))
router.get('/warehouses',handle(async (req,res) => res.json({success:true,data:await prisma.warehouse.findMany({ select:{id:true,name:true,code:true},orderBy:{id:'asc'} })})))
router.get('/summary',handle(async (req,res) => res.json({success:true,data:await getInventorySummary(prisma,{productId:req.query.productId ? parsePositiveIntId(req.query.productId,'productId') : undefined})})))
router.get('/alerts',handle(async (req,res) => {
  const warehouseId = ownWarehouse(req,req.query.warehouseId)
  res.json({success:true,data:await listOpenAlerts(prisma,{warehouseId})})
}))
router.get('/',handle(async (req,res) => res.json({success:true,data:await listInventory(prisma,{...paging(req.query),warehouseId:req.query.warehouseId === undefined ? undefined : parsePositiveIntId(req.query.warehouseId,'warehouseId'),productId:req.query.productId === undefined ? undefined : parsePositiveIntId(req.query.productId,'productId')})})))
router.post('/:warehouseId/restock',handle(async (req,res) => {
  const warehouseId=ownWarehouse(req,req.params.warehouseId)
  validateBody(req.body,['productId','quantity'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => restockInventory(tx,{warehouseId,productId,quantity:req.body.quantity,actorUserId:req.user.id}))
  res.json({success:true,data})
}))
router.patch('/:warehouseId/threshold',handle(async (req,res) => {
  const warehouseId=ownWarehouse(req,req.params.warehouseId)
  validateBody(req.body,['productId','threshold'])
  const productId=parsePositiveIntId(req.body.productId,'productId')
  const data=await runInTransaction(tx => setLowStockThreshold(tx,{warehouseId,productId,threshold:req.body.threshold}))
  res.json({success:true,data})
}))
export default router
