import { createContext, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { loadProducts, saveProduct, setProductStatus } from '../services/productApi.js'

const ProductContext = createContext(null)
const emptyProducts = []

export function ProductProvider({ children }) {
    const { currentUser, token } = useAuth()
    const adminToken = currentUser?.role === 'ADMIN' ? token : null
    const [state, setState] = useState(null)
    const [revision, setRevision] = useState(0)
    const current = state?.token === adminToken ? state : null

    useEffect(() => {
        const controller = new AbortController()
        loadProducts(adminToken, controller.signal)
            .then(products => {
                if (!controller.signal.aborted) setState({ token: adminToken, products, error: null })
            })
            .catch(error => {
                if (!controller.signal.aborted) setState({ token: adminToken, products: [], error })
            })
        return () => controller.abort()
    }, [adminToken, revision])

    async function mutate(request) {
        if (!adminToken) throw new Error('Vui lòng đăng nhập bằng tài khoản quản trị.')
        const product = await request(adminToken)
        setState(previous => {
            if (previous?.token !== adminToken) return previous
            const existing = previous.products.find(item => item.id === product.id)
            const updated = { ...existing, ...product }
            updated.status = updated.isActive ? 'ACTIVE' : 'DISCONTINUED'
            const products = existing
                ? previous.products.map(item => item.id === updated.id ? updated : item)
                : [...previous.products, updated]
            return { ...previous, products }
        })
        setRevision(value => value + 1)
        return product
    }

    return (
        <ProductContext.Provider value={{
            products: current?.products ?? emptyProducts,
            loading: current === null,
            error: current?.error ?? null,
            addProduct: form => mutate(token => saveProduct(token, null, form)),
            updateProduct: (id, form) => mutate(token => saveProduct(token, id, form)),
            updateProductStatus: (id, status) => mutate(token => setProductStatus(token, id, status)),
        }}>
            {children}
        </ProductContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProducts() {
    const context = useContext(ProductContext)
    if (!context) throw new Error('useProducts phải nằm trong ProductProvider')
    return context
}
