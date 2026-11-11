import { Link } from 'react-router-dom'
import './ProductPagination.css'

export default function ProductPagination({
    page,
    totalPages,
    getPageHref,
    ariaLabel = 'Phân trang sản phẩm',
}) {
    if (totalPages <= 1) return null

    const windowSize = Math.min(5, totalPages)
    const firstPage = Math.max(1, Math.min(page - 2, totalPages - windowSize + 1))
    const pages = Array.from({ length: windowSize }, (_, index) => firstPage + index)

    return (
        <nav className="product-pagination" aria-label={ariaLabel}>
            {page > 1 ? (
                <Link className="product-pagination-control" to={getPageHref(page - 1)}>
                    Trước
                </Link>
            ) : (
                <span className="product-pagination-control" aria-disabled="true">Trước</span>
            )}

            {pages.map((number) =>
                number === page ? (
                    <span key={number} className="product-pagination-control" aria-current="page">
                        {number}
                    </span>
                ) : (
                    <Link
                        key={number}
                        className="product-pagination-control"
                        to={getPageHref(number)}
                        aria-label={`Trang ${number}`}
                    >
                        {number}
                    </Link>
                )
            )}

            {page < totalPages ? (
                <Link className="product-pagination-control" to={getPageHref(page + 1)}>
                    Sau
                </Link>
            ) : (
                <span className="product-pagination-control" aria-disabled="true">Sau</span>
            )}
        </nav>
    )
}

