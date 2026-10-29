import express from 'express'
import cors from 'cors'

import prisma from './db/prisma.js'
import authRoutes from './modules/auth/auth.routes.js'
import orderRoutes from './modules/order/order.routes.js'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/errorHandler.js'

import { catalogRoutes, adminProductRoutes } from './modules/product/product.routes.js'
import inventoryRoutes from './modules/inventory/inventory.routes.js'

const app = express()

app.disable('x-powered-by')

const allowedOrigins = (
  process.env.CORS_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean)

app.use(
  cors({
    origin: allowedOrigins,
  })
)

app.use(express.json({ limit: '100kb' }))

// Health check
app.get('/api/health', async (req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`

    return res.status(200).json({
      success: true,
      message: 'Backend đang hoạt động.',
      services: {
        api: 'ok',
        database: 'ok',
      },
    })
  } catch (error) {
    next(error)
  }
})

// Authentication API
app.use('/api/auth', authRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/products', catalogRoutes)
app.use('/api/admin/products', adminProductRoutes)
app.use('/api/inventory', inventoryRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
