import prisma from '../../db/prisma.js'
import { runInTransaction } from '../../db/transaction.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import { AuditAction, AuditTargetType, writeAdminAuditLog } from '../audit/audit.repository.js'
import { listWarehouseManagers, toSafeManager } from './user.repository.js'

function isForeignKeyViolation(error) {
    return (
        error?.code === 'P2003' ||
        error?.meta?.code === '23503' ||
        /23503|foreign key/i.test(String(error?.message ?? ''))
    )
}

export function validateAssignWarehouseBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw validationError([{ field: 'body', reason: 'Body phải là một đối tượng JSON.' }])
    }

    const unknown = Object.keys(body).filter((key) => key !== 'warehouseId')
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Trường không được phép.' }))
        )
    }

    return {
        warehouseId: parsePositiveIntId(body.warehouseId, 'warehouseId'),
    }
}

export async function listWarehouseManagerAssignments() {
    const [managers, warehouses] = await Promise.all([
        listWarehouseManagers(prisma),
        prisma.warehouse.findMany({
            select: { id: true, code: true, name: true, address: true },
            orderBy: { id: 'asc' },
        }),
    ])

    return { managers, warehouses }
}

export async function assignWarehouseToManager(rawUserId, body, { actor } = {}) {
    const userId = parsePositiveIntId(rawUserId, 'userId')
    const { warehouseId } = validateAssignWarehouseBody(body)

    return runInTransaction(async (tx) => {
        const lockedUsers = await tx.$queryRaw`
            SELECT id
            FROM users
            WHERE id = ${userId}
            FOR UPDATE
        `

        if (lockedUsers.length === 0) {
            throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản người dùng.')
        }

        const user = await tx.user.findUniqueOrThrow({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                fullName: true,
                role: true,
                assignedWarehouseId: true,
                isActive: true,
                assignedWarehouse: {
                    select: { id: true, code: true, name: true },
                },
            },
        })

        if (user.role !== 'WAREHOUSE_MANAGER') {
            throw new AppError(
                ErrorCodes.INVALID_USER_ROLE,
                'Chỉ được phân công kho cho tài khoản Quản lý kho.'
            )
        }

        if (!user.isActive) {
            throw new AppError(
                ErrorCodes.INVALID_USER_ROLE,
                'Tài khoản Quản lý kho đã bị vô hiệu hóa.'
            )
        }

        const warehouse = await tx.warehouse.findUnique({
            where: { id: warehouseId },
            select: { id: true, code: true, name: true },
        })

        if (!warehouse) {
            throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho được chọn.')
        }

        if (user.assignedWarehouseId === warehouseId) {
            return {
                manager: toSafeManager(user),
                changed: false,
            }
        }

        try {
            const updated = await tx.user.update({
                where: { id: userId },
                data: { assignedWarehouseId: warehouseId },
                select: {
                    id: true,
                    username: true,
                    fullName: true,
                    role: true,
                    assignedWarehouseId: true,
                    isActive: true,
                    assignedWarehouse: {
                        select: { id: true, code: true, name: true },
                    },
                },
            })

            await writeAdminAuditLog(tx, {
                actor,
                action: AuditAction.WAREHOUSE_MANAGER_ASSIGN,
                targetType: AuditTargetType.USER,
                targetId: updated.id,
                warehouseId: warehouse.id,
                summary: `Phân công Quản lý kho @${updated.username} phụ trách ${warehouse.name}`,
                metadata: {
                    previousWarehouseId: user.assignedWarehouseId,
                    nextWarehouseId: warehouse.id,
                    warehouseName: warehouse.name,
                },
            })

            return {
                manager: toSafeManager(updated),
                changed: true,
            }
        } catch (error) {
            if (isForeignKeyViolation(error)) {
                throw new AppError(ErrorCodes.WAREHOUSE_NOT_FOUND, 'Không tìm thấy kho được chọn.')
            }
            throw error
        }
    })
}
