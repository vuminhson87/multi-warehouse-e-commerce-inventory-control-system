export const DEFAULT_PRODUCT_CATEGORIES = [
    'Laptop',
    'Điện thoại',
    'Phụ kiện',
    'Màn hình',
    'Âm thanh',
]

export const CUSTOM_CATEGORY_OPTION = '__CUSTOM__'

export function buildProductCategoryOptions(products = [], currentCategory = '') {
    const seen = new Set()
    const list = []

    const add = (value) => {
        const trimmed = typeof value === 'string' ? value.trim() : ''
        if (!trimmed || seen.has(trimmed)) return
        seen.add(trimmed)
        list.push(trimmed)
    }

    DEFAULT_PRODUCT_CATEGORIES.forEach(add)
    products.forEach((product) => add(product?.category))
    add(currentCategory)

    return list
}
