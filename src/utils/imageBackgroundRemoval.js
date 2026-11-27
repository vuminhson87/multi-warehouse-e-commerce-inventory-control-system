/**
 * Tách nền ảnh sản phẩm phía trình duyệt bằng thuật toán loang từ biên (Edge-Connected Flood-Fill).
 * Chỉ xóa vùng nền nối với mép ảnh, giữ nguyên các chi tiết sáng màu bên trong thân sản phẩm.
 */

function colorDistance(r1, g1, b1, r2, g2, b2) {
    const dr = r1 - r2
    const dg = g1 - g2
    const db = b1 - b2
    return Math.sqrt(dr * dr + dg * dg + db * db)
}

function estimateBorderBackgroundColor(data, width, height) {
    const sampleR = []
    const sampleG = []
    const sampleB = []
    let transparentCount = 0
    let totalBorder = 0

    const pushPixel = (x, y) => {
        const idx = (y * width + x) * 4
        totalBorder += 1
        if (data[idx + 3] < 200) {
            transparentCount += 1
            return
        }
        sampleR.push(data[idx])
        sampleG.push(data[idx + 1])
        sampleB.push(data[idx + 2])
    }

    for (let x = 0; x < width; x += 1) {
        pushPixel(x, 0)
        if (height > 1) pushPixel(x, height - 1)
    }
    for (let y = 1; y < height - 1; y += 1) {
        pushPixel(0, y)
        if (width > 1) pushPixel(width - 1, y)
    }

    if (totalBorder > 0 && transparentCount / totalBorder >= 0.1) {
        return { alreadyTransparent: true, r: 255, g: 255, b: 255 }
    }

    if (sampleR.length === 0) {
        return { alreadyTransparent: false, r: 255, g: 255, b: 255 }
    }

    sampleR.sort((a, b) => a - b)
    sampleG.sort((a, b) => a - b)
    sampleB.sort((a, b) => a - b)
    const mid = Math.floor(sampleR.length / 2)

    return {
        alreadyTransparent: false,
        r: sampleR[mid],
        g: sampleG[mid],
        b: sampleB[mid],
    }
}

export function removeBackgroundFromImageData(
    data,
    width,
    height,
    { tolerance = 38 } = {}
) {
    const output = new Uint8ClampedArray(data)
    if (width <= 0 || height <= 0) {
        return { data: output, removedPixels: 0, skipped: true }
    }

    const bg = estimateBorderBackgroundColor(output, width, height)
    if (bg.alreadyTransparent) {
        return { data: output, removedPixels: 0, skipped: true }
    }

    const totalPixels = width * height
    const visited = new Uint8Array(totalPixels)
    const removed = new Uint8Array(totalPixels)
    const queue = new Int32Array(totalPixels)
    let head = 0
    let tail = 0

    const seedTolerance = tolerance * 1.25
    const stepLimit = Math.max(18, tolerance * 0.65)

    const tryEnqueue = (x, y, refR, refG, refB) => {
        const pos = y * width + x
        if (visited[pos]) return
        const idx = pos * 4
        if (output[idx + 3] === 0) {
            visited[pos] = 1
            removed[pos] = 1
            queue[tail++] = pos
            return
        }

        const r = output[idx]
        const g = output[idx + 1]
        const b = output[idx + 2]
        const globalDist = colorDistance(r, g, b, bg.r, bg.g, bg.b)
        const localDist = colorDistance(r, g, b, refR, refG, refB)

        if (globalDist <= tolerance && localDist <= stepLimit) {
            visited[pos] = 1
            removed[pos] = 1
            queue[tail++] = pos
        }
    }

    // Gieo điểm bắt đầu dọc theo toàn bộ viền ngoài của ảnh.
    for (let x = 0; x < width; x += 1) {
        for (const y of height > 1 ? [0, height - 1] : [0]) {
            const pos = y * width + x
            if (visited[pos]) continue
            const idx = pos * 4
            if (
                output[idx + 3] < 200 ||
                colorDistance(output[idx], output[idx + 1], output[idx + 2], bg.r, bg.g, bg.b) <=
                    seedTolerance
            ) {
                visited[pos] = 1
                removed[pos] = 1
                queue[tail++] = pos
            }
        }
    }
    for (let y = 1; y < height - 1; y += 1) {
        for (const x of width > 1 ? [0, width - 1] : [0]) {
            const pos = y * width + x
            if (visited[pos]) continue
            const idx = pos * 4
            if (
                output[idx + 3] < 200 ||
                colorDistance(output[idx], output[idx + 1], output[idx + 2], bg.r, bg.g, bg.b) <=
                    seedTolerance
            ) {
                visited[pos] = 1
                removed[pos] = 1
                queue[tail++] = pos
            }
        }
    }

    while (head < tail) {
        const pos = queue[head++]
        const x = pos % width
        const y = (pos - x) / width
        const idx = pos * 4
        const r = output[idx]
        const g = output[idx + 1]
        const b = output[idx + 2]

        if (x > 0) tryEnqueue(x - 1, y, r, g, b)
        if (x + 1 < width) tryEnqueue(x + 1, y, r, g, b)
        if (y > 0) tryEnqueue(x, y - 1, r, g, b)
        if (y + 1 < height) tryEnqueue(x, y + 1, r, g, b)
    }

    let removedPixels = 0
    for (let pos = 0; pos < totalPixels; pos += 1) {
        if (removed[pos]) {
            output[pos * 4 + 3] = 0
            removedPixels += 1
        }
    }

    // Làm mượt viền tiếp giáp giữa vật thể và vùng nền vừa xóa để tránh răng cưa.
    const featherSpan = 20
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const pos = y * width + x
            if (removed[pos]) continue

            let touchesRemoved = false
            for (let dy = -1; dy <= 1 && !touchesRemoved; dy += 1) {
                for (let dx = -1; dx <= 1; dx += 1) {
                    if (dx === 0 && dy === 0) continue
                    const nx = x + dx
                    const ny = y + dy
                    if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                        if (removed[ny * width + nx]) {
                            touchesRemoved = true
                            break
                        }
                    }
                }
            }

            if (!touchesRemoved) continue

            const idx = pos * 4
            const dist = colorDistance(output[idx], output[idx + 1], output[idx + 2], bg.r, bg.g, bg.b)
            if (dist < tolerance + featherSpan) {
                const ratio = Math.min(
                    1,
                    Math.max(0.15, (dist - tolerance * 0.85) / featherSpan)
                )
                output[idx + 3] = Math.round(output[idx + 3] * ratio)
            }
        }
    }

    return { data: output, removedPixels, skipped: false }
}

async function decodeImageSource(file) {
    if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file)
        return {
            source: bitmap,
            width: bitmap.width,
            height: bitmap.height,
            cleanup: () => bitmap.close?.(),
        }
    }

    const objectUrl = URL.createObjectURL(file)
    try {
        const img = await new Promise((resolve, reject) => {
            const element = new Image()
            element.onload = () => resolve(element)
            element.onerror = () => reject(new Error('Không thể đọc tệp ảnh.'))
            element.src = objectUrl
        })
        return {
            source: img,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            cleanup: () => URL.revokeObjectURL(objectUrl),
        }
    } catch (error) {
        URL.revokeObjectURL(objectUrl)
        throw error
    }
}

/**
 * Tách nền tệp ảnh người dùng chọn và xuất ra File PNG nền trong suốt.
 */
export async function removeImageBackground(
    file,
    { tolerance = 38, maxDimension = 1200 } = {}
) {
    const decoded = await decodeImageSource(file)
    try {
        const scale = Math.min(
            1,
            maxDimension / Math.max(decoded.width || 1, decoded.height || 1)
        )
        const targetWidth = Math.max(1, Math.round(decoded.width * scale))
        const targetHeight = Math.max(1, Math.round(decoded.height * scale))

        const canvas = document.createElement('canvas')
        canvas.width = targetWidth
        canvas.height = targetHeight

        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) {
            throw new Error('Trình duyệt không hỗ trợ xử lý Canvas.')
        }

        ctx.drawImage(decoded.source, 0, 0, targetWidth, targetHeight)
        const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight)
        const processed = removeBackgroundFromImageData(
            imageData.data,
            targetWidth,
            targetHeight,
            { tolerance }
        )

        if (processed.skipped) {
            return { file, backgroundRemoved: false }
        }

        const nextImageData = new ImageData(processed.data, targetWidth, targetHeight)
        ctx.putImageData(nextImageData, 0, 0)

        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (result) =>
                    result ? resolve(result) : reject(new Error('Không thể xuất ảnh PNG.')),
                'image/png'
            )
        })

        const baseName = String(file.name || 'product').replace(/\.[^.]+$/, '')
        const processedFile = new File([blob], `${baseName}-nobg.png`, {
            type: 'image/png',
        })

        return {
            file: processedFile,
            backgroundRemoved: processed.removedPixels > 0,
        }
    } finally {
        decoded.cleanup()
    }
}
