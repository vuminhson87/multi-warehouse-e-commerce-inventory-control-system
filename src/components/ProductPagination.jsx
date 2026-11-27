import { Link } from 'react-router-dom'
import LucideIcon from './LucideIcon'
import { getPaginationWindow } from '../utils/pagination'
import './ProductPagination.css'

export default function ProductPagination({
    page,
    totalPages,
    getPageHref,
    onPageChange,
    disabled = false,
    ariaLabel = 'Phân trang sản phẩm',
}) {
    const windowInfo = getPaginationWindow(page, totalPages)
    if (windowInfo.totalPages <= 1) return null

    function renderControl({ key, targetPage, itemAriaLabel, isCurrent = false, isDisabled = false, children }) {
        if (isCurrent) {
            return (
                <span key={key} className="product-pagination-control" aria-current="page">
                    {children}
                </span>
            )
        }

        if (isDisabled || disabled) {
            return (
                <span
                    key={key}
                    className="product-pagination-control"
                    aria-label={itemAriaLabel}
                    aria-disabled="true"
                >
                    {children}
                </span>
            )
        }

        if (typeof getPageHref === 'function') {
            return (
                <Link
                    key={key}
                    className="product-pagination-control"
                    to={getPageHref(targetPage)}
                    aria-label={itemAriaLabel}
                >
                    {children}
                </Link>
            )
        }

        return (
            <button
                key={key}
                type="button"
                className="product-pagination-control"
                onClick={() => onPageChange?.(targetPage)}
                aria-label={itemAriaLabel}
            >
                {children}
            </button>
        )
    }

    return (
        <nav className="product-pagination" aria-label={ariaLabel}>
            {renderControl({
                key: 'prev',
                targetPage: windowInfo.page - 1,
                itemAriaLabel: 'Trang trước',
                isDisabled: !windowInfo.hasPrev,
                children: <LucideIcon name="chevron-left" size={16} strokeWidth={1.9} />,
            })}

            {windowInfo.pages.map((number) =>
                renderControl({
                    key: number,
                    targetPage: number,
                    itemAriaLabel: `Trang ${number}`,
                    isCurrent: number === windowInfo.page,
                    children: number,
                })
            )}

            {renderControl({
                key: 'next',
                targetPage: windowInfo.page + 1,
                itemAriaLabel: 'Trang sau',
                isDisabled: !windowInfo.hasNext,
                children: <LucideIcon name="chevron-right" size={16} strokeWidth={1.9} />,
            })}
        </nav>
    )
}
