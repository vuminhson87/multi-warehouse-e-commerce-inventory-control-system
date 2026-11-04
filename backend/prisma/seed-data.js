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
        imageUrl: '/images/products/p1.jpg',
    },
    {
        name: 'Logitech G304',
        category: 'Phụ kiện',
        price: 790000,
        description: 'Chuột gaming không dây Logitech G304.',
        imageUrl: '/images/products/p2.jpg',
    },
    {
        name: 'Keychron K2',
        category: 'Phụ kiện',
        price: 2190000,
        description: 'Bàn phím cơ không dây Keychron K2.',
        imageUrl: '/images/products/p3.jpg',
    },
    {
        name: 'Apple MacBook Pro 16 M3 Max',
        category: 'Laptop',
        price: 79990000,
        description: 'Chip Apple M3 Max 16-core CPU, 40-core GPU, 36GB Unified Memory, màn hình Liquid Retina XDR 120Hz siêu nét.',
        imageUrl: '/images/products/p4.jpg',
    },
    {
        name: 'Apple MacBook Air 13 M3',
        category: 'Laptop',
        price: 27990000,
        description: 'Thiết kế nhôm siêu mỏng nhẹ chỉ 1.24kg, chip Apple M3 8-core CPU và 10-core GPU, thời lượng pin 18 tiếng liên tục.',
        imageUrl: '/images/products/p5.jpg',
    },
    {
        name: 'Dell XPS 13 Plus 9320',
        category: 'Laptop',
        price: 42500000,
        description: 'Màn hình OLED 3.5K viền siêu mỏng InfinityEdge, bàn phím tràn cạnh liền mạch với hàng phím chức năng cảm ứng.',
        imageUrl: '/images/products/p6.jpg',
    },
    {
        name: 'ASUS ROG Zephyrus G14',
        category: 'Laptop',
        price: 48990000,
        description: 'Laptop gaming đỉnh cao mỏng nhẹ, AMD Ryzen 9 8945HS, NVIDIA RTX 4070 8GB, màn hình ROG Nebula OLED 3K 120Hz.',
        imageUrl: '/images/products/p7.jpg',
    },
    {
        name: 'Lenovo ThinkPad X1 Carbon Gen 11',
        category: 'Laptop',
        price: 41900000,
        description: 'Vỏ sợi carbon siêu bền chuẩn quân sự Mỹ, bàn phím gõ êm ái huyền thoại, Intel Core i7 vPro, trọng lượng 1.12kg.',
        imageUrl: '/images/products/p8.jpg',
    },
    {
        name: 'HP Spectre x360 14',
        category: 'Laptop',
        price: 38990000,
        description: 'Laptop xoay gập 2-in-1 cao cấp, màn hình cảm ứng OLED 2.8K 120Hz, kèm bút Stylus cảm ứng lực Bang & Olufsen.',
        imageUrl: '/images/products/p9.jpg',
    },
    {
        name: 'Acer Swift Go 14 AI OLED',
        category: 'Laptop',
        price: 22490000,
        description: 'Trang bị Intel Core Ultra 7 tích hợp nhân NPU xử lý trí tuệ nhân tạo, màn hình OLED 2.8K 90Hz 100% DCI-P3.',
        imageUrl: '/images/products/p10.jpg',
    },
    {
        name: 'MSI Stealth 16 Studio A13V',
        category: 'Laptop',
        price: 52990000,
        description: 'Chứng nhận đồ họa chuyên nghiệp NVIDIA Studio, Intel Core i9-13900H, card rời RTX 4080 tản nhiệt Cooler Boost 5.',
        imageUrl: '/images/products/p11.jpg',
    },
    {
        name: 'LG Gram 17 2024 Pro',
        category: 'Laptop',
        price: 35900000,
        description: 'Màn hình lớn 17 inch WQXGA IPS chống chói nhưng trọng lượng siêu nhẹ 1.35kg, viên pin dung lượng 80Wh.',
        imageUrl: '/images/products/p12.jpg',
    },
    {
        name: 'iPhone 16 Pro Max 256GB',
        category: 'Điện thoại',
        price: 34990000,
        description: 'Khung viền Titan sa mạc đẳng cấp, chip A18 Pro 3nm vượt trội, nút Camera Control thế hệ mới.',
        imageUrl: '/images/products/p13.jpg',
    },
    {
        name: 'iPhone 15 128GB',
        category: 'Điện thoại',
        price: 19490000,
        description: 'Màn hình Dynamic Island hiện đại, mặt lưng kính pha màu mịn lì sang trọng, camera chính 48MP zoom 2x.',
        imageUrl: '/images/products/p14.jpg',
    },
    {
        name: 'Samsung Galaxy S24 Ultra 5G',
        category: 'Điện thoại',
        price: 31990000,
        description: 'Khung viền Titan siêu bền, bút S-Pen tích hợp, công nghệ Galaxy AI hỗ trợ dịch thuật tức thì, camera 200MP.',
        imageUrl: '/images/products/p15.jpg',
    },
    {
        name: 'Samsung Galaxy Z Fold6 5G',
        category: 'Điện thoại',
        price: 41990000,
        description: 'Smartphone gập cao cấp thế hệ mới, mỏng nhẹ vượt bậc, màn hình Dynamic AMOLED 2X 120Hz mở rộng 7.6 inch.',
        imageUrl: '/images/products/p16.jpg',
    },
    {
        name: 'Samsung Galaxy Z Flip6 5G',
        category: 'Điện thoại',
        price: 24990000,
        description: 'Gập vỏ sò thời thượng, màn hình ngoài Flex Window 3.4 inch độc đáo, camera 50MP ProVisual Engine.',
        imageUrl: '/images/products/p17.jpg',
    },
    {
        name: 'Google Pixel 9 Pro 5G',
        category: 'Điện thoại',
        price: 26500000,
        description: 'Trải nghiệm Android thuần khiết mượt mà, chip Tensor G4 cùng AI Gemini xử lý độc quyền, camera chụp đêm đỉnh cao.',
        imageUrl: '/images/products/p18.jpg',
    },
    {
        name: 'Xiaomi 14 Ultra Leica Optics',
        category: 'Điện thoại',
        price: 29990000,
        description: 'Hệ thống 4 camera quang học Leica huyền thoại, cảm biến 1 inch khẩu độ tùy biến f/1.63-f/4.0, quay video 8K.',
        imageUrl: '/images/products/p19.jpg',
    },
    {
        name: 'Xiaomi Redmi Note 13 Pro+ 5G',
        category: 'Điện thoại',
        price: 9490000,
        description: 'Camera chính 200MP chống rung OIS, màn hình AMOLED cong 1.5K 120Hz rực rỡ, sạc siêu tốc 120W HyperCharge.',
        imageUrl: '/images/products/p20.jpg',
    },
    {
        name: 'OPPO Find N3 Flip 5G',
        category: 'Điện thoại',
        price: 21990000,
        description: 'Thiết kế gập cao cấp với cụm 3 camera Hasselblad chuyên nghiệp, bản lề giọt nước tàng hình không nếp gấp.',
        imageUrl: '/images/products/p21.jpg',
    },
    {
        name: 'Sony Xperia 1 VI 5G',
        category: 'Điện thoại',
        price: 32990000,
        description: 'Ống kính tiềm vọng zoom quang học liên tục 85-170mm, cảm biến Exmor T, màn hình LTPO OLED chuẩn rạp chiếu phim.',
        imageUrl: '/images/products/p22.jpg',
    },
    {
        name: 'Logitech MX Master 3S Wireless Mouse',
        category: 'Phụ kiện',
        price: 2450000,
        description: 'Chuột công thái học cao cấp, con lăn điện từ MagSpeed cuộn 1.000 dòng/giây, click êm ái Quiet Click 8000 DPI.',
        imageUrl: '/images/products/p23.jpg',
    },
    {
        name: 'Bàn phím cơ Keychron Q1 Pro Custom',
        category: 'Phụ kiện',
        price: 4890000,
        description: 'Vỏ nhôm CNC nguyên khối anodized tinh xảo, cấu trúc đệm Double Gasket mount gõ đầm ấm, núm xoay đa năng.',
        imageUrl: '/images/products/p24.jpg',
    },
    {
        name: 'Bàn phím cơ Akko MOD007 PC Magnetic',
        category: 'Phụ kiện',
        price: 2790000,
        description: 'Switch từ tính Magnetic Hall Effect hỗ trợ Rapid Trigger độ trễ 0.1mm, hệ thống đèn nền RGB rực rỡ.',
        imageUrl: '/images/products/p25.jpg',
    },
    {
        name: 'Củ sạc nhanh Anker GaNPrime 65W 3 cổng',
        category: 'Phụ kiện',
        price: 990000,
        description: 'Công nghệ bán dẫn GaN thế hệ mới, sạc đồng thời cho Laptop, Điện thoại và Tai nghe nhỏ gọn bỏ túi.',
        imageUrl: '/images/products/p26.jpg',
    },
    {
        name: 'Đế sạc không dây 3-in-1 Belkin MagSafe 15W',
        category: 'Phụ kiện',
        price: 3290000,
        description: 'Đế sạc không dây cao cấp chuẩn MagSafe chính thức từ Apple, sạc nhanh 15W cho iPhone, Apple Watch và AirPods.',
        imageUrl: '/images/products/p27.jpg',
    },
    {
        name: 'Chuột Gaming Razer DeathAdder V3 Pro',
        category: 'Phụ kiện',
        price: 3490000,
        description: 'Trọng lượng siêu nhẹ chỉ 63g, cảm biến quang học Focus Pro 30K DPI, switch quang học Gen 3 độ bền 90 triệu click.',
        imageUrl: '/images/products/p28.jpg',
    },
    {
        name: 'Balo Laptop Tomtoc Slash Premium 16"',
        category: 'Phụ kiện',
        price: 1850000,
        description: 'Chất liệu vải Cordura kháng nước chống xé rách, công nghệ đệm bảo vệ góc máy tính CornerArmor bản quyền chống sốc.',
        imageUrl: '/images/products/p29.jpg',
    },
    {
        name: 'Hub chuyển đổi HyperDrive USB-C 10-in-1 Dual 4K',
        category: 'Phụ kiện',
        price: 2190000,
        description: 'Vỏ nhôm tản nhiệt nguyên khối, mở rộng 2 cổng HDMI 4K 60Hz, sạc pass-through USB-C Power Delivery 100W.',
        imageUrl: '/images/products/p30.jpg',
    },
    {
        name: 'Dell UltraSharp 27 4K USB-C U2723QE',
        category: 'Màn hình',
        price: 14500000,
        description: 'Màn hình IPS Black đầu tiên với tỷ lệ tương phản 2000:1, dải màu rộng 98% DCI-P3, USB-C Hub sạc 90W tiện lợi.',
        imageUrl: '/images/products/p31.jpg',
    },
    {
        name: 'Dell UltraSharp 32 6K Thunderbolt U3224KB',
        category: 'Màn hình',
        price: 58900000,
        description: 'Độ phân giải 6K sắc sảo từng pixel, tích hợp sẵn camera 4K HDR và hệ thống mic lọc tiếng ồn chuẩn phòng họp.',
        imageUrl: '/images/products/p32.jpg',
    },
    {
        name: 'LG UltraGear 27GR95QE-B OLED 240Hz',
        category: 'Màn hình',
        price: 19990000,
        description: 'Tấm nền OLED độ phân giải QHD tần số quét 240Hz, phản hồi siêu tốc 0.03ms cho trải nghiệm gaming đỉnh cao.',
        imageUrl: '/images/products/p33.jpg',
    },
    {
        name: 'LG DualUp 28MQ780 Ergo Stand',
        category: 'Màn hình',
        price: 13900000,
        description: 'Màn hình tỷ lệ độc đáo 16:18 tương đương 2 màn hình 21.5 inch ghép đôi kèm tay nâng công thái học Ergo linh hoạt.',
        imageUrl: '/images/products/p34.jpg',
    },
    {
        name: 'Apple Studio Display 27 5K Retina',
        category: 'Màn hình',
        price: 39990000,
        description: 'Màn hình 5K độ sáng 600 nits với 14.7 triệu điểm ảnh, camera 12MP Center Stage, hệ thống 6 loa âm thanh vòm.',
        imageUrl: '/images/products/p35.jpg',
    },
    {
        name: 'Samsung Odyssey OLED G9 49" Curved 240Hz',
        category: 'Màn hình',
        price: 33990000,
        description: 'Màn hình cong góc nhìn siêu rộng 49 inch tỷ lệ 32:9 DQHD, tần số quét 240Hz 0.03ms với chip xử lý Neo Quantum Pro.',
        imageUrl: '/images/products/p36.jpg',
    },
    {
        name: 'Samsung ViewFinity S9 27" 5K Matte Display',
        category: 'Màn hình',
        price: 24900000,
        description: 'Tấm nền 5K chống chói chuẩn studio, độ bao phủ 99% DCI-P3, tích hợp ứng dụng Smart Calibration cân màu qua điện thoại.',
        imageUrl: '/images/products/p37.jpg',
    },
    {
        name: 'ASUS ProArt PA279CV 27" 4K Professional',
        category: 'Màn hình',
        price: 11900000,
        description: 'Màn hình chuyên biệt cho đồ họa Calman Verified, độ lệch màu Delta E < 2, chuẩn màu 100% sRGB, USB-C 65W.',
        imageUrl: '/images/products/p38.jpg',
    },
    {
        name: 'ViewSonic ColorPro VP2786-4K Studio',
        category: 'Màn hình',
        price: 23500000,
        description: 'Màn hình đồ họa cao cấp đi kèm núm xoay vật lý ColorPro Wheel hiệu chỉnh màu nhanh và tấm chắn sáng chống lóa.',
        imageUrl: '/images/products/p39.jpg',
    },
    {
        name: 'BenQ PD3205U 32" 4K Designer Display',
        category: 'Màn hình',
        price: 18900000,
        description: 'Màn hình 32 inch 4K với tính năng hiển thị màu kép DualView, công tắc KVM chuyển đổi nhanh 2 nguồn máy tính.',
        imageUrl: '/images/products/p40.jpg',
    },
    {
        name: 'Tai nghe chụp tai chống ồn Sony WH-1000XM5',
        category: 'Âm thanh',
        price: 7990000,
        description: 'Khử tiếng ồn đỉnh cao hàng đầu thế giới với vi xử lý kép V1 và QN1, đàm thoại 8 micro trong trẻo, Hi-Res Audio LDAC.',
        imageUrl: '/images/products/p41.jpg',
    },
    {
        name: 'Tai nghe True Wireless Sony WF-1000XM5',
        category: 'Âm thanh',
        price: 5990000,
        description: 'Màng loa Dynamic Driver X tái hiện âm bass trầm ấm và chi tiết cao ngút ngàn, thiết kế nhỏ gọn hơn 25%, pin 24 giờ.',
        imageUrl: '/images/products/p42.jpg',
    },
    {
        name: 'Apple AirPods Max Wireless Headphone',
        category: 'Âm thanh',
        price: 12990000,
        description: 'Chụp tai chế tác từ nhôm nguyên khối, đệm tai vải lưới thoáng khí cao cấp, chế độ chống ồn chủ động ANC và Spatial Audio.',
        imageUrl: '/images/products/p43.jpg',
    },
    {
        name: 'Apple AirPods Pro 2 MagSafe (USB-C)',
        category: 'Âm thanh',
        price: 5690000,
        description: 'Trang bị chip Apple H2 chống ồn chủ động mạnh gấp đôi, tính năng âm thanh thích ứng thích nghi theo môi trường xung quanh.',
        imageUrl: '/images/products/p44.jpg',
    },
    {
        name: 'Loa Bluetooth Marshall Stanmore III',
        category: 'Âm thanh',
        price: 9990000,
        description: 'Huyền thoại âm thanh phong cách rock cổ điển bọc da tinh xảo, củ loa hướng ra ngoài tạo âm trường mở rộng công suất 80W.',
        imageUrl: '/images/products/p45.jpg',
    },
    {
        name: 'Loa Di Động Marshall Emberton II',
        category: 'Âm thanh',
        price: 4290000,
        description: 'Âm thanh đa hướng 360 độ công nghệ True Stereophonic, kháng nước và chống bụi tuyệt đối IP67, pin nghe nhạc 30 giờ.',
        imageUrl: '/images/products/p46.jpg',
    },
    {
        name: 'Loa Bluetooth di động JBL Charge 5',
        category: 'Âm thanh',
        price: 3490000,
        description: 'Âm thanh JBL Original Pro Sound với loa woofer tối ưu âm trầm, pin 7500mAh kiêm chức năng sạc dự phòng cho điện thoại.',
        imageUrl: '/images/products/p47.jpg',
    },
    {
        name: 'Loa Trong Suốt Harman Kardon Aura Studio 4',
        category: 'Âm thanh',
        price: 6890000,
        description: 'Thiết kế vòm trong suốt biểu tượng kết hợp hiệu ứng ánh sáng kim cương đồng điệu, loa siêu trầm 132mm bass uy lực.',
        imageUrl: '/images/products/p48.jpg',
    },
    {
        name: 'Tai nghe Gaming không dây HyperX Cloud III',
        category: 'Âm thanh',
        price: 3890000,
        description: 'Đệm mút hoạt tính bọc da cao cấp êm tai cả ngày dài, củ loa 53mm DTS Headphone:X Spatial Audio, thời lượng pin 120 giờ.',
        imageUrl: '/images/products/p49.jpg',
    },
    {
        name: 'Loa Bluetooth cao cấp B&O Beosound A1 2nd Gen',
        category: 'Âm thanh',
        price: 7490000,
        description: 'Tuyệt tác âm thanh Đan Mạch gia công từ nhôm phay cao cấp, thiết kế mỏng tròn có dây đeo da thật, kháng nước IP67.',
        imageUrl: '/images/products/p50.jpg',
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
