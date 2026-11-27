/**
 * Chuẩn hóa chuỗi tìm kiếm: bỏ dấu tiếng Việt, chuyển chữ thường, gộp khoảng trắng.
 */
export function normalizeSearchText(value) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim()
}

/**
 * Khoảng cách Damerau-Levenshtein (Optimal String Alignment):
 * xử lý thiếu ký tự, thừa ký tự, sai ký tự và đảo chỗ 2 ký tự liền kề.
 */
function damerauLevenshtein(a, b) {
    const m = a.length
    const n = b.length
    if (m === 0) return n
    if (n === 0) return m

    const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
    for (let i = 0; i <= m; i += 1) dp[i][0] = i
    for (let j = 0; j <= n; j += 1) dp[0][j] = j

    for (let i = 1; i <= m; i += 1) {
        for (let j = 1; j <= n; j += 1) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1
            let best = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            )
            if (
                i > 1 &&
                j > 1 &&
                a[i - 1] === b[j - 2] &&
                a[i - 2] === b[j - 1]
            ) {
                best = Math.min(best, dp[i - 2][j - 2] + 1)
            }
            dp[i][j] = best
        }
    }

    return dp[m][n]
}

function scoreTokenAgainstWords(queryToken, targetWords) {
    let best = 0
    const isNumericOnly = /^\d+$/.test(queryToken)
    const hasLetter = /[a-z]/.test(queryToken)

    for (const word of targetWords) {
        if (word === queryToken) {
            return 100
        }

        if (word.startsWith(queryToken)) {
            best = Math.max(best, queryToken.length >= 3 ? 92 : 84)
            continue
        }

        if (queryToken.length >= 2 && word.includes(queryToken)) {
            best = Math.max(best, 72)
            continue
        }

        // Chỉ so khớp gần đúng (typo) cho từ có chữ cái và dài từ 3 ký tự trở lên;
        // tránh việc số hiệu (vd "16") tự khớp nhầm sang số khác ("15").
        if (isNumericOnly || !hasLetter || queryToken.length < 3 || !/[a-z]/.test(word)) {
            continue
        }

        const maxLen = Math.max(queryToken.length, word.length)
        const maxDist = queryToken.length <= 4 ? 1 : 2

        if (
            Math.abs(queryToken.length - word.length) <= maxDist &&
            (queryToken.length > 4 || word.length >= 3)
        ) {
            const dist = damerauLevenshtein(queryToken, word)
            const firstLetterOk = queryToken.length >= 4 || queryToken[0] === word[0]
            if (dist <= maxDist && firstLetterOk && dist / maxLen <= 0.35) {
                const fuzzyScore = Math.max(45, 70 - dist * 12)
                best = Math.max(best, fuzzyScore)
                continue
            }
        }

        // So khớp tiền tố gần đúng khi khách hàng mới gõ dở từ bị sai chính tả (vd "iphn" -> "iphone")
        if (queryToken.length >= 4 && word.length > queryToken.length && queryToken[0] === word[0]) {
            const slices = [
                word.slice(0, queryToken.length),
                word.slice(0, queryToken.length + 1),
            ]
            for (const slice of slices) {
                const dist = damerauLevenshtein(queryToken, slice)
                if (dist <= 1) {
                    best = Math.max(best, 56)
                    break
                }
            }
        }
    }

    return best
}

/**
 * Chấm điểm mức độ phù hợp của sản phẩm với từ khóa tìm kiếm.
 * Trả về 0 nếu không khớp.
 */
export function scoreProductMatch(product, rawQuery) {
    const queryNorm = normalizeSearchText(rawQuery)
    if (!queryNorm || !product) return 0

    const nameNorm = normalizeSearchText(product.name)
    const categoryNorm = normalizeSearchText(product.category)
    if (!nameNorm && !categoryNorm) return 0

    const nameWords = nameNorm ? nameNorm.split(' ') : []
    const categoryWords = categoryNorm ? categoryNorm.split(' ') : []
    const compactName = nameNorm.replace(/\s+/g, '')
    const compactCategory = categoryNorm.replace(/\s+/g, '')
    const compactQuery = queryNorm.replace(/\s+/g, '')

    const compactMatch =
        compactQuery.length >= 3 &&
        (compactName.includes(compactQuery) || compactCategory.includes(compactQuery))

    const allTokens = queryNorm.split(' ').filter(Boolean)
    const significantTokens = allTokens.filter((token) => token.length >= 2)
    const tokensToCheck = significantTokens.length > 0 ? significantTokens : allTokens

    let tokenScoreSum = 0
    for (const token of tokensToCheck) {
        const nameScore = scoreTokenAgainstWords(token, nameWords)
        const categoryScore = Math.round(scoreTokenAgainstWords(token, categoryWords) * 0.7)
        const tokenBest = Math.max(nameScore, categoryScore)
        if (tokenBest === 0 && !compactMatch) {
            return 0
        }
        tokenScoreSum += tokenBest
    }

    let bonus = 0
    if (nameNorm === queryNorm) bonus += 400
    else if (nameNorm.startsWith(queryNorm)) bonus += 250
    else if (nameNorm.includes(queryNorm)) bonus += 150
    else if (compactQuery.length >= 3 && compactName.includes(compactQuery)) bonus += 130
    else if (categoryNorm.includes(queryNorm)) bonus += 80

    return tokenScoreSum + bonus
}

/**
 * Trả về tối đa `limit` sản phẩm đang kinh doanh có tên/danh mục gần giống với từ khóa.
 */
export function searchProductSuggestions(products = [], rawQuery, limit = 7) {
    const queryNorm = normalizeSearchText(rawQuery)
    if (!queryNorm) return []

    const scored = []
    for (const product of products) {
        if ((product.status ?? 'ACTIVE') !== 'ACTIVE') continue
        const score = scoreProductMatch(product, rawQuery)
        if (score > 0) {
            scored.push({ product, score })
        }
    }

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score
        const lenDiff = String(a.product.name ?? '').length - String(b.product.name ?? '').length
        if (lenDiff !== 0) return lenDiff
        return Number(a.product.id) - Number(b.product.id)
    })

    return scored.slice(0, limit).map((entry) => entry.product)
}
