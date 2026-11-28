import { describe, expect, it, vi } from 'vitest'
import { validateContactBody } from '../../src/modules/contact/contact.routes.js'
import { sendContactSupportEmail } from '../../src/services/mailer.js'

describe('Contact support validation & mailer', () => {
  it('chuẩn hóa và chấp nhận yêu cầu liên hệ hợp lệ', () => {
    const parsed = validateContactBody({
      fullName: '  Trần Văn A ',
      email: ' ABC@GMAIL.COM ',
      phone: '0901234567',
      topic: 'Tư vấn sản phẩm',
      warehouseCode: 'hcm',
      orderCode: '#51',
      message: 'Mình cần kiểm tra thời gian giao hàng từ kho HCM Mega SOC.',
    })

    expect(parsed).toEqual({
      fullName: 'Trần Văn A',
      email: 'abc@gmail.com',
      phone: '0901234567',
      topic: 'Tư vấn sản phẩm',
      warehouseCode: 'HCM',
      warehouseName: 'Kho HCM Mega SOC (TP. Hồ Chí Minh)',
      orderCode: '#51',
      message: 'Mình cần kiểm tra thời gian giao hàng từ kho HCM Mega SOC.',
    })
  })

  it('từ chối dữ liệu liên hệ thiếu email hoặc nội dung quá ngắn', () => {
    expect(() =>
      validateContactBody({
        fullName: 'A',
        email: 'sai-email',
        topic: 'Không tồn tại',
        message: 'ngắn',
      })
    ).toThrow()
  })

  it('sendContactSupportEmail tự fallback dev-console khi chưa cấu hình SMTP', async () => {
    const logger = { info: vi.fn() }
    const result = await sendContactSupportEmail({
      referenceCode: 'CSKH-123456',
      fullName: 'Khách hàng',
      email: 'abc@gmail.com',
      topic: 'Tư vấn sản phẩm',
      message: 'Nội dung kiểm thử liên hệ hỗ trợ khách hàng.',
      env: { SMTP_USER: '', SMTP_PASS: '' },
      logger,
    })

    expect(result.delivery).toBe('dev-console')
    expect(logger.info).toHaveBeenCalledTimes(1)
  })
})
