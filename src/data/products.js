const products = [
    {
        "id": 1,
        "sku": "SKU-0001",
        "name": "Laptop Dell Inspiron 15",
        "category": "Laptop",
        "price": 15990000,
        "description": "Laptop phù hợp cho học tập và làm việc.",
        "imageUrl": "/images/products/p1.jpg",
        "inStock": true
    },
    {
        "id": 2,
        "sku": "SKU-0002",
        "name": "Logitech G304",
        "category": "Phụ kiện",
        "price": 790000,
        "description": "Chuột gaming không dây Logitech G304.",
        "imageUrl": "/images/products/p2.jpg",
        "inStock": true
    },
    {
        "id": 3,
        "sku": "SKU-0003",
        "name": "Keychron K2",
        "category": "Phụ kiện",
        "price": 2190000,
        "description": "Bàn phím cơ không dây Keychron K2.",
        "imageUrl": "/images/products/p3.jpg",
        "inStock": false
    },
    {
        "id": 4,
        "sku": "SKU-0004",
        "name": "Apple MacBook Pro 16 M3 Max",
        "category": "Laptop",
        "price": 79990000,
        "description": "Chip Apple M3 Max 16-core CPU, 40-core GPU, 36GB Unified Memory, màn hình Liquid Retina XDR 120Hz siêu nét.",
        "imageUrl": "/images/products/p4.jpg",
        "inStock": true
    },
    {
        "id": 5,
        "sku": "SKU-0005",
        "name": "Apple MacBook Air 13 M3",
        "category": "Laptop",
        "price": 27990000,
        "description": "Thiết kế nhôm siêu mỏng nhẹ chỉ 1.24kg, chip Apple M3 8-core CPU và 10-core GPU, thời lượng pin 18 tiếng liên tục.",
        "imageUrl": "/images/products/p5.jpg",
        "inStock": true
    },
    {
        "id": 6,
        "sku": "SKU-0006",
        "name": "Dell XPS 13 Plus 9320",
        "category": "Laptop",
        "price": 42500000,
        "description": "Màn hình OLED 3.5K viền siêu mỏng InfinityEdge, bàn phím tràn cạnh liền mạch với hàng phím chức năng cảm ứng.",
        "imageUrl": "/images/products/p6.jpg",
        "inStock": true
    },
    {
        "id": 7,
        "sku": "SKU-0007",
        "name": "ASUS ROG Zephyrus G14",
        "category": "Laptop",
        "price": 48990000,
        "description": "Laptop gaming đỉnh cao mỏng nhẹ, AMD Ryzen 9 8945HS, NVIDIA RTX 4070 8GB, màn hình ROG Nebula OLED 3K 120Hz.",
        "imageUrl": "/images/products/p7.jpg",
        "inStock": true
    },
    {
        "id": 8,
        "sku": "SKU-0008",
        "name": "Lenovo ThinkPad X1 Carbon Gen 11",
        "category": "Laptop",
        "price": 41900000,
        "description": "Vỏ sợi carbon siêu bền chuẩn quân sự Mỹ, bàn phím gõ êm ái huyền thoại, Intel Core i7 vPro, trọng lượng 1.12kg.",
        "imageUrl": "/images/products/p8.jpg",
        "inStock": true
    },
    {
        "id": 9,
        "sku": "SKU-0009",
        "name": "HP Spectre x360 14",
        "category": "Laptop",
        "price": 38990000,
        "description": "Laptop xoay gập 2-in-1 cao cấp, màn hình cảm ứng OLED 2.8K 120Hz, kèm bút Stylus cảm ứng lực Bang & Olufsen.",
        "imageUrl": "/images/products/p9.jpg",
        "inStock": true
    },
    {
        "id": 10,
        "sku": "SKU-0010",
        "name": "Acer Swift Go 14 AI OLED",
        "category": "Laptop",
        "price": 22490000,
        "description": "Trang bị Intel Core Ultra 7 tích hợp nhân NPU xử lý trí tuệ nhân tạo, màn hình OLED 2.8K 90Hz 100% DCI-P3.",
        "imageUrl": "/images/products/p10.jpg",
        "inStock": true
    },
    {
        "id": 11,
        "sku": "SKU-0011",
        "name": "MSI Stealth 16 Studio A13V",
        "category": "Laptop",
        "price": 52990000,
        "description": "Chứng nhận đồ họa chuyên nghiệp NVIDIA Studio, Intel Core i9-13900H, card rời RTX 4080 tản nhiệt Cooler Boost 5.",
        "imageUrl": "/images/products/p11.jpg",
        "inStock": true
    },
    {
        "id": 12,
        "sku": "SKU-0012",
        "name": "LG Gram 17 2024 Pro",
        "category": "Laptop",
        "price": 35900000,
        "description": "Màn hình lớn 17 inch WQXGA IPS chống chói nhưng trọng lượng siêu nhẹ 1.35kg, viên pin dung lượng 80Wh.",
        "imageUrl": "/images/products/p12.jpg",
        "inStock": true
    },
    {
        "id": 13,
        "sku": "SKU-0013",
        "name": "iPhone 16 Pro Max 256GB",
        "category": "Điện thoại",
        "price": 34990000,
        "description": "Khung viền Titan sa mạc đẳng cấp, chip A18 Pro 3nm vượt trội, nút Camera Control thế hệ mới.",
        "imageUrl": "/images/products/p13.jpg",
        "inStock": true
    },
    {
        "id": 14,
        "sku": "SKU-0014",
        "name": "iPhone 15 128GB",
        "category": "Điện thoại",
        "price": 19490000,
        "description": "Màn hình Dynamic Island hiện đại, mặt lưng kính pha màu mịn lì sang trọng, camera chính 48MP zoom 2x.",
        "imageUrl": "/images/products/p14.jpg",
        "inStock": true
    },
    {
        "id": 15,
        "sku": "SKU-0015",
        "name": "Samsung Galaxy S24 Ultra 5G",
        "category": "Điện thoại",
        "price": 31990000,
        "description": "Khung viền Titan siêu bền, bút S-Pen tích hợp, công nghệ Galaxy AI hỗ trợ dịch thuật tức thì, camera 200MP.",
        "imageUrl": "/images/products/p15.jpg",
        "inStock": true
    },
    {
        "id": 16,
        "sku": "SKU-0016",
        "name": "Samsung Galaxy Z Fold6 5G",
        "category": "Điện thoại",
        "price": 41990000,
        "description": "Smartphone gập cao cấp thế hệ mới, mỏng nhẹ vượt bậc, màn hình Dynamic AMOLED 2X 120Hz mở rộng 7.6 inch.",
        "imageUrl": "/images/products/p16.jpg",
        "inStock": true
    },
    {
        "id": 17,
        "sku": "SKU-0017",
        "name": "Samsung Galaxy Z Flip6 5G",
        "category": "Điện thoại",
        "price": 24990000,
        "description": "Gập vỏ sò thời thượng, màn hình ngoài Flex Window 3.4 inch độc đáo, camera 50MP ProVisual Engine.",
        "imageUrl": "/images/products/p17.jpg",
        "inStock": true
    },
    {
        "id": 18,
        "sku": "SKU-0018",
        "name": "Google Pixel 9 Pro 5G",
        "category": "Điện thoại",
        "price": 26500000,
        "description": "Trải nghiệm Android thuần khiết mượt mà, chip Tensor G4 cùng AI Gemini xử lý độc quyền, camera chụp đêm đỉnh cao.",
        "imageUrl": "/images/products/p18.jpg",
        "inStock": true
    },
    {
        "id": 19,
        "sku": "SKU-0019",
        "name": "Xiaomi 14 Ultra Leica Optics",
        "category": "Điện thoại",
        "price": 29990000,
        "description": "Hệ thống 4 camera quang học Leica huyền thoại, cảm biến 1 inch khẩu độ tùy biến f/1.63-f/4.0, quay video 8K.",
        "imageUrl": "/images/products/p19.jpg",
        "inStock": true
    },
    {
        "id": 20,
        "sku": "SKU-0020",
        "name": "Xiaomi Redmi Note 13 Pro+ 5G",
        "category": "Điện thoại",
        "price": 9490000,
        "description": "Camera chính 200MP chống rung OIS, màn hình AMOLED cong 1.5K 120Hz rực rỡ, sạc siêu tốc 120W HyperCharge.",
        "imageUrl": "/images/products/p20.jpg",
        "inStock": true
    },
    {
        "id": 21,
        "sku": "SKU-0021",
        "name": "OPPO Find N3 Flip 5G",
        "category": "Điện thoại",
        "price": 21990000,
        "description": "Thiết kế gập cao cấp với cụm 3 camera Hasselblad chuyên nghiệp, bản lề giọt nước tàng hình không nếp gấp.",
        "imageUrl": "/images/products/p21.jpg",
        "inStock": true
    },
    {
        "id": 22,
        "sku": "SKU-0022",
        "name": "Sony Xperia 1 VI 5G",
        "category": "Điện thoại",
        "price": 32990000,
        "description": "Ống kính tiềm vọng zoom quang học liên tục 85-170mm, cảm biến Exmor T, màn hình LTPO OLED chuẩn rạp chiếu phim.",
        "imageUrl": "/images/products/p22.jpg",
        "inStock": true
    },
    {
        "id": 23,
        "sku": "SKU-0023",
        "name": "Logitech MX Master 3S Wireless Mouse",
        "category": "Phụ kiện",
        "price": 2450000,
        "description": "Chuột công thái học cao cấp, con lăn điện từ MagSpeed cuộn 1.000 dòng/giây, click êm ái Quiet Click 8000 DPI.",
        "imageUrl": "/images/products/p23.jpg",
        "inStock": true
    },
    {
        "id": 24,
        "sku": "SKU-0024",
        "name": "Bàn phím cơ Keychron Q1 Pro Custom",
        "category": "Phụ kiện",
        "price": 4890000,
        "description": "Vỏ nhôm CNC nguyên khối anodized tinh xảo, cấu trúc đệm Double Gasket mount gõ đầm ấm, núm xoay đa năng.",
        "imageUrl": "/images/products/p24.jpg",
        "inStock": true
    },
    {
        "id": 25,
        "sku": "SKU-0025",
        "name": "Bàn phím cơ Akko MOD007 PC Magnetic",
        "category": "Phụ kiện",
        "price": 2790000,
        "description": "Switch từ tính Magnetic Hall Effect hỗ trợ Rapid Trigger độ trễ 0.1mm, hệ thống đèn nền RGB rực rỡ.",
        "imageUrl": "/images/products/p25.jpg",
        "inStock": true
    },
    {
        "id": 26,
        "sku": "SKU-0026",
        "name": "Củ sạc nhanh Anker GaNPrime 65W 3 cổng",
        "category": "Phụ kiện",
        "price": 990000,
        "description": "Công nghệ bán dẫn GaN thế hệ mới, sạc đồng thời cho Laptop, Điện thoại và Tai nghe nhỏ gọn bỏ túi.",
        "imageUrl": "/images/products/p26.jpg",
        "inStock": true
    },
    {
        "id": 27,
        "sku": "SKU-0027",
        "name": "Đế sạc không dây 3-in-1 Belkin MagSafe 15W",
        "category": "Phụ kiện",
        "price": 3290000,
        "description": "Đế sạc không dây cao cấp chuẩn MagSafe chính thức từ Apple, sạc nhanh 15W cho iPhone, Apple Watch và AirPods.",
        "imageUrl": "/images/products/p27.jpg",
        "inStock": true
    },
    {
        "id": 28,
        "sku": "SKU-0028",
        "name": "Chuột Gaming Razer DeathAdder V3 Pro",
        "category": "Phụ kiện",
        "price": 3490000,
        "description": "Trọng lượng siêu nhẹ chỉ 63g, cảm biến quang học Focus Pro 30K DPI, switch quang học Gen 3 độ bền 90 triệu click.",
        "imageUrl": "/images/products/p28.jpg",
        "inStock": true
    },
    {
        "id": 29,
        "sku": "SKU-0029",
        "name": "Balo Laptop Tomtoc Slash Premium 16\"",
        "category": "Phụ kiện",
        "price": 1850000,
        "description": "Chất liệu vải Cordura kháng nước chống xé rách, công nghệ đệm bảo vệ góc máy tính CornerArmor bản quyền chống sốc.",
        "imageUrl": "/images/products/p29.jpg",
        "inStock": true
    },
    {
        "id": 30,
        "sku": "SKU-0030",
        "name": "Hub chuyển đổi HyperDrive USB-C 10-in-1 Dual 4K",
        "category": "Phụ kiện",
        "price": 2190000,
        "description": "Vỏ nhôm tản nhiệt nguyên khối, mở rộng 2 cổng HDMI 4K 60Hz, sạc pass-through USB-C Power Delivery 100W.",
        "imageUrl": "/images/products/p30.jpg",
        "inStock": true
    },
    {
        "id": 31,
        "sku": "SKU-0031",
        "name": "Dell UltraSharp 27 4K USB-C U2723QE",
        "category": "Màn hình",
        "price": 14500000,
        "description": "Màn hình IPS Black đầu tiên với tỷ lệ tương phản 2000:1, dải màu rộng 98% DCI-P3, USB-C Hub sạc 90W tiện lợi.",
        "imageUrl": "/images/products/p31.jpg",
        "inStock": true
    },
    {
        "id": 32,
        "sku": "SKU-0032",
        "name": "Dell UltraSharp 32 6K Thunderbolt U3224KB",
        "category": "Màn hình",
        "price": 58900000,
        "description": "Độ phân giải 6K sắc sảo từng pixel, tích hợp sẵn camera 4K HDR và hệ thống mic lọc tiếng ồn chuẩn phòng họp.",
        "imageUrl": "/images/products/p32.jpg",
        "inStock": true
    },
    {
        "id": 33,
        "sku": "SKU-0033",
        "name": "LG UltraGear 27GR95QE-B OLED 240Hz",
        "category": "Màn hình",
        "price": 19990000,
        "description": "Tấm nền OLED độ phân giải QHD tần số quét 240Hz, phản hồi siêu tốc 0.03ms cho trải nghiệm gaming đỉnh cao.",
        "imageUrl": "/images/products/p33.jpg",
        "inStock": true
    },
    {
        "id": 34,
        "sku": "SKU-0034",
        "name": "LG DualUp 28MQ780 Ergo Stand",
        "category": "Màn hình",
        "price": 13900000,
        "description": "Màn hình tỷ lệ độc đáo 16:18 tương đương 2 màn hình 21.5 inch ghép đôi kèm tay nâng công thái học Ergo linh hoạt.",
        "imageUrl": "/images/products/p34.jpg",
        "inStock": true
    },
    {
        "id": 35,
        "sku": "SKU-0035",
        "name": "Apple Studio Display 27 5K Retina",
        "category": "Màn hình",
        "price": 39990000,
        "description": "Màn hình 5K độ sáng 600 nits với 14.7 triệu điểm ảnh, camera 12MP Center Stage, hệ thống 6 loa âm thanh vòm.",
        "imageUrl": "/images/products/p35.jpg",
        "inStock": true
    },
    {
        "id": 36,
        "sku": "SKU-0036",
        "name": "Samsung Odyssey OLED G9 49\" Curved 240Hz",
        "category": "Màn hình",
        "price": 33990000,
        "description": "Màn hình cong góc nhìn siêu rộng 49 inch tỷ lệ 32:9 DQHD, tần số quét 240Hz 0.03ms với chip xử lý Neo Quantum Pro.",
        "imageUrl": "/images/products/p36.jpg",
        "inStock": true
    },
    {
        "id": 37,
        "sku": "SKU-0037",
        "name": "Samsung ViewFinity S9 27\" 5K Matte Display",
        "category": "Màn hình",
        "price": 24900000,
        "description": "Tấm nền 5K chống chói chuẩn studio, độ bao phủ 99% DCI-P3, tích hợp ứng dụng Smart Calibration cân màu qua điện thoại.",
        "imageUrl": "/images/products/p37.jpg",
        "inStock": true
    },
    {
        "id": 38,
        "sku": "SKU-0038",
        "name": "ASUS ProArt PA279CV 27\" 4K Professional",
        "category": "Màn hình",
        "price": 11900000,
        "description": "Màn hình chuyên biệt cho đồ họa Calman Verified, độ lệch màu Delta E < 2, chuẩn màu 100% sRGB, USB-C 65W.",
        "imageUrl": "/images/products/p38.jpg",
        "inStock": true
    },
    {
        "id": 39,
        "sku": "SKU-0039",
        "name": "ViewSonic ColorPro VP2786-4K Studio",
        "category": "Màn hình",
        "price": 23500000,
        "description": "Màn hình đồ họa cao cấp đi kèm núm xoay vật lý ColorPro Wheel hiệu chỉnh màu nhanh và tấm chắn sáng chống lóa.",
        "imageUrl": "/images/products/p39.jpg",
        "inStock": true
    },
    {
        "id": 40,
        "sku": "SKU-0040",
        "name": "BenQ PD3205U 32\" 4K Designer Display",
        "category": "Màn hình",
        "price": 18900000,
        "description": "Màn hình 32 inch 4K với tính năng hiển thị màu kép DualView, công tắc KVM chuyển đổi nhanh 2 nguồn máy tính.",
        "imageUrl": "/images/products/p40.jpg",
        "inStock": true
    },
    {
        "id": 41,
        "sku": "SKU-0041",
        "name": "Tai nghe chụp tai chống ồn Sony WH-1000XM5",
        "category": "Âm thanh",
        "price": 7990000,
        "description": "Khử tiếng ồn đỉnh cao hàng đầu thế giới với vi xử lý kép V1 và QN1, đàm thoại 8 micro trong trẻo, Hi-Res Audio LDAC.",
        "imageUrl": "/images/products/p41.jpg",
        "inStock": true
    },
    {
        "id": 42,
        "sku": "SKU-0042",
        "name": "Tai nghe True Wireless Sony WF-1000XM5",
        "category": "Âm thanh",
        "price": 5990000,
        "description": "Màng loa Dynamic Driver X tái hiện âm bass trầm ấm và chi tiết cao ngút ngàn, thiết kế nhỏ gọn hơn 25%, pin 24 giờ.",
        "imageUrl": "/images/products/p42.jpg",
        "inStock": true
    },
    {
        "id": 43,
        "sku": "SKU-0043",
        "name": "Apple AirPods Max Wireless Headphone",
        "category": "Âm thanh",
        "price": 12990000,
        "description": "Chụp tai chế tác từ nhôm nguyên khối, đệm tai vải lưới thoáng khí cao cấp, chế độ chống ồn chủ động ANC và Spatial Audio.",
        "imageUrl": "/images/products/p43.jpg",
        "inStock": true
    },
    {
        "id": 44,
        "sku": "SKU-0044",
        "name": "Apple AirPods Pro 2 MagSafe (USB-C)",
        "category": "Âm thanh",
        "price": 5690000,
        "description": "Trang bị chip Apple H2 chống ồn chủ động mạnh gấp đôi, tính năng âm thanh thích ứng thích nghi theo môi trường xung quanh.",
        "imageUrl": "/images/products/p44.jpg",
        "inStock": true
    },
    {
        "id": 45,
        "sku": "SKU-0045",
        "name": "Loa Bluetooth Marshall Stanmore III",
        "category": "Âm thanh",
        "price": 9990000,
        "description": "Huyền thoại âm thanh phong cách rock cổ điển bọc da tinh xảo, củ loa hướng ra ngoài tạo âm trường mở rộng công suất 80W.",
        "imageUrl": "/images/products/p45.jpg",
        "inStock": true
    },
    {
        "id": 46,
        "sku": "SKU-0046",
        "name": "Loa Di Động Marshall Emberton II",
        "category": "Âm thanh",
        "price": 4290000,
        "description": "Âm thanh đa hướng 360 độ công nghệ True Stereophonic, kháng nước và chống bụi tuyệt đối IP67, pin nghe nhạc 30 giờ.",
        "imageUrl": "/images/products/p46.jpg",
        "inStock": true
    },
    {
        "id": 47,
        "sku": "SKU-0047",
        "name": "Loa Bluetooth di động JBL Charge 5",
        "category": "Âm thanh",
        "price": 3490000,
        "description": "Âm thanh JBL Original Pro Sound với loa woofer tối ưu âm trầm, pin 7500mAh kiêm chức năng sạc dự phòng cho điện thoại.",
        "imageUrl": "/images/products/p47.jpg",
        "inStock": true
    },
    {
        "id": 48,
        "sku": "SKU-0048",
        "name": "Loa Trong Suốt Harman Kardon Aura Studio 4",
        "category": "Âm thanh",
        "price": 6890000,
        "description": "Thiết kế vòm trong suốt biểu tượng kết hợp hiệu ứng ánh sáng kim cương đồng điệu, loa siêu trầm 132mm bass uy lực.",
        "imageUrl": "/images/products/p48.jpg",
        "inStock": true
    },
    {
        "id": 49,
        "sku": "SKU-0049",
        "name": "Tai nghe Gaming không dây HyperX Cloud III",
        "category": "Âm thanh",
        "price": 3890000,
        "description": "Đệm mút hoạt tính bọc da cao cấp êm tai cả ngày dài, củ loa 53mm DTS Headphone:X Spatial Audio, thời lượng pin 120 giờ.",
        "imageUrl": "/images/products/p49.jpg",
        "inStock": true
    },
    {
        "id": 50,
        "sku": "SKU-0050",
        "name": "Loa Bluetooth cao cấp B&O Beosound A1 2nd Gen",
        "category": "Âm thanh",
        "price": 7490000,
        "description": "Tuyệt tác âm thanh Đan Mạch gia công từ nhôm phay cao cấp, thiết kế mỏng tròn có dây đeo da thật, kháng nước IP67.",
        "imageUrl": "/images/products/p50.jpg",
        "inStock": true
    }
]

export default products
