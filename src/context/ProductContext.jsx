
import {
    createContext,
    useContext,
    useState,
} from 'react'
import initialProducts from '../data/products'

const ProductContext = createContext(null)
const STORAGE_KEY = 'admin_products'

function getInitialProducts() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY)

        if (stored !== null) {
            const parsed = JSON.parse(stored)

            if (Array.isArray(parsed)) {
                return parsed.map((product) => ({
                    ...product,
                    status: product.status ?? 'ACTIVE',
                }))
            }
        }
    } catch (error) {
        console.error('Không thể đọc dữ liệu sản phẩm:', error)
    }

    return initialProducts.map((product) => ({
        ...product,
        status: 'ACTIVE',
    }))
}

export function ProductProvider({ children }) {
    const [products, setProducts] = useState(getInitialProducts)

    function saveProducts(updater) {
        setProducts((previousProducts) => {
            const nextProducts = updater(previousProducts)
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(nextProducts)
            )
            return nextProducts
        })
    }

    function addProduct(productData) {
        saveProducts((previousProducts) => {
            const nextId =
                Math.max(
                    0,
                    ...previousProducts.map((product) => Number(product.id) || 0)
                ) + 1

            const newProduct = {
                id: nextId,
                name: productData.name.trim(),
                category: productData.category.trim(),
                price: Number(productData.price),
                description: productData.description.trim(),
                inStock: Boolean(productData.inStock),
                status: 'ACTIVE',
            }

            return [...previousProducts, newProduct]
        })
    }


    function updateProduct(productId, productData) {
        saveProducts((previousProducts) =>
            previousProducts.map((product) => {
                if (String(product.id) !== String(productId)) {
                    return product
                }

                return {
                    ...product,
                    name: productData.name.trim(),
                    category: productData.category.trim(),
                    price: Number(productData.price),
                    description: productData.description.trim(),
                }
            })
        )
    }


    function updateProductStatus(productId, newStatus) {
        if (!['ACTIVE', 'DISCONTINUED'].includes(newStatus)) {
            return
        }

        saveProducts((previousProducts) =>
            previousProducts.map((product) =>
                String(product.id) === String(productId)
                    ? { ...product, status: newStatus }
                    : product
            )
        )
    }

    return (
        <ProductContext.Provider
            value={{
                products,
                addProduct,
                updateProduct,
                updateProductStatus,
            }}
        >
            {children}
        </ProductContext.Provider>
    )
}

export function useProducts() {
    const context = useContext(ProductContext)

    if (!context) {
        throw new Error('useProducts phải nằm trong ProductProvider')
    }

    return context
}
