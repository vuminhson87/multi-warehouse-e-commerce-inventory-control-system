
export const warehouses = [
    { id: 1, name: 'Kho TP. Hồ Chí Minh' },
    { id: 2, name: 'Kho Hà Nội' },
    { id: 3, name: 'Kho Đà Nẵng' },
]

export const inventory = [
    {
        productId: 1,
        warehouseId: 1,
        onHand: 20,
        reserved: 3,
    },
    {
        productId: 1,
        warehouseId: 2,
        onHand: 15,
        reserved: 2,
    },
    {
        productId: 1,
        warehouseId: 3,
        onHand: 10,
        reserved: 1,
    },
    {
        productId: 2,
        warehouseId: 1,
        onHand: 30,
        reserved: 5,
    },
    {
        productId: 2,
        warehouseId: 2,
        onHand: 25,
        reserved: 3,
    },
    {
        productId: 2,
        warehouseId: 3,
        onHand: 20,
        reserved: 2,
    },
    {
        productId: 3,
        warehouseId: 1,
        onHand: 0,
        reserved: 0,
    },
    {
        productId: 3,
        warehouseId: 2,
        onHand: 0,
        reserved: 0,
    },
    {
        productId: 3,
        warehouseId: 3,
        onHand: 0,
        reserved: 0,
    },
]
