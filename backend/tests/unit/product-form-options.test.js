import { describe, expect, it } from 'vitest'
import { normalizeProductImageUrl } from '../../src/modules/product/product.routes.js'
import {
    buildProductCategoryOptions,
    DEFAULT_PRODUCT_CATEGORIES,
} from '../../../src/constants/productCategories.js'
import { ErrorCodes } from '../../src/shared/errors.js'

describe('Product imageUrl validation & category options', () => {
    it('accepts valid internal /images/, /uploads/, and http(s) URLs while rejecting unsafe schemes', () => {
        expect(normalizeProductImageUrl(undefined)).toBeUndefined()
        expect(normalizeProductImageUrl(null)).toBeNull()
        expect(normalizeProductImageUrl('   ')).toBeNull()
        expect(normalizeProductImageUrl('/images/products/p1.jpg')).toBe('/images/products/p1.jpg')
        expect(normalizeProductImageUrl('/uploads/products/test.png')).toBe('/uploads/products/test.png')
        expect(normalizeProductImageUrl('https://example.com/item.webp')).toBe('https://example.com/item.webp')

        for (const unsafe of ['javascript:alert(1)', 'data:image/png;base64,abc', '/etc/passwd', 'https://user:pass@example.com/a.png']) {
            expect(() => normalizeProductImageUrl(unsafe)).toThrowError()
            try {
                normalizeProductImageUrl(unsafe)
            } catch (error) {
                expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR)
            }
        }
    })

    it('includes all standard categories plus any extra categories from existing products without duplicates', () => {
        const options = buildProductCategoryOptions(
            [
                { category: 'Laptop' },
                { category: 'Máy tính bảng' },
                { category: 'Phụ kiện' },
            ],
            'Thiết bị mạng'
        )

        for (const preset of DEFAULT_PRODUCT_CATEGORIES) {
            expect(options).toContain(preset)
        }
        expect(options).toContain('Máy tính bảng')
        expect(options).toContain('Thiết bị mạng')
        expect(new Set(options).size).toBe(options.length)
    })
})
