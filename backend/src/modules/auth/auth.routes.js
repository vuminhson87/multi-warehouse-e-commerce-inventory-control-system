
import { Router } from 'express'
import jwt from 'jsonwebtoken'

import prisma from '../../db/prisma.js'
import { createCustomerAccount, verifyUserCredentials } from './user.repository.js'
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
      body.username.length > 50 ||
      typeof body.password !== 'string' ||
      !body.password ||
      body.password.length > 1024
    ) {
      throw validationError([
        {
          field: 'credentials',
          reason: 'Username hoặc password không hợp lệ.',
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

export default router
