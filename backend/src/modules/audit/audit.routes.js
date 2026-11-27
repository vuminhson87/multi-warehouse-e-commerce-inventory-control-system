import { Router } from 'express'
import prisma from '../../db/prisma.js'
import { requireAuth, requireRole } from '../../middlewares/requireAuth.js'
import { validationError } from '../../shared/errors.js'
import { parsePositiveIntId } from '../order/order.validator.js'
import {
    AuditAction,
    isAuditTargetType,
    listAdminAuditLogs,
} from './audit.repository.js'

const ALLOWED_QUERY_FIELDS = ['page', 'limit', 'targetType', 'action', 'search']
const KNOWN_ACTIONS = new Set(Object.values(AuditAction))

export function validateAuditLogQuery(query = {}) {
    const unknown = Object.keys(query).filter((key) => !ALLOWED_QUERY_FIELDS.includes(key))
    if (unknown.length > 0) {
        throw validationError(
            unknown.map((field) => ({ field, reason: 'Tham số không được phép.' }))
        )
    }

    const page = query.page === undefined ? 1 : parsePositiveIntId(query.page, 'page')
    const limit = query.limit === undefined ? 20 : parsePositiveIntId(query.limit, 'limit')
    if (limit > 100) {
        throw validationError([{ field: 'limit', reason: 'Tối đa 100.' }])
    }

    let targetType
    if (query.targetType !== undefined && query.targetType !== '') {
        if (!isAuditTargetType(query.targetType)) {
            throw validationError([
                { field: 'targetType', reason: 'Loại đối tượng nhật ký không hợp lệ.' },
            ])
        }
        targetType = query.targetType
    }

    let action
    if (query.action !== undefined && query.action !== '') {
        if (typeof query.action !== 'string' || !KNOWN_ACTIONS.has(query.action)) {
            throw validationError([{ field: 'action', reason: 'Hành động nhật ký không hợp lệ.' }])
        }
        action = query.action
    }

    let search
    if (query.search !== undefined) {
        if (typeof query.search !== 'string' || query.search.length > 200) {
            throw validationError([{ field: 'search', reason: 'Từ khóa tìm kiếm tối đa 200 ký tự.' }])
        }
        search = query.search.trim() || undefined
    }

    return { page, limit, targetType, action, search }
}

const router = Router()

router.use(requireAuth, requireRole('ADMIN'))
router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
})

router.get('/', async (req, res, next) => {
    try {
        const filters = validateAuditLogQuery(req.query)
        const data = await listAdminAuditLogs(prisma, filters)
        return res.status(200).json({ success: true, data })
    } catch (error) {
        next(error)
    }
})

export default router
