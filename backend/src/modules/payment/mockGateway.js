
import crypto from 'node:crypto'

import businessConfig from '../../config/business.js'
import { SimulateMode } from '../order/order.constants.js'

// Mock gateway chỉ trả kết quả.
// Không truy cập database và không cập nhật tồn kho.
export async function executeMockPayment({
  orderId,
  paymentAttemptId,
  amount,
  simulate = SimulateMode.SUCCESS,
}) {
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    throw new TypeError('orderId không hợp lệ.')
  }

  if (
    !Number.isSafeInteger(paymentAttemptId) ||
    paymentAttemptId <= 0
  ) {
    throw new TypeError('paymentAttemptId không hợp lệ.')
  }

  if (!Object.values(SimulateMode).includes(simulate)) {
    throw new TypeError('Chế độ mô phỏng không hợp lệ.')
  }

  if (amount === undefined || amount === null) {
    throw new TypeError('Thiếu số tiền thanh toán.')
  }

  const gatewayRef = crypto.randomUUID()

  // Mô phỏng xử lý của cổng thanh toán.
  // Không cần giữ transaction khi chạy hàm này.
  await new Promise((resolve) => setTimeout(resolve, 100))

  switch (simulate) {
    case SimulateMode.SUCCESS:
      return {
        result: 'SUCCESS',
        gatewayRef,
        failureReason: null,
      }

    case SimulateMode.FAILED:
      return {
        result: 'FAILED',
        gatewayRef,
        failureReason: 'MOCK_PAYMENT_DECLINED',
      }

    case SimulateMode.INCOMPLETE:
      return {
        result: 'INCOMPLETE',
        gatewayRef,
        failureReason: 'MOCK_PAYMENT_INCOMPLETE',
      }

    default:
      throw new TypeError('Kết quả mô phỏng không hợp lệ.')
  }
}
