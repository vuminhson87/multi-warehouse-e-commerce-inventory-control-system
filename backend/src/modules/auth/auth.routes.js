
import { Router } from 'express'
import jwt from 'jsonwebtoken'

import prisma from '../../db/prisma.js'
import { verifyUserCredentials } from './user.repository.js'
import { requireAuth } from '../../middlewares/requireAuth.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'

const router = Router()

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
