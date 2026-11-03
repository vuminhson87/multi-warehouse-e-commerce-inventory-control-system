import { getProductVisual } from '../utils/productVisuals'
import { handleImageError } from '../utils/format'

// Ảnh nhỏ của sản phẩm trong bảng quản lý (có ảnh dự phòng khi lỗi).
function ProductThumb({ product }) {
    const visual = getProductVisual(product)
    return (
        <img
            className="mgmt-thumb"
            src={visual.image}
            alt=""
            loading="lazy"
            onError={handleImageError}
        />
    )
}

export default ProductThumb

