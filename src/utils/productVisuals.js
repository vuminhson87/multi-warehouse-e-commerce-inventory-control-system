// Ánh xạ hình ảnh studio tối giản & khung trưng bày kiểu Atelier / House of Spoils
// cho danh mục sản phẩm thực tế của hệ thống Multi-Warehouse E-Commerce.

const SPECIFIC_PRODUCT_VISUALS = {
    1: {
        subtitle: 'Dell Workstation Series • 15.6"',
        image: 'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=800&q=85',
        lifestyleImg: 'https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=1400&q=85',
        tag: 'BÁN CHẠY SỐ 1 TUẦN QUA',
        headline: 'Đánh thức hiệu năng làm việc & sáng tạo nguyên bản',
        campaignCategory: 'KHÔNG GIAN LÀM VIỆC TỐI GIẢN',
        campaignHeadline: 'HIỆU NĂNG ĐỈNH CAO TRONG THIẾT KẾ NHÔM NGUYÊN KHỐI TINH KHIẾT',
        aspect: 'landscape',
        framed: true,
    },
    2: {
        subtitle: 'Logitech Studio Wireless • Lightspeed',
        image: 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?auto=format&fit=crop&w=800&q=85',
        lifestyleImg: 'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=1400&q=85',
        tag: 'PHỤ KIỆN ĐƯỢC YÊU THÍCH NHẤT',
        headline: 'Độ chính xác tuyệt đối không độ trễ cho mọi thao tác',
        campaignCategory: 'THIẾT BỊ NGOẠI VI CHUẨN STUDIO',
        campaignHeadline: 'SỰ KẾT HỢP HOÀN HẢO GIỮA HÌNH KHỐI TỐI GIẢN VÀ CẢM GIÁC CẦM NẮM',
        aspect: 'square',
        framed: false,
    },
    3: {
        subtitle: 'Keychron Mechanical • Tactile Edition',
        image: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=800&q=85',
        lifestyleImg: 'https://images.unsplash.com/photo-1511467687858-23d96c32e4ae?auto=format&fit=crop&w=1400&q=85',
        tag: 'PHIÊN BẢN CƠ HỌC TỐI GIẢN',
        headline: 'Âm hưởng gõ phím cơ học tinh tế trong từng điểm chạm',
        campaignCategory: 'NGHỆ THUẬT BÀN LÀM VIỆC',
        campaignHeadline: 'CHẾ TÁC TỈ MỈ TỪ KEYCAP PBT ĐẾN KHUNG NHÔM VUÔNG GÓC CỔ ĐIỂN',
        aspect: 'landscape',
        framed: true,
    },
}

const CATEGORY_FALLBACK_VISUALS = {
    Laptop: [
        {
            subtitle: 'Ultrabook Flagship Edition',
            image: 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1486312338219-ce68d2c6f44d?auto=format&fit=crop&w=1400&q=85',
            aspect: 'landscape',
            framed: true,
        },
        {
            subtitle: 'Pro Studio Workstation',
            image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=1400&q=85',
            aspect: 'portrait',
            framed: true,
        },
    ],
    'Phụ kiện': [
        {
            subtitle: 'Minimalist Desk Accessory',
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1400&q=85',
            aspect: 'square',
            framed: false,
        },
        {
            subtitle: 'Studio Craft Edition',
            image: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1400&q=85',
            aspect: 'portrait',
            framed: true,
        },
    ],
    'Điện thoại': [
        {
            subtitle: 'Flagship Mobile Series',
            image: 'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?auto=format&fit=crop&w=1400&q=85',
            aspect: 'portrait',
            framed: true,
        },
    ],
    'Màn hình': [
        {
            subtitle: '4K Color-Accurate Display',
            image: 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1547082299-de196ea013d6?auto=format&fit=crop&w=1400&q=85',
            aspect: 'landscape',
            framed: true,
        },
    ],
    'Âm thanh': [
        {
            subtitle: 'Acoustics Reference Edition',
            image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=85',
            lifestyleImg: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=1400&q=85',
            aspect: 'square',
            framed: false,
        },
    ],
}

const DEFAULT_FALLBACK = {
    subtitle: 'Atelier Curated Edition',
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=85',
    lifestyleImg: 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=1400&q=85',
    aspect: 'square',
    framed: true,
}

export function getProductVisual(product) {
    if (!product) return DEFAULT_FALLBACK

    const numId = Number(product.id)
    if (SPECIFIC_PRODUCT_VISUALS[numId]) {
        return SPECIFIC_PRODUCT_VISUALS[numId]
    }

    const categoryList = CATEGORY_FALLBACK_VISUALS[product.category]
    if (categoryList && categoryList.length > 0) {
        const picked = categoryList[numId % categoryList.length]
        return {
            ...picked,
            subtitle: `${product.category} • ${picked.subtitle}`,
        }
    }

    return {
        ...DEFAULT_FALLBACK,
        subtitle: `${product.category || 'Bộ sưu tập'} • Chính hãng`,
    }
}

export function buildHeroSlides(products = []) {
    const active = products.filter((p) => (p.status ?? 'ACTIVE') === 'ACTIVE')
    const source = active.length > 0 ? active.slice(0, 4) : products.slice(0, 4)

    if (source.length === 0) {
        return [
            {
                id: 1,
                tag: 'TIÊU ĐIỂM HỆ THỐNG ĐA KHO',
                subtitle: 'Multi-Warehouse Flagship Collection',
                title: 'Trải nghiệm mua sắm công nghệ tối giản & chuẩn xác',
                productImg: DEFAULT_FALLBACK.image,
                lifestyleImg: DEFAULT_FALLBACK.lifestyleImg,
                campaignCategory: 'MULTI-WAREHOUSE E-COMMERCE',
                campaignHeadline: 'ĐỒNG BỘ TỒN KHO THỜI GIAN THỰC TẠI TP.HCM, HÀ NỘI & ĐÀ NẴNG',
            },
        ]
    }

    return source.map((product, index) => {
        const visual = getProductVisual(product)
        return {
            id: product.id,
            tag:
                visual.tag ||
                (index === 0
                    ? 'BÁN CHẠY SỐ 1 TUẦN QUA'
                    : index === 1
                      ? 'SẢN PHẨM NỔI BẬT'
                      : 'PHIÊN BẢN TUYỂN CHỌN'),
            subtitle: `${product.name} — ${visual.subtitle}`,
            title:
                visual.headline ||
                product.description ||
                'Thiết kế tối giản & hoàn thiện cao cấp cho không gian hiện đại',
            productImg: visual.image,
            lifestyleImg: visual.lifestyleImg,
            campaignCategory:
                visual.campaignCategory ||
                `BỘ SƯU TẬP ${String(product.category || 'CÔNG NGHỆ').toUpperCase()}`,
            campaignHeadline:
                visual.campaignHeadline ||
                'PHÂN BỔ TỒN KHO TỰ ĐỘNG TỪ KHO GẦN NHẤT ĐẢM BẢO GIAO HÀNG NHANH CHÓNG',
        }
    })
}
