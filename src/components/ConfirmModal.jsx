import { useEffect, useId, useRef } from 'react'
import LucideIcon from './LucideIcon'

/**
 * Hộp thoại xác nhận cơ bản theo tông màu tối giản của ứng dụng.
 */
function ConfirmModal({
    open,
    title,
    message,
    confirmLabel = 'Xác nhận',
    cancelLabel = 'Hủy',
    pending = false,
    onConfirm,
    onCancel,
}) {
    const titleId = useId()
    const descId = useId()
    const cancelBtnRef = useRef(null)
    const pendingRef = useRef(pending)
    const onCancelRef = useRef(onCancel)

    useEffect(() => {
        pendingRef.current = pending
    }, [pending])

    useEffect(() => {
        onCancelRef.current = onCancel
    }, [onCancel])

    useEffect(() => {
        if (!open) return undefined

        const previousActive = document.activeElement
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        cancelBtnRef.current?.focus()

        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && !pendingRef.current) {
                onCancelRef.current?.()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = previousOverflow
            if (previousActive && typeof previousActive.focus === 'function') {
                previousActive.focus()
            }
        }
    }, [open])

    if (!open) return null

    return (
        <div
            className="mgmt-modal-overlay"
            onMouseDown={(event) => {
                if (event.target === event.currentTarget && !pending) {
                    onCancel?.()
                }
            }}
        >
            <div
                className="mgmt-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
            >
                <div className="mgmt-modal__head">
                    <h2 id={titleId} className="mgmt-modal__title">
                        {title}
                    </h2>
                    <button
                        type="button"
                        className="icon-btn mgmt-modal__close"
                        onClick={onCancel}
                        disabled={pending}
                        aria-label="Đóng hộp thoại"
                    >
                        <LucideIcon name="x" size={18} strokeWidth={1.75} />
                    </button>
                </div>

                <div id={descId} className="mgmt-modal__body">
                    {message}
                </div>

                <div className="mgmt-modal__actions">
                    <button
                        ref={cancelBtnRef}
                        type="button"
                        className="mgmt-btn mgmt-btn--ghost"
                        disabled={pending}
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>
                    <button
                        type="button"
                        className="mgmt-btn mgmt-btn--primary"
                        disabled={pending}
                        onClick={onConfirm}
                    >
                        {pending ? 'Đang xử lý…' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default ConfirmModal
