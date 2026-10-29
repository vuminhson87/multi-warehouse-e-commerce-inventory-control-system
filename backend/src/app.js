
import express from 'express'
import cors from 'cors'

import prisma from './db/prisma.js'
import authRoutes from './modules/auth/auth.routes.js'
import orderRoutes from './modules/order/order.routes.js'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/errorHandler.js'

const app = express()

app.disable('x-powered-by')

const allowedOrigins = (
  process.env.CORS_ORIGIN ?? 'http://localhost:5173'
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
// Order và Payment API sẽ thêm ở bước tiếp theo.

app.use(notFoundHandler)
app.use(errorHandler)

export default app
