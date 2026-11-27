import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useProducts } from '../context/ProductContext'
import { formatPrice, handleImageError } from '../utils/format'
import { getProductVisual } from '../utils/productVisuals'
import { searchProductSuggestions } from '../utils/productSearch'
import LucideIcon from './LucideIcon'
import './ProductSearchInput.css'

/**
 * Ô tìm kiếm kèm danh sách gợi ý sản phẩm gần đúng theo từ khóa khách hàng nhập.
 */
function ProductSearchInput({
    value,
    onChange,
    onSubmitQuery,
    onSelectProduct,
    placeholder = 'Tìm kiếm sản phẩm...',
    ariaLabel = 'Tìm kiếm sản phẩm',
    inputName,
    autoFocus = false,
    className = '',
    iconSize = 18,
    iconClassName = '',
    trailingAction = null,
}) {
    const { products } = useProducts()
    const navigate = useNavigate()
    const listboxId = useId()
    const containerRef = useRef(null)
    const [focused, setFocused] = useState(false)
    const [dismissedQuery, setDismissedQuery] = useState(null)
    const [highlightedIndex, setHighlightedIndex] = useState(-1)

    const trimmedQuery = value.trim()
    const suggestions = useMemo(
        () => searchProductSuggestions(products, trimmedQuery, 7),
        [products, trimmedQuery]
    )

    const isOpen =
        focused &&
        trimmedQuery.length > 0 &&
        dismissedQuery !== trimmedQuery

    const activeIndex =
        isOpen && highlightedIndex >= 0 && highlightedIndex < suggestions.length
            ? highlightedIndex
            : -1

    useEffect(() => {
        if (!isOpen) return undefined

        const handleOutsideMouseDown = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setFocused(false)
            }
        }

        document.addEventListener('mousedown', handleOutsideMouseDown)
        return () => document.removeEventListener('mousedown', handleOutsideMouseDown)
    }, [isOpen])

    function handleSelectSuggestion(product) {
        setFocused(false)
        setHighlightedIndex(-1)
        if (onSelectProduct) {
            onSelectProduct(product)
        } else {
            navigate(`/products/${product.id}`)
        }
    }

    function handleFormSubmit(event) {
        event.preventDefault()
        if (activeIndex >= 0 && suggestions[activeIndex]) {
            handleSelectSuggestion(suggestions[activeIndex])
            return
        }
        setDismissedQuery(trimmedQuery)
        setHighlightedIndex(-1)
        onSubmitQuery?.(trimmedQuery)
    }

    function handleKeyDown(event) {
        if (!isOpen) {
            if (event.key === 'ArrowDown' && trimmedQuery.length > 0) {
                setDismissedQuery(null)
                setHighlightedIndex(0)
            }
            return
        }

        if (event.key === 'ArrowDown') {
            if (suggestions.length === 0) return
            event.preventDefault()
            setHighlightedIndex((prev) =>
                prev < suggestions.length - 1 ? prev + 1 : 0
            )
        } else if (event.key === 'ArrowUp') {
            if (suggestions.length === 0) return
            event.preventDefault()
            setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : suggestions.length - 1
            )
        } else if (event.key === 'Escape') {
            setDismissedQuery(trimmedQuery)
            setHighlightedIndex(-1)
        }
    }

    return (
        <form
            ref={containerRef}
            className={`ps-search ${className}`}
            onSubmit={handleFormSubmit}
            role="search"
        >
            <LucideIcon
                name="search"
                size={iconSize}
                className={iconClassName || 'ps-search__icon'}
            />
            <input
                type="search"
                name={inputName}
                value={value}
                autoFocus={autoFocus}
                autoComplete="off"
                placeholder={placeholder}
                aria-label={ariaLabel}
                role="combobox"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                aria-controls={isOpen ? listboxId : undefined}
                aria-activedescendant={
                    activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
                }
                onFocus={() => setFocused(true)}
                onChange={(event) => {
                    setFocused(true)
                    setDismissedQuery(null)
                    setHighlightedIndex(-1)
                    onChange(event.target.value)
                }}
                onKeyDown={handleKeyDown}
            />
            {trailingAction}

            {isOpen && (
                <div
                    id={listboxId}
                    role="listbox"
                    aria-label="Gợi ý sản phẩm"
                    className="ps-dropdown"
                >
                    <div className="ps-dropdown__header">
                        Gợi ý sản phẩm phù hợp
                    </div>

                    {suggestions.length === 0 ? (
                        <div className="ps-dropdown__empty">
                            Không tìm thấy sản phẩm gần giống với &ldquo;{trimmedQuery}&rdquo;.
                        </div>
                    ) : (
                        <>
                            <ul className="ps-dropdown__list">
                                {suggestions.map((product, index) => {
                                    const visual = getProductVisual(product)
                                    const isActive = index === activeIndex
                                    return (
                                        <li
                                            key={product.id}
                                            id={`${listboxId}-opt-${index}`}
                                            role="option"
                                            aria-selected={isActive}
                                            className={`ps-dropdown__item ${
                                                isActive ? 'is-active' : ''
                                            }`}
                                            onMouseEnter={() => setHighlightedIndex(index)}
                                            onMouseDown={(event) => event.preventDefault()}
                                            onClick={() => handleSelectSuggestion(product)}
                                        >
                                            <img
                                                src={visual.image}
                                                alt=""
                                                className="ps-dropdown__thumb"
                                                onError={handleImageError}
                                            />
                                            <span className="ps-dropdown__info">
                                                <strong className="ps-dropdown__name">
                                                    {product.name}
                                                </strong>
                                                <small className="ps-dropdown__category">
                                                    {product.category}
                                                </small>
                                            </span>
                                            <span className="ps-dropdown__price">
                                                {formatPrice(product.price)}
                                            </span>
                                        </li>
                                    )
                                })}
                            </ul>

                            <button
                                type="button"
                                className="ps-dropdown__footer"
                                onMouseDown={(event) => event.preventDefault()}
                                onClick={() => {
                                    setDismissedQuery(trimmedQuery)
                                    setHighlightedIndex(-1)
                                    onSubmitQuery?.(trimmedQuery)
                                }}
                            >
                                <span>
                                    Xem tất cả kết quả cho &ldquo;{trimmedQuery}&rdquo;
                                </span>
                                <LucideIcon name="arrow-right" size={14} />
                            </button>
                        </>
                    )}
                </div>
            )}
        </form>
    )
}

export default ProductSearchInput
