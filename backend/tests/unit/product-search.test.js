import { describe, expect, it } from 'vitest'
import {
    normalizeSearchText,
    scoreProductMatch,
    searchProductSuggestions,
} from '../../../src/utils/productSearch.js'

const SAMPLE_PRODUCTS = [
    { id: 1, name: 'Laptop Dell Inspiron 15', category: 'Laptop', status: 'ACTIVE' },
    { id: 2, name: 'Logitech G304', category: 'Phụ kiện', status: 'ACTIVE' },
    { id: 3, name: 'Keychron K2', category: 'Phụ kiện', status: 'ACTIVE' },
    { id: 4, name: 'Apple MacBook Pro 16 M3 Max', category: 'Laptop', status: 'ACTIVE' },
    { id: 5, name: 'Apple MacBook Air 13 M3', category: 'Laptop', status: 'ACTIVE' },
    { id: 13, name: 'iPhone 16 Pro Max 256GB', category: 'Điện thoại', status: 'ACTIVE' },
    { id: 14, name: 'iPhone 15 128GB', category: 'Điện thoại', status: 'ACTIVE' },
    { id: 15, name: 'Samsung Galaxy S24 Ultra 5G', category: 'Điện thoại', status: 'ACTIVE' },
    { id: 24, name: 'Bàn phím cơ Keychron Q1 Pro Custom', category: 'Phụ kiện', status: 'ACTIVE' },
    { id: 99, name: 'Database product', category: 'Test', status: 'ACTIVE' },
    { id: 100, name: 'iPhone 13 Ngừng bán', category: 'Điện thoại', status: 'DISCONTINUED' },
]

describe('Product fuzzy & near-match search', () => {
    it('normalizes Vietnamese diacritics and punctuation', () => {
        expect(normalizeSearchText('Điện thoại Đế sạc 3-in-1')).toBe('dien thoai de sac 3 in 1')
    })

    it('matches exact, prefix, and accent-free Vietnamese queries', () => {
        const iphoneSuggestions = searchProductSuggestions(SAMPLE_PRODUCTS, 'iphone')
        expect(iphoneSuggestions.map((p) => p.id)).toEqual([14, 13])

        const keyboardSuggestions = searchProductSuggestions(SAMPLE_PRODUCTS, 'ban phim')
        expect(keyboardSuggestions.map((p) => p.id)).toContain(24)

        const phoneCategorySuggestions = searchProductSuggestions(SAMPLE_PRODUCTS, 'dien thoai')
        expect(phoneCategorySuggestions.map((p) => p.id)).toEqual([14, 13, 15])
    })

    it('suggests close product names despite typos, missing letters, or joined/split words', () => {
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'ipone').map((p) => p.id)).toEqual([14, 13])
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'iphn').map((p) => p.id)).toEqual([14, 13])
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'samung').map((p) => p.id)).toEqual([15])
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'macbok').map((p) => p.id)).toEqual([5, 4])
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'mac book').map((p) => p.id)).toEqual([5, 4])
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'keycron').map((p) => p.id)).toEqual([3, 24])
    })

    it('keeps numeric model tokens exact and excludes discontinued products', () => {
        const iphone16 = searchProductSuggestions(SAMPLE_PRODUCTS, 'iphone 16')
        expect(iphone16.map((p) => p.id)).toEqual([13])
        expect(iphone16.some((p) => p.id === 100)).toBe(false)
    })

    it('returns no false matches for unrelated queries', () => {
        expect(searchProductSuggestions(SAMPLE_PRODUCTS, 'not-a-real-product')).toEqual([])
        expect(scoreProductMatch(SAMPLE_PRODUCTS[9], 'Database')).toBeGreaterThan(0)
        expect(scoreProductMatch(SAMPLE_PRODUCTS[9], 'not-a-real-product')).toBe(0)
    })
})
