import { useCallback, useEffect, useState } from 'react'
import { getOrdersApi } from '../services/orderApi.js'
import { adaptOrder } from '../services/orderAdapter.js'

const EMPTY_PAGINATION = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 0,
}

export function useCustomerOrders(token, statusFilter = 'ALL', page = 1) {
  const [revision, setRevision] = useState(0)
  const requestKey = token ? `${token}:${statusFilter}:${page}:${revision}` : null

  const [state, setState] = useState({
    key: null,
    orders: [],
    pagination: EMPTY_PAGINATION,
    error: null,
  })

  const reload = useCallback(() => setRevision(n => n + 1), [])

  useEffect(() => {
    let cancelled = false
    if (!token || !requestKey) {
      return () => { cancelled = true }
    }

    getOrdersApi(token, { page, limit: 20, status: statusFilter })
      .then(data => {
        if (!cancelled) {
          setState({
            key: requestKey,
            orders: (data.orders ?? []).map(adaptOrder),
            pagination: data.pagination ?? EMPTY_PAGINATION,
            error: null,
          })
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState({
            key: requestKey,
            orders: [],
            pagination: EMPTY_PAGINATION,
            error: err,
          })
        }
      })

    return () => { cancelled = true }
  }, [token, statusFilter, page, requestKey])

  if (!requestKey) {
    return {
      orders: [],
      pagination: EMPTY_PAGINATION,
      loading: false,
      error: null,
      reload,
    }
  }

  const loading = state.key !== requestKey
  return {
    orders: loading ? [] : state.orders,
    pagination: loading ? state.pagination : state.pagination,
    loading,
    error: loading ? null : state.error,
    reload,
  }
}
