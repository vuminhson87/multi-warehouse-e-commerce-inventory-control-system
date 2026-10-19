// M3 - Nguyễn Anh Quân: Seed dữ liệu demo/kiểm thử vào PostgreSQL.
// Chạy: npm run db:seed (sau khi đã npm run db:migrate).
// Seed có tính idempotent: chạy lại sẽ upsert, không nhân bản dữ liệu.

import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { SEED_USERS, SEED_WAREHOUSES, buildInventories, buildProducts } from './seed-data.js'

const prisma = new PrismaClient()

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? '123456'
const PRODUCT_COUNT = Number(process.env.SEED_PRODUCT_COUNT ?? 120)
const BCRYPT_ROUNDS = 10

// Sau khi chèn id tường minh, đồng bộ sequence để bản ghi tạo sau không trùng id.
async function resetSequence(table) {
    await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
    )
}

async function main() {
    const products = buildProducts(PRODUCT_COUNT)
    const inventories = buildInventories(products)
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS)

    for (const warehouse of SEED_WAREHOUSES) {
        await prisma.warehouse.upsert({
            where: { id: warehouse.id },
            update: { code: warehouse.code, name: warehouse.name, address: warehouse.address },
            create: warehouse,
        })
    }

    for (const user of SEED_USERS) {
        await prisma.user.upsert({
            where: { id: user.id },
            update: {
                username: user.username,
                fullName: user.fullName,
                role: user.role,
                assignedWarehouseId: user.assignedWarehouseId,
            },
            create: { ...user, passwordHash },
        })
    }

    for (const product of products) {
        const { id, ...data } = product

        await prisma.product.upsert({
            where: { id },
            update: { ...data, discontinuedAt: data.isActive ? null : new Date() },
            create: { id, ...data, discontinuedAt: data.isActive ? null : new Date() },
        })
    }

    // Không ghi đè onHand/reserved nếu dòng đã tồn tại để tránh phá dữ liệu đơn đang giữ hàng.
    await prisma.inventory.createMany({ data: inventories, skipDuplicates: true })

    for (const table of ['warehouses', 'users', 'products']) {
        await resetSequence(table)
    }

    console.log(
        `Seed xong: ${SEED_WAREHOUSES.length} kho, ${SEED_USERS.length} người dùng, ` +
            `${products.length} sản phẩm, ${inventories.length} dòng tồn kho.`
    )
}

main()
    .catch((error) => {
        console.error('Seed thất bại:', error)
        process.exitCode = 1
    })
    .finally(() => prisma.$disconnect())
