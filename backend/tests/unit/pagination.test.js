import { describe, expect, it } from 'vitest'
import { getPaginationWindow } from '../../../src/utils/pagination.js'

describe('fixed 5-page chunk pagination window', () => {
    it('shows pages 1..5 for pages 1 through 5 without centering the selected page', () => {
        for (const page of [1, 2, 3, 4, 5]) {
            const result = getPaginationWindow(page, 12)
            expect(result.page).toBe(page)
            expect(result.pages).toEqual([1, 2, 3, 4, 5])
        }
    })

    it('advances to pages 6..10 starting from page 6 when stepping past page 5', () => {
        for (const page of [6, 7, 8, 9, 10]) {
            const result = getPaginationWindow(page, 12)
            expect(result.page).toBe(page)
            expect(result.pages).toEqual([6, 7, 8, 9, 10])
        }

        expect(getPaginationWindow(11, 12).pages).toEqual([11, 12])
        expect(getPaginationWindow(12, 12).pages).toEqual([11, 12])
    })

    it('computes previous/next arrow availability and clamps out-of-range page numbers', () => {
        expect(getPaginationWindow(1, 5)).toEqual({
            page: 1,
            totalPages: 5,
            pages: [1, 2, 3, 4, 5],
            hasPrev: false,
            hasNext: true,
        })

        expect(getPaginationWindow(5, 5)).toEqual({
            page: 5,
            totalPages: 5,
            pages: [1, 2, 3, 4, 5],
            hasPrev: true,
            hasNext: false,
        })

        expect(getPaginationWindow(99, 7)).toEqual({
            page: 7,
            totalPages: 7,
            pages: [6, 7],
            hasPrev: true,
            hasNext: false,
        })

        expect(getPaginationWindow(1, 0)).toEqual({
            page: 1,
            totalPages: 0,
            pages: [],
            hasPrev: false,
            hasNext: false,
        })
    })
})
