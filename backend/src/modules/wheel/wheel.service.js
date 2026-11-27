import crypto from 'node:crypto'
import prisma from '../../db/prisma.js'
import { runInTransaction } from '../../db/transaction.js'
import businessConfig from '../../config/business.js'
import { AppError, ErrorCodes } from '../../shared/errors.js'

export const VOUCHER_TTL_DAYS = 30

// 8 ô vòng quay 5% - 20%, tổng trọng số = 100
export const WELCOME_WHEEL_SLICES = Object.freeze([
  { index: 0, discountPercent: 5, label: '5%', weight: 22 },
  { index: 1, discountPercent: 12, label: '12%', weight: 14 },
  { index: 2, discountPercent: 8, label: '8%', weight: 18 },
  { index: 3, discountPercent: 20, label: '20%', weight: 4 },
  { index: 4, discountPercent: 10, label: '10%', weight: 16 },
  { index: 5, discountPercent: 16, label: '16%', weight: 8 },
  { index: 6, discountPercent: 15, label: '15%', weight: 12 },
  { index: 7, discountPercent: 18, label: '18%', weight: 6 },
])

export function isUserEligibleForWelcomeWheel(
  user,
  { unlimitedDemo = businessConfig.wheelUnlimitedDemo } = {}
) {
  if (!user || user.role !== 'CUSTOMER') {
    return false
  }
  if (unlimitedDemo) {
    return true
  }
  return Number(user.loginCount) === 1 && user.hasSpunWelcomeWheel === false
}

export function pickWeightedSlice(randomIntFn = crypto.randomInt) {
  const totalWeight = WELCOME_WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0)
  const roll = randomIntFn(0, totalWeight)
  let acc = 0
  for (const slice of WELCOME_WHEEL_SLICES) {
    acc += slice.weight
    if (roll < acc) {
      return slice
    }
  }
  return WELCOME_WHEEL_SLICES[0]
}

export function generateVoucherCode(discountPercent) {
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase()
  return `WELCOME${discountPercent}-${suffix}`
}

export function formatVoucher(voucher, now = new Date()) {
  const expiresAtDate = new Date(voucher.expiresAt)
  const isUsed = Boolean(voucher.usedAt)
  const isExpired = !isUsed && expiresAtDate.getTime() <= now.getTime()
  return {
    id: voucher.id,
    code: voucher.code,
    discountPercent: voucher.discountPercent,
    expiresAt: expiresAtDate.toISOString(),
    usedAt: voucher.usedAt ? new Date(voucher.usedAt).toISOString() : null,
    usedOrderId: voucher.usedOrderId ?? null,
    status: isUsed ? 'USED' : isExpired ? 'EXPIRED' : 'ACTIVE',
    isUsable: !isUsed && !isExpired,
    createdAt: new Date(voucher.createdAt).toISOString(),
  }
}

export async function getWheelStatus(
  userId,
  client = prisma,
  { unlimitedDemo = businessConfig.wheelUnlimitedDemo } = {}
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      role: true,
      loginCount: true,
      hasSpunWelcomeWheel: true,
    },
  })

  if (!user) {
    throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản.')
  }

  const vouchers = await client.voucher.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const now = new Date()
  return {
    eligible: isUserEligibleForWelcomeWheel(user, { unlimitedDemo }),
    unlimitedDemo,
    loginCount: user.loginCount,
    hasSpunWelcomeWheel: user.hasSpunWelcomeWheel,
    slices: WELCOME_WHEEL_SLICES.map(({ index, discountPercent, label }) => ({
      index,
      discountPercent,
      label,
    })),
    vouchers: vouchers.map((v) => formatVoucher(v, now)),
  }
}

export async function listUserVouchers(userId, client = prisma) {
  const vouchers = await client.voucher.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })
  const now = new Date()
  return vouchers.map((v) => formatVoucher(v, now))
}

export function spinDemoGuestWheel({
  unlimitedDemo = businessConfig.wheelUnlimitedDemo,
} = {}) {
  if (!unlimitedDemo) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      'Chế độ quay thử đã tắt. Vui lòng đăng nhập tài khoản khách hàng.'
    )
  }
  const slice = pickWeightedSlice()
  return {
    sliceIndex: slice.index,
    discountPercent: slice.discountPercent,
    demoOnly: true,
    voucher: null,
  }
}

export async function spinWelcomeWheel(
  userId,
  {
    runTx = runInTransaction,
    unlimitedDemo = businessConfig.wheelUnlimitedDemo,
  } = {}
) {
  return runTx(async (tx) => {
    const rows = await tx.$queryRaw`
      SELECT id, role, login_count AS "loginCount", has_spun_welcome_wheel AS "hasSpunWelcomeWheel"
      FROM users
      WHERE id = ${userId}
      FOR UPDATE
    `
    const user = rows?.[0]
    if (!user) {
      throw new AppError(ErrorCodes.USER_NOT_FOUND, 'Không tìm thấy tài khoản.')
    }

    if (user.role !== 'CUSTOMER') {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'Vòng quay may mắn chỉ dành cho tài khoản khách hàng.'
      )
    }

    if (!unlimitedDemo) {
      if (user.hasSpunWelcomeWheel) {
        throw new AppError(
          ErrorCodes.INVALID_ORDER_STATE,
          'Bạn đã sử dụng lượt quay chào mừng cho tài khoản này rồi.'
        )
      }

      if (Number(user.loginCount) !== 1) {
        throw new AppError(
          ErrorCodes.INVALID_ORDER_STATE,
          'Vòng quay chào mừng chỉ áp dụng trong lần đăng nhập đầu tiên.'
        )
      }
    }

    const slice = pickWeightedSlice()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + VOUCHER_TTL_DAYS * 24 * 60 * 60 * 1000)

    let createdVoucher = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateVoucherCode(slice.discountPercent)
      try {
        createdVoucher = await tx.voucher.create({
          data: {
            code,
            userId,
            discountPercent: slice.discountPercent,
            expiresAt,
          },
        })
        break
      } catch (err) {
        if (err?.code === 'P2002' && attempt < 2) {
          continue
        }
        throw err
      }
    }

    await tx.user.update({
      where: { id: userId },
      data: { hasSpunWelcomeWheel: true },
    })

    return {
      sliceIndex: slice.index,
      discountPercent: slice.discountPercent,
      demoOnly: false,
      unlimitedDemo,
      voucher: formatVoucher(createdVoucher, now),
    }
  })
}
