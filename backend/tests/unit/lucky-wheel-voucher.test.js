import { describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  WELCOME_WHEEL_SLICES,
  isUserEligibleForWelcomeWheel,
  pickWeightedSlice,
  spinDemoGuestWheel,
  spinWelcomeWheel,
} from '../../src/modules/wheel/wheel.service.js'
import { validateCheckoutBody } from '../../src/modules/order/order.validator.js'
import { ErrorCodes } from '../../src/shared/errors.js'

const KEY = 'b3f1c2a0-6d7e-4f0a-9c1b-2a3d4e5f6a71'

describe('Lucky Wheel & Welcome Voucher', () => {
  it('có đúng 8 ô giảm giá từ 5% đến 20% với tổng trọng số 100', () => {
    expect(WELCOME_WHEEL_SLICES).toHaveLength(8)
    for (const slice of WELCOME_WHEEL_SLICES) {
      expect(slice.discountPercent).toBeGreaterThanOrEqual(5)
      expect(slice.discountPercent).toBeLessThanOrEqual(20)
    }
    const totalWeight = WELCOME_WHEEL_SLICES.reduce((sum, s) => sum + s.weight, 0)
    expect(totalWeight).toBe(100)
  })

  it('pickWeightedSlice chọn đúng ô theo roll', () => {
    expect(pickWeightedSlice(() => 0).index).toBe(0)
    expect(pickWeightedSlice(() => 21).index).toBe(0)
    expect(pickWeightedSlice(() => 22).index).toBe(1)
    expect(pickWeightedSlice(() => 99).index).toBe(7)
  })

  it('khi tắt demo (unlimitedDemo = false), chỉ CUSTOMER đăng nhập lần đầu và chưa quay mới đủ điều kiện', () => {
    const strict = { unlimitedDemo: false }
    expect(
      isUserEligibleForWelcomeWheel({ role: 'CUSTOMER', loginCount: 1, hasSpunWelcomeWheel: false }, strict)
    ).toBe(true)
    expect(
      isUserEligibleForWelcomeWheel({ role: 'CUSTOMER', loginCount: 0, hasSpunWelcomeWheel: false }, strict)
    ).toBe(false)
    expect(
      isUserEligibleForWelcomeWheel({ role: 'CUSTOMER', loginCount: 2, hasSpunWelcomeWheel: false }, strict)
    ).toBe(false)
    expect(
      isUserEligibleForWelcomeWheel({ role: 'CUSTOMER', loginCount: 1, hasSpunWelcomeWheel: true }, strict)
    ).toBe(false)
    expect(
      isUserEligibleForWelcomeWheel({ role: 'ADMIN', loginCount: 1, hasSpunWelcomeWheel: false }, strict)
    ).toBe(false)
  })

  it('khi bật chế độ demo (unlimitedDemo = true), CUSTOMER được quay nhiều lần và hỗ trợ demo guest', async () => {
    expect(
      isUserEligibleForWelcomeWheel(
        { role: 'CUSTOMER', loginCount: 5, hasSpunWelcomeWheel: true },
        { unlimitedDemo: true }
      )
    ).toBe(true)

    const demoGuest = spinDemoGuestWheel({ unlimitedDemo: true })
    expect(demoGuest.demoOnly).toBe(true)
    expect(demoGuest.sliceIndex).toBeGreaterThanOrEqual(0)
    expect(demoGuest.sliceIndex).toBeLessThan(8)
    expect(demoGuest.voucher).toBeNull()

    const voucherCreate = vi.fn().mockImplementation(async ({ data }) => ({
      id: 102,
      ...data,
      usedAt: null,
      usedOrderId: null,
      createdAt: new Date('2026-11-27T10:00:00.000Z'),
    }))
    const mockTxDemo = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 7, role: 'CUSTOMER', loginCount: 5, hasSpunWelcomeWheel: true },
      ]),
      voucher: { create: voucherCreate },
      user: { update: vi.fn().mockResolvedValue({}) },
    }
    const res = await spinWelcomeWheel(7, {
      runTx: async (fn) => fn(mockTxDemo),
      unlimitedDemo: true,
    })
    expect(res.unlimitedDemo).toBe(true)
    expect(res.voucher.code).toMatch(/^WELCOME\d+-[A-F0-9]{6}$/)
  })

  it('spinWelcomeWheel ở chế độ thường tạo voucher và chặn quay lần 2', async () => {
    const voucherCreate = vi.fn().mockImplementation(async ({ data }) => ({
      id: 101,
      ...data,
      usedAt: null,
      usedOrderId: null,
      createdAt: new Date('2026-11-27T10:00:00.000Z'),
    }))
    const userUpdate = vi.fn().mockResolvedValue({})

    const mockTx = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 7, role: 'CUSTOMER', loginCount: 1, hasSpunWelcomeWheel: false },
      ]),
      voucher: { create: voucherCreate },
      user: { update: userUpdate },
    }

    const result = await spinWelcomeWheel(7, {
      runTx: async (fn) => fn(mockTx),
      unlimitedDemo: false,
    })

    expect(result.sliceIndex).toBeGreaterThanOrEqual(0)
    expect(result.sliceIndex).toBeLessThan(8)
    expect(result.discountPercent).toBeGreaterThanOrEqual(5)
    expect(result.discountPercent).toBeLessThanOrEqual(20)
    expect(result.voucher.code).toMatch(/^WELCOME\d+-[A-F0-9]{6}$/)
    expect(result.voucher.isUsable).toBe(true)
    expect(voucherCreate).toHaveBeenCalledTimes(1)
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { hasSpunWelcomeWheel: true },
    })

    const mockTxSpun = {
      $queryRaw: vi.fn().mockResolvedValue([
        { id: 7, role: 'CUSTOMER', loginCount: 1, hasSpunWelcomeWheel: true },
      ]),
    }

    await expect(
      spinWelcomeWheel(7, { runTx: async (fn) => fn(mockTxSpun), unlimitedDemo: false })
    ).rejects.toMatchObject({ code: ErrorCodes.INVALID_ORDER_STATE, httpStatus: 409 })
  })

  it('validateCheckoutBody hỗ trợ voucherCode tùy chọn và chuẩn hóa chữ hoa', () => {
    const plain = validateCheckoutBody({
      idempotencyKey: KEY,
      items: [{ productId: 1, quantity: 2 }],
    })
    expect(plain.voucherCode).toBeUndefined()

    const withVoucher = validateCheckoutBody({
      idempotencyKey: KEY,
      items: [{ productId: 1, quantity: 2 }],
      voucherCode: ' welcome15-a1b2c3 ',
    })
    expect(withVoucher.voucherCode).toBe('WELCOME15-A1B2C3')

    expect(() =>
      validateCheckoutBody({
        idempotencyKey: KEY,
        items: [{ productId: 1, quantity: 2 }],
        voucherCode: 'bad code!',
      })
    ).toThrow()
  })

  it('tính toán giảm giá Decimal theo phần trăm tổng đơn nhất quán với server', () => {
    const subtotal = new Prisma.Decimal('10000000.00')
    const discount = subtotal.mul(15).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
    const total = subtotal.sub(discount)
    expect(discount.toFixed(2)).toBe('1500000.00')
    expect(total.toFixed(2)).toBe('8500000.00')
  })

  it('validateCheckoutBody kiểm tra và chuẩn hóa shippingAddress hợp lệ', () => {
    const res = validateCheckoutBody({
      idempotencyKey: KEY,
      items: [{ productId: 1, quantity: 1 }],
      shippingAddress: {
        fullName: '  Nguyễn Văn A ',
        phone: '0901234567',
        province: 'TP. Hồ Chí Minh',
        addressLine: '123 Lê Lợi, Quận 1',
        note: ' Giao giờ hành chính ',
      },
    })
    expect(res.shippingAddress).toEqual({
      fullName: 'Nguyễn Văn A',
      phone: '0901234567',
      province: 'TP. Hồ Chí Minh',
      addressLine: '123 Lê Lợi, Quận 1',
      note: 'Giao giờ hành chính',
    })

    expect(() =>
      validateCheckoutBody({
        idempotencyKey: KEY,
        items: [{ productId: 1, quantity: 1 }],
        shippingAddress: {
          fullName: 'A',
          phone: 'abc',
          province: '',
          addressLine: '12',
        },
      })
    ).toThrow()
  })
})
