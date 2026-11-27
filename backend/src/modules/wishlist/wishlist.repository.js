import { AppError, ErrorCodes } from '../../shared/errors.js'

export async function listWishlistProductIds(client, userId) {
    const rows = await client.wishlistItem.findMany({
        where: {
            userId,
            product: { isActive: true },
        },
        select: { productId: true },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    return rows.map((row) => row.productId)
}

export async function addWishlistItem(client, { userId, productId }) {
    const product = await client.product.findUnique({
        where: { id: productId },
        select: { id: true, isActive: true },
    })

    if (!product || !product.isActive) {
        throw new AppError(
            ErrorCodes.PRODUCT_UNAVAILABLE,
            'Sản phẩm không tồn tại hoặc đã ngừng kinh doanh.'
        )
    }

    await client.wishlistItem.upsert({
        where: {
            userId_productId: { userId, productId },
        },
        create: { userId, productId },
        update: {},
    })

    return listWishlistProductIds(client, userId)
}

export async function removeWishlistItem(client, { userId, productId }) {
    await client.wishlistItem.deleteMany({
        where: { userId, productId },
    })

    return listWishlistProductIds(client, userId)
}
