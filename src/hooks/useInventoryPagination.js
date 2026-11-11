import { useEffect } from 'react'

export const INVENTORY_PAGE_SIZE = 10

export function readInventoryPage(rawPage) {
    if (!/^[1-9]\d*$/.test(rawPage ?? '')) return 1

    const page = Number(rawPage)
    return Number.isSafeInteger(page) ? page : 1
}

export function getInventoryPage(totalRows, rawPage) {
    const totalPages = Math.ceil(totalRows / INVENTORY_PAGE_SIZE)
    const page = Math.min(readInventoryPage(rawPage), Math.max(1, totalPages))
    const start = (page - 1) * INVENTORY_PAGE_SIZE

    return { page, totalPages, start, end: start + INVENTORY_PAGE_SIZE }
}

export function getInventoryPageHref(searchParams, pageKey, page) {
    const params = new URLSearchParams(searchParams)
    params.set(pageKey, String(page))

    return { search: `?${params.toString()}` }
}

export function useNormalizeInventoryPages(searchParams, setSearchParams, pages, enabled) {
    const next = new URLSearchParams(searchParams)

    for (const [pageKey, page] of Object.entries(pages)) {
        if (next.has(pageKey) && next.get(pageKey) !== String(page)) {
            next.set(pageKey, String(page))
        }
    }

    const currentSearch = searchParams.toString()
    const nextSearch = next.toString()

    useEffect(() => {
        if (enabled && nextSearch !== currentSearch) {
            setSearchParams(new URLSearchParams(nextSearch), { replace: true })
        }
    }, [currentSearch, enabled, nextSearch, setSearchParams])
}

