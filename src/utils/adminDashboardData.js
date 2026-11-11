const WAREHOUSE_COLORS = ['#2f6fed', '#2fa866', '#f08a3c', '#9b8cf0', '#e0b341']

export function summarizeDashboardInventory(inventory) {
    const totalOnHand = inventory.reduce((sum, item) => sum + Number(item.onHand ?? 0), 0)
    const totalReserved = inventory.reduce((sum, item) => sum + Number(item.reserved ?? 0), 0)

    return {
        totalOnHand,
        totalReserved,
        totalAvailable: totalOnHand - totalReserved,
    }
}

export function buildWarehouseDistribution(warehouses, inventory) {
    const rows = warehouses.map((warehouse, index) => ({
        warehouse,
        color: WAREHOUSE_COLORS[index % WAREHOUSE_COLORS.length],
        onHand: inventory
            .filter(item => Number(item.warehouseId) === Number(warehouse.id))
            .reduce((sum, item) => sum + Number(item.onHand ?? 0), 0),
    }))
    const total = rows.reduce((sum, row) => sum + row.onHand, 0)
    const { stops } = rows
        .filter(row => row.onHand > 0)
        .reduce(
            (acc, row) => {
                const start = acc.cursor
                const nextCursor = start + (row.onHand / total) * 100
                return {
                    cursor: nextCursor,
                    stops: [...acc.stops, `${row.color} ${start}% ${nextCursor}%`],
                }
            },
            { cursor: 0, stops: [] }
        )

    return {
        total,
        rows: rows.map(row => ({
            ...row,
            percent: total > 0 ? Math.round((row.onHand / total) * 100) : 0,
        })),
        gradient: stops.length ? `conic-gradient(${stops.join(', ')})` : null,
    }
}
