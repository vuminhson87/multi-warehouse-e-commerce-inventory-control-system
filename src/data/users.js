// Danh sách tài khoản demo phục vụ kiểm thử phân quyền, tách giỏ hàng, tách đơn hàng và phân công kho
const users = [
    {
        id: 1,
        username: 'customer',
        password: '123456',
        role: 'CUSTOMER',
    },
    {
        id: 2,
        username: 'warehouse',
        password: '123456',
        role: 'WAREHOUSE_MANAGER',
        warehouseId: 1,
    },
    {
        id: 3,
        username: 'admin',
        password: '123456',
        role: 'ADMIN',
    },
    {
        id: 4,
        username: 'customer2',
        password: '123456',
        role: 'CUSTOMER',
    },
    {
        id: 5,
        username: 'warehouse2',
        password: '123456',
        role: 'WAREHOUSE_MANAGER',
        warehouseId: 2,
    },
    {
        id: 6,
        username: 'warehouse3',
        password: '123456',
        role: 'WAREHOUSE_MANAGER',
        warehouseId: 3,
    },
]

export default users