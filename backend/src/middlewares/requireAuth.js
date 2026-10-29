
import jwt from 'jsonwebtoken'
import prisma from '../db/prisma.js'
import { findUserById } from '../modules/auth/user.repository.js'
import { AppError, ErrorCodes } from '../shared/errors.js'

export async function requireAuth(req, res, next) {
  try {
    const authorization = req.headers.authorization ?? ''
    const match = /^Bearer (.+)$/i.exec(authorization)

    if (!match) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Vui lòng đăng nhập.'
      )
    }

    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET chưa được cấu hình.')
    }

    let payload

    try {
      payload = jwt.verify(match[1], process.env.JWT_SECRET, {
        algorithms: ['HS256'],
      })
    } catch {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'
      )
    }

    const userId = Number(payload.sub)

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Token không hợp lệ.'
      )
    }

    const user = await findUserById(prisma, userId)

    if (!user) {
      throw new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Tài khoản không tồn tại hoặc đã bị vô hiệu hóa.'
      )
    }

    req.user = user
    next()
  } catch (error) {
    next(error)
  }
}

export function requireRole(...roles) {
  return function (req, res, next) {
    if (!req.user) {
      return next(new AppError(
        ErrorCodes.UNAUTHENTICATED,
        'Vui lòng đăng nhập.'
      ))
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError(
        ErrorCodes.FORBIDDEN,
        'Bạn không có quyền thực hiện thao tác này.'
      ))
    }

    next()
  }
}
