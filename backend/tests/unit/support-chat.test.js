import { describe, expect, it, vi } from 'vitest'
import {
  generateAutoBotReply,
  listStaffConversations,
  sendStaffReply,
  validateMessageContent,
} from '../../src/modules/chat/chat.service.js'
import { ErrorCodes } from '../../src/shared/errors.js'

describe('Support Chatbox & Staff Inbox service', () => {
  it('validateMessageContent chấp nhận nội dung hợp lệ và chặn chuỗi rỗng / quá 1000 ký tự', () => {
    expect(validateMessageContent('  Xin chào kho HCM  ')).toBe('Xin chào kho HCM')
    expect(() => validateMessageContent('   ')).toThrow()
    expect(() => validateMessageContent('a'.repeat(1001))).toThrow()
  })

  it('Auto-Bot trả lời chính sách, mã giảm giá và tra cứu sản phẩm thật từ client', async () => {
    const policy = await generateAutoBotReply({ topic: 'POLICY' })
    expect(policy.reply).toContain('15 phút')

    const mockClient = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          { id: 1, name: 'Logitech G304', category: 'Phụ kiện', price: 790000 },
        ]),
      },
    }
    const products = await generateAutoBotReply({ query: 'Logitech' }, { client: mockClient })
    expect(products.reply).toContain('Logitech G304')
    expect(mockClient.product.findMany).toHaveBeenCalledTimes(1)
  })

  it('WAREHOUSE_MANAGER bị khóa phạm vi đúng kho phụ trách và không được trả lời hội thoại kho khác', async () => {
    const mockClient = {
      supportConversation: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue({ id: 9, warehouseId: 2, status: 'OPEN' }),
      },
    }

    await listStaffConversations(
      { id: 2, role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 1 },
      { warehouseId: 2 },
      mockClient
    )
    expect(mockClient.supportConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { warehouseId: 1 } })
    )

    await expect(
      sendStaffReply(
        { id: 2, role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 1 },
        9,
        'Xin chào bạn',
        mockClient
      )
    ).rejects.toMatchObject({ code: ErrorCodes.FORBIDDEN, httpStatus: 403 })
  })
})
