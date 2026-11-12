// M3 - Nguyễn Anh Quân: Cấu hình Prisma CLI (thay cho package.json#prisma deprecated)
// và tự nạp backend/.env hoặc đặt giá trị mặc định cho DATABASE_URL khi dev chưa tạo .env.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'prisma/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.join(__dirname, '.env')

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath)
}

process.env.DATABASE_URL ??=
    'postgresql://mw_user:mw_password@localhost:5432/multi_warehouse?schema=public&connection_limit=20'

export default defineConfig({
    earlyAccess: true,
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
    migrations: {
        seed: 'node prisma/seed.js',
    },
})
