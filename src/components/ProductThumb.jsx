import { getProductVisual } from '../utils/productVisuals'
import { handleImageError } from '../utils/format'

// Ảnh nhỏ của sản phẩm trong bảng quản lý (có ảnh dự phòng khi lỗi).
function ProductThumb({ product }) {
    if (!product) return null
    const visual = getProductVisual(product)
    const src = product?.imageUrl || visual.image
    return (
        <img
            className="mgmt-thumb"
            src={src}
            alt=""
            loading="lazy"
            onError={handleImageError}
        />
    )
}

export default ProductThumb

