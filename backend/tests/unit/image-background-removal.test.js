import { describe, expect, it } from 'vitest'
import { removeBackgroundFromImageData } from '../../../src/utils/imageBackgroundRemoval.js'

function createSyntheticImage(width, height, fillFn) {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const [r, g, b, a = 255] = fillFn(x, y)
            const idx = (y * width + x) * 4
            data[idx] = r
            data[idx + 1] = g
            data[idx + 2] = b
            data[idx + 3] = a
        }
    }
    return data
}

describe('Image background removal flood-fill', () => {
    it('removes outer white background while preserving dark object and white logo inside it', () => {
        const width = 9
        const height = 9
        // Outer white ring (0..1, 7..8), dark product body (2..6), inner white logo at (4, 4).
        const input = createSyntheticImage(width, height, (x, y) => {
            if (x === 4 && y === 4) return [255, 255, 255, 255]
            if (x >= 2 && x <= 6 && y >= 2 && y <= 6) return [24, 24, 27, 255]
            return [250, 250, 250, 255]
        })

        const result = removeBackgroundFromImageData(input, width, height, { tolerance: 35 })

        expect(result.skipped).toBe(false)
        expect(result.removedPixels).toBeGreaterThan(0)
        // Outer corner becomes transparent
        expect(result.data[3]).toBe(0)
        // Product body remains opaque
        const bodyIdx = (3 * width + 3) * 4
        expect(result.data[bodyIdx + 3]).toBe(255)
        // White logo enclosed inside product body is NOT erased
        const innerWhiteIdx = (4 * width + 4) * 4
        expect(result.data[innerWhiteIdx + 3]).toBe(255)
    })

    it('skips processing when image already has transparent edges', () => {
        const width = 5
        const height = 5
        const input = createSyntheticImage(width, height, (x, y) =>
            x === 0 || y === 0 ? [0, 0, 0, 0] : [120, 120, 120, 255]
        )

        const result = removeBackgroundFromImageData(input, width, height)
        expect(result.skipped).toBe(true)
        expect(result.removedPixels).toBe(0)
    })
})
