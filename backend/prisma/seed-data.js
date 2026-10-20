// M3 - Nguyễn Anh Quân: Dữ liệu seed thuần (không truy cập DB) để dễ unit test.
// Quy mô kiểm thử theo SRS: 100–300 sản phẩm, 3 kho (NFR-PER-04, T21).
// 3 sản phẩm đầu và 6 tài khoản demo khớp với mock của frontend (src/data/*.js)
// để M1 chuyển từ mock sang API mà không đổi id.

export const SEED_WAREHOUSES = Object.freeze([
    { id: 1, code: 'HCM', name: 'Kho TP. Hồ Chí Minh', address: 'TP. Hồ Chí Minh' },
    { id: 2, code: 'HN', name: 'Kho Hà Nội', address: 'Hà Nội' },
    { id: 3, code: 'DN', name: 'Kho Đà Nẵng', address: 'Đà Nẵng' },
])

// Mật khẩu chỉ dùng cho môi trường demo; seed sẽ hash bằng bcrypt trước khi ghi DB (NFR-SEC-01).
export const SEED_USERS = Object.freeze([
    { id: 1, username: 'customer', fullName: 'Khách hàng Demo', role: 'CUSTOMER', assignedWarehouseId: null },
    { id: 2, username: 'warehouse', fullName: 'Quản lý kho HCM', role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 1 },
    { id: 3, username: 'admin', fullName: 'Quản trị viên', role: 'ADMIN', assignedWarehouseId: null },
    { id: 4, username: 'customer2', fullName: 'Khách hàng Demo 2', role: 'CUSTOMER', assignedWarehouseId: null },
    { id: 5, username: 'warehouse2', fullName: 'Quản lý kho Hà Nội', role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 2 },
    { id: 6, username: 'warehouse3', fullName: 'Quản lý kho Đà Nẵng', role: 'WAREHOUSE_MANAGER', assignedWarehouseId: 3 },
])

const BASE_PRODUCTS = [
    {
        name: 'Laptop Dell Inspiron 15',
        category: 'Laptop',
        price: 15990000,
        description: 'Laptop phù hợp cho học tập và làm việc.',
    },
    {
        name: 'Logitech G304',
        category: 'Phụ kiện',
        price: 790000,
        description: 'Chuột gaming không dây Logitech G304.',
    },
    {
        name: 'Keychron K2',
        category: 'Phụ kiện',
        price: 2190000,
        description: 'Bàn phím cơ không dây Keychron K2.',
    },
]

const GENERATED_CATALOG = [
    { category: 'Laptop', brands: ['Asus', 'Acer', 'Lenovo', 'HP', 'MSI'], basePrice: 12000000 },
    { category: 'Điện thoại', brands: ['Samsung', 'Xiaomi', 'Oppo', 'Vivo', 'Realme'], basePrice: 4000000 },
    { category: 'Phụ kiện', brands: ['Logitech', 'Razer', 'Corsair', 'Rapoo', 'Akko'], basePrice: 300000 },
    { category: 'Màn hình', brands: ['LG', 'Dell', 'ViewSonic', 'AOC', 'Samsung'], basePrice: 3000000 },
    { category: 'Âm thanh', brands: ['Sony', 'JBL', 'Edifier', 'Soundcore', 'Marshall'], basePrice: 800000 },
]

// Bộ sinh số giả ngẫu nhiên có seed cố định để mỗi lần seed ra cùng dữ liệu (dễ tái lập kết quả test).
function createRng(seed) {
    let state = seed >>> 0

    return () => {
        state = (state * 1664525 + 1013904223) >>> 0
        return state / 0x100000000
    }
}

export function buildProducts(total = 120) {
    if (!Number.isInteger(total) || total < BASE_PRODUCTS.length || total > 300) {
        throw new Error(`Số sản phẩm seed phải từ ${BASE_PRODUCTS.length} đến 300, nhận được: ${total}`)
    }

    const rng = createRng(310)
    const products = BASE_PRODUCTS.map((product, index) => ({
        id: index + 1,
        sku: `SKU-${String(index + 1).padStart(4, '0')}`,
        isActive: true,
        ...product,
    }))

    for (let id = products.length + 1; id <= total; id += 1) {
        const group = GENERATED_CATALOG[id % GENERATED_CATALOG.length]
        const brand = group.brands[Math.floor(rng() * group.brands.length)]
        // Giá làm tròn tới 10.000đ.
        const price = Math.round((group.basePrice * (1 + rng() * 2)) / 10000) * 10000

        products.push({
            id,
            sku: `SKU-${String(id).padStart(4, '0')}`,
            name: `${group.category} ${brand} M${id}`,
            category: group.category,
            price,
            description: `${group.category} ${brand} mẫu M${id} dùng cho dữ liệu kiểm thử.`,
            // Một số sản phẩm ngừng kinh doanh để kiểm thử SR-CAT-01 / SR-PROD-03.
            isActive: id % 40 !== 0,
        })
    }

    return products
}

// Tồn kho cho mọi cặp (kho, sản phẩm). reserved = 0 khi seed: hàng giữ chỉ phát sinh từ đơn thật,
// tránh tạo reserved "mồ côi" không gắn StockReservation nào.
export function buildInventories(products, warehouses = SEED_WAREHOUSES) {
    const rng = createRng(52400310)
    const rows = []

    // Khớp mock frontend: sản phẩm 1, 2 có hàng; sản phẩm 3 (Keychron K2) hết hàng ở mọi kho.
    const fixedOnHand = {
        1: { 1: 20, 2: 15, 3: 10 },
        2: { 1: 30, 2: 25, 3: 20 },
        3: { 1: 0, 2: 0, 3: 0 },
    }

    for (const product of products) {
        for (const warehouse of warehouses) {
            const fixed = fixedOnHand[product.id]?.[warehouse.id]
            const onHand = fixed ?? Math.floor(rng() * 60)

            rows.push({
                warehouseId: warehouse.id,
                productId: product.id,
                onHand,
                reserved: 0,
                lowStockThreshold: 5,
            })
        }
    }

    return rows
}
