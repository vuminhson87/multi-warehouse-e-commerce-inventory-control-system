const PREFIX = 'mw:m2:request:'

export function acquireActionKey(scope) {
  const key = PREFIX + scope
  let value = sessionStorage.getItem(key)
  if (!value) {
    value = crypto.randomUUID()
    sessionStorage.setItem(key, value)
  }
  return value
}

export function clearActionKey(scope) {
  sessionStorage.removeItem(PREFIX + scope)
}

export function checkoutFingerprint(items) {
  return JSON.stringify(
    items.map(i => ({
      productId: Number(i.productId ?? i.id),
      quantity: Number(i.quantity),
    })).sort((a, b) => a.productId - b.productId)
  )
}

export function acquireCheckoutKey(userId, items) {
  const key = PREFIX + `checkout:${userId}`
  const fingerprint = checkoutFingerprint(items)
  let draft
  try { draft = JSON.parse(sessionStorage.getItem(key) ?? 'null') }
  catch { draft = null }
  if (!draft || draft.fingerprint !== fingerprint || !draft.idempotencyKey) {
    draft = { fingerprint, idempotencyKey: crypto.randomUUID() }
    sessionStorage.setItem(key, JSON.stringify(draft))
  }
  return draft.idempotencyKey
}

export function clearCheckoutKey(userId) {
  sessionStorage.removeItem(PREFIX + `checkout:${userId}`)
}
