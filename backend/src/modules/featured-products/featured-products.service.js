import prisma from '../../db/prisma.js'
import { IsolationLevel, runInTransaction } from '../../db/transaction.js'
import { validationError } from '../../shared/errors.js'

const MAX_SLIDES = 5
const ASSET_ORIGIN = 'https://storefront.invalid'
const SLIDE_PRODUCT = {
    product: {
        select: {
            id: true,
            sku: true,
            name: true,
            category: true,
            description: true,
            imageUrl: true,
            isActive: true,
        },
    },
}

function invalidField(field, reason) {
    throw validationError([{ field, reason }])
}

function optionalText(value, field, maxLength) {
    if (value == null) return null

    if (typeof value !== 'string') {
        invalidField(field, 'Giá trị phải là văn bản.')
    }

    const text = value.trim()
    if (text.length > maxLength) {
        invalidField(field, `Tối đa ${maxLength} ký tự.`)
    }

    return text || null
}

function optionalImageUrl(value, field) {
    const imageUrl = optionalText(value, field, 500)
    if (imageUrl === null) return null

    let parsed
    try {
        parsed = new URL(imageUrl, ASSET_ORIGIN)
    } catch {
        invalidField(field, 'Đường dẫn ảnh không hợp lệ.')
    }

    const internal =
        imageUrl.startsWith('/images/') &&
        parsed.origin === ASSET_ORIGIN &&
        parsed.pathname.startsWith('/images/')
    const external =
        /^https:\/\//i.test(imageUrl) &&
        parsed.protocol === 'https:' &&
        !parsed.username &&
        !parsed.password

    if (!internal && !external) {
        invalidField(field, 'Dùng đường dẫn /images/ hoặc URL HTTPS.')
    }

    return imageUrl
}

function normalizeSlides(input) {
    if (!Array.isArray(input?.slides) || input.slides.length > MAX_SLIDES) {
        invalidField('slides', `Chọn tối đa ${MAX_SLIDES} sản phẩm.`)
    }

    const usedProductIds = new Set()

    return input.slides.map((slide, index) => {
        const field = `slides[${index}]`
        const productId = slide?.productId
        if (!Number.isInteger(productId) || productId < 1 || productId > 2147483647) {
            invalidField(`${field}.productId`, 'ID sản phẩm không hợp lệ.')
        }
        if (usedProductIds.has(productId)) {
            invalidField(`${field}.productId`, 'Sản phẩm đã được chọn.')
        }

        usedProductIds.add(productId)

        return {
            productId,
            position: index + 1,
            imageUrlOverride: optionalImageUrl(slide.imageUrlOverride, `${field}.imageUrlOverride`),
            descriptionOverride: optionalText(slide.descriptionOverride, `${field}.descriptionOverride`, 200),
        }
    })
}

export function listAdminFeaturedSlides(client = prisma) {
    return client.homeFeaturedSlide.findMany({
        orderBy: { position: 'asc' },
        include: SLIDE_PRODUCT,
    })
}

export async function listPublicFeaturedSlides(client = prisma) {
    const slides = await client.homeFeaturedSlide.findMany({
        where: { product: { is: { isActive: true } } },
        orderBy: { position: 'asc' },
        include: SLIDE_PRODUCT,
    })

    return slides.map(({ product, productId, imageUrlOverride, descriptionOverride }) => ({
        productId,
        name: product.name,
        category: product.category,
        imageUrl: imageUrlOverride ?? product.imageUrl,
        description: descriptionOverride ?? product.description,
    }))
}

export async function replaceAdminFeaturedSlides(input, client = prisma) {
    const slides = normalizeSlides(input)

    return runInTransaction(
        async (tx) => {
            const products = await tx.product.findMany({
                where: { id: { in: slides.map((slide) => slide.productId) }, isActive: true },
                select: { id: true },
            })

            if (products.length !== slides.length) {
                invalidField('slides', 'Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh.')
            }

            await tx.homeFeaturedSlide.deleteMany()
            if (slides.length > 0) {
                await tx.homeFeaturedSlide.createMany({ data: slides })
            }

            return listAdminFeaturedSlides(tx)
        },
        { client, isolationLevel: IsolationLevel.SERIALIZABLE }
    )
}

