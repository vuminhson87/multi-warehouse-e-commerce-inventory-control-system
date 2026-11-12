/* global __ENV, __VU */
import http from 'k6/http'
import { check } from 'k6'
import { Trend, Counter } from 'k6/metrics'
const fixtures = JSON.parse(__ENV.CHECKOUT_FIXTURES)
const reservation = new Trend('reservation_duration', true)
const accepted = new Counter('orders_created')
const rejected = new Counter('orders_out_of_stock')
http.setResponseCallback(http.expectedStatuses(201, 409))
export const options = {
  scenarios: { checkout: { executor: 'per-vu-iterations', vus: 30, iterations: 1, maxDuration: '60s' } },
  thresholds: { checks: ['rate==1'], http_req_failed: ['rate==0'], reservation_duration: ['p(95)<=5000'], orders_created: ['count==10'], orders_out_of_stock: ['count==20'] },
}
export default function () {
  const fixture = fixtures[__VU - 1]
  const response = http.post(`${__ENV.API_URL}/api/orders`, JSON.stringify({ idempotencyKey: fixture.key, items: [{ productId: 1, quantity: 1 }] }), { headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${fixture.token}` }, timeout: '20s' })
  reservation.add(response.timings.duration)
  let data
  try { data = response.json() } catch { data = null }
  const valid = check(response, {
    'created or explicitly out of stock': r => r.status === 201 ? data?.success === true && data?.data?.status === 'PendingPayment' : r.status === 409 && data?.error?.code === 'OUT_OF_STOCK',
  })
  if (valid && response.status === 201) accepted.add(1)
  if (valid && response.status === 409) rejected.add(1)
}
