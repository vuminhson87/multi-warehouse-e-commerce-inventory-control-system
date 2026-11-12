// M3 - Nguyễn Anh Quân: PrismaClient dùng chung toàn backend (một kết nối pool duy nhất).
// Mọi truy vấn đều qua Prisma (parameterized) để chống SQL injection (NFR-SEC-07).

import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

export const prisma =
    globalForPrisma.__multiWarehousePrisma ??
    new PrismaClient({
        log: process.env.PRISMA_LOG === 'true' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    })

// Tránh tạo nhiều client khi dev server hot-reload.
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.__multiWarehousePrisma = prisma
}

export async function disconnectPrisma() {
    await prisma.$disconnect()
}

export default prisma
