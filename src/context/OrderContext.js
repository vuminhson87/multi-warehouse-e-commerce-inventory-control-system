import { createContext, useContext } from 'react'

// Context đơn hàng tách riêng file (giống InventoryContext.js) để file Provider chỉ xuất component.
export const OrderContext = createContext(null)

export function useOrders() {
    const context = useContext(OrderContext)

    if (!context) {
        throw new Error('useOrders phải nằm trong OrderProvider')
    }

    return context
}
