
import { Router } from 'express'
import jwt from 'jsonwebtoken'

import prisma from '../../db/prisma.js'
import {
  createCustomerAccount,
  hashPassword,
  verifyPassword,
  verifyUserCredentials,
} from './user.repository.js'
import {
  requestRegistrationOtp,
  verifyRegistrationOtpAndCreateUser,
} from './otp.service.js'
import { requireAuth } from '../../middlewares/requireAuth.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'

const router = Router()

router.post('/register', async (req, res, next) => {
  try {
    const body = req.body
    const details = []

    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw validationError([{ field: 'body', reason: 'Dữ liệu đăng ký không hợp lệ.' }])
    }
    if (Object.keys(body).some(key => !['username', 'password', 'fullName'].includes(key))) {
      details.push({ field: 'body', reason: 'Chỉ chấp nhận username, password và fullName.' })
    }

    const username = typeof body.username === 'string' ? body.username.trim() : ''
    if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
      details.push({ field: 'username', reason: 'Tên đăng nhập phải dài 3–50 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.' })
    }

    const password = body.password
    if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
      details.push({ field: 'password', reason: 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.' })
    }

    let fullName = null
    if (body.fullName !== undefined) {
      if (typeof body.fullName !== 'string' || !body.fullName.trim() || body.fullName.trim().length > 120) {
        details.push({ field: 'fullName', reason: 'Họ tên phải có từ 1 đến 120 ký tự.' })
      } else {
        fullName = body.fullName.trim()
      }
    }

    if (details.length) throw validationError(details)

    const existing = await prisma.user.findUnique({ where: { username }, select: { id: true } })
    if (existing) {
      throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Tên đăng nhập đã được sử dụng.')
    }

    const user = await createCustomerAccount(prisma, { username, password, fullName })
    return res.status(201).json({ success: true, data: { user } })
  } catch (error) {
    if (error?.code === 'P2002') {
      return next(new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Tên đăng nhập đã được sử dụng.'))
    }
    return next(error)
  }
})

router.post('/register/request-otp', async (req, res, next) => {
  try {
    const data = await requestRegistrationOtp(prisma, req.body)
    return res.status(200).json({ success: true, data })
  } catch (error) {
    return next(error)
  }
})

router.post('/register/verify-otp', async (req, res, next) => {
  try {
    const data = await verifyRegistrationOtpAndCreateUser(prisma, req.body)
    return res.status(201).json({ success: true, data })
  } catch (error) {
    if (error?.code === 'P2002') {
      return next(new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Tên đăng nhập hoặc Gmail đã được sử dụng.'))
    }
    return next(error)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const body = req.body

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(
        key => !['username', 'password'].includes(key)
      ) ||
      typeof body.username !== 'string' ||
      !body.username.trim() ||
      body.username.length > 120 ||
      typeof body.password !== 'string' ||
      !body.password ||
      body.password.length > 1024
    ) {
      throw validationError([
        {
          field: 'credentials',
          reason: 'Tên đăng nhập / Gmail hoặc mật khẩu không hợp lệ.',
        },
      ])
    }

    const user = await verifyUserCredentials(prisma, {
      username: body.username,
      password: body.password,
    })

    if (!user) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Tên đăng nhập hoặc mật khẩu không đúng.'
      )
    }

    if (typeof prisma.user?.update === 'function') {
      await prisma.user.update({
        where: { id: user.id },
        data: { loginCount: { increment: 1 } },
      })
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET chưa được cấu hình.')
    }

    const token = jwt.sign(
      {},
      process.env.JWT_SECRET,
      {
        algorithm: 'HS256',
        subject: String(user.id),
        expiresIn: process.env.JWT_EXPIRES_IN || '2h',
      }
    )

    return res.json({
      success: true,
      data: {
        token,
        tokenType: 'Bearer',
        user,
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    data: {
      user: req.user,
    },
  })
})

router.patch('/profile', requireAuth, async (req, res, next) => {
  try {
    const body = req.body
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => key !== 'fullName')
    ) {
      throw validationError([
        { field: 'body', reason: 'Chỉ được phép cập nhật trường fullName.' },
      ])
    }

    let fullName = null
    if (body.fullName !== null && body.fullName !== undefined) {
      if (typeof body.fullName !== 'string' || body.fullName.trim().length > 120) {
        throw validationError([
          { field: 'fullName', reason: 'Họ và tên phải là chuỗi tối đa 120 ký tự.' },
        ])
      }
      fullName = body.fullName.trim() || null
    }

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: { fullName },
    })

    const safeUser = {
      id: updated.id,
      username: updated.username,
      fullName: updated.fullName ?? null,
      role: updated.role,
      assignedWarehouseId: updated.assignedWarehouseId ?? null,
      isActive: updated.isActive,
      ...(updated.email
        ? {
            email: updated.email,
            emailVerifiedAt:
              updated.emailVerifiedAt instanceof Date
                ? updated.emailVerifiedAt.toISOString()
                : (updated.emailVerifiedAt ?? null),
          }
        : {}),
    }

    return res.status(200).json({
      success: true,
      data: { user: safeUser },
    })
  } catch (error) {
    return next(error)
  }
})

router.patch('/password', requireAuth, async (req, res, next) => {
  try {
    const body = req.body
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      Object.keys(body).some(key => !['currentPassword', 'newPassword'].includes(key))
    ) {
      throw validationError([
        { field: 'body', reason: 'Chỉ chấp nhận currentPassword và newPassword.' },
      ])
    }

    const { currentPassword, newPassword } = body
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) {
      throw validationError([
        { field: 'currentPassword', reason: 'Vui lòng nhập mật khẩu hiện tại.' },
      ])
    }

    if (
      typeof newPassword !== 'string' ||
      newPassword.length < 8 ||
      Buffer.byteLength(newPassword, 'utf8') > 72
    ) {
      throw validationError([
        { field: 'newPassword', reason: 'Mật khẩu mới phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.' },
      ])
    }

    if (currentPassword === newPassword) {
      throw validationError([
        { field: 'newPassword', reason: 'Mật khẩu mới không được trùng mật khẩu hiện tại.' },
      ])
    }

    const userRecord = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true, isActive: true },
    })

    if (!userRecord || !userRecord.isActive) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Tài khoản không còn hoạt động.')
    }

    const valid = await verifyPassword(currentPassword, userRecord.passwordHash)
    if (!valid) {
      throw new AppError(ErrorCodes.UNAUTHENTICATED, 'Mật khẩu hiện tại không chính xác.')
    }

    const passwordHash = await hashPassword(newPassword)
    await prisma.user.update({
      where: { id: req.user.id },
      data: { passwordHash },
    })

    return res.status(200).json({
      success: true,
      data: { updated: true },
    })
  } catch (error) {
    return next(error)
  }
})

export default router
