// Module sinh thông tin VietQR tách biệt hoàn toàn với payment.service.js.
// Nếu sau này muốn gỡ tính năng QR, chỉ cần xóa file này và bỏ dòng paymentQr trong order.query.service.js.

export function loadPaymentQrConfig(env = globalThis.process?.env ?? {}) {
  return {
    bankId: (env.PAYMENT_BANK_ID || 'MB').trim(),
    bankName: (env.PAYMENT_BANK_NAME || 'MB Bank (Demo)').trim(),
    accountNo: (env.PAYMENT_ACCOUNT_NO || '0123456789').trim(),
    accountName: (env.PAYMENT_ACCOUNT_NAME || 'MULTI WAREHOUSE DEMO').trim(),
    template: (env.PAYMENT_QR_TEMPLATE || 'compact2').trim(),
  }
}

export function buildOrderPaymentQr(order, env = globalThis.process?.env ?? {}) {
  if (!order || order.status !== 'PendingPayment') {
    return null
  }

  const cfg = loadPaymentQrConfig(env)
  const amount = Math.max(0, Math.round(Number(order.totalAmount ?? 0)))
  const transferContent = `MW DH${order.id}`

  const params = new URLSearchParams({
    amount: String(amount),
    addInfo: transferContent,
    accountName: cfg.accountName,
  })

  const qrImageUrl = `https://img.vietqr.io/image/${encodeURIComponent(cfg.bankId)}-${encodeURIComponent(cfg.accountNo)}-${encodeURIComponent(cfg.template)}.png?${params.toString()}`

  return {
    bankId: cfg.bankId,
    bankName: cfg.bankName,
    accountNo: cfg.accountNo,
    accountName: cfg.accountName,
    amount,
    transferContent,
    qrImageUrl,
  }
}
