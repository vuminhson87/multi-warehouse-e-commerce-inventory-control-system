
import 'dotenv/config'

import app from './app.js'
import { disconnectPrisma } from './db/prisma.js'
import { disconnectDefaultCacheStore } from './db/redis.js'
import { startReservationExpiryJob } from './modules/order/reservation-expiry.service.js'
import { logMailerMode } from './services/mailer.js'

const PORT = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT phải nằm trong khoảng 1 đến 65535.')
}

const server = app.listen(PORT, () => {
  console.log(`Backend: http://localhost:${PORT}`)
  console.log(`Health:  http://localhost:${PORT}/api/health`)
  logMailerMode()
})

const reservationExpiryJob = startReservationExpiryJob()

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`)

  try {
    await reservationExpiryJob.stop()
  } catch (jobError) {
    console.error('Lỗi dừng job thu hồi giữ hàng hết hạn:', jobError)
    process.exitCode = 1
  }

  server.close(async (error) => {
    try {
      await Promise.all([
        disconnectPrisma(),
        disconnectDefaultCacheStore(),
      ])
    } catch (disconnectError) {
      console.error('Lỗi đóng kết nối Prisma/Redis:', disconnectError)
      process.exitCode = 1
    }

    if (error) {
      console.error('Lỗi dừng HTTP server:', error)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
