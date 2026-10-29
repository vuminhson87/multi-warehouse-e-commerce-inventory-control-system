import { useCallback, useEffect, useState } from 'react'
import { getOrderDetailApi } from '../services/orderApi.js'
import { adaptOrder } from '../services/orderAdapter.js'

export function useCustomerOrder(token, orderId) {
  const [revision, setRevision] = useState(0)
  const requestKey = token && orderId ? `${token}:${orderId}:${revision}` : null

  const [state, setState] = useState({
    key: null,
    order: null,
    error: null,
  })

  const reload = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (!token || !orderId || !requestKey) {
      return () => { cancelled = true }
    }

    getOrderDetailApi(token, orderId)
      .then(data => {
        if (!cancelled) {
          setState({
            key: requestKey,
            order: adaptOrder(data),
            error: null,
          })
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState({
            key: requestKey,
            order: null,
            error: err,
          })
        }
      })

    return () => { cancelled = true }
  }, [token, orderId, requestKey])

  if (!requestKey) {
    return { order: null, loading: false, error: null, reload }
  }

  const loading = state.key !== requestKey
  return {
    order: loading ? null : state.order,
    loading,
    error: loading ? null : state.error,
    reload,
  }
}
