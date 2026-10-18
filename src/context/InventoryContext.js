import { createContext, useContext } from 'react'

export const InventoryContext = createContext(null)

export function useInventory() {
    const context = useContext(InventoryContext)

    if (!context) {
        throw new Error('useInventory phải nằm trong InventoryProvider')
    }

    return context
}
