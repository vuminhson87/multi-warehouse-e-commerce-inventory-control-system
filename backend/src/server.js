
import 'dotenv/config'

import app from './app.js'
import { disconnectPrisma } from './db/prisma.js'

const PORT = Number(process.env.PORT ?? 3001)

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT phải nằm trong khoảng 1 đến 65535.')
}

const server = app.listen(PORT, () => {
  console.log(`Backend: http://localhost:${PORT}`)
  console.log(`Health:  http://localhost:${PORT}/api/health`)
})

async function shutdown(signal) {
  console.log(`Nhận ${signal}, đang dừng server...`)

  server.close(async (error) => {
    try {
      await disconnectPrisma()
    } catch (disconnectError) {
      console.error('Lỗi đóng kết nối Prisma:', disconnectError)
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
