import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useWishlist } from '../context/WishlistContext'
import { submitContactApi } from '../services/contactApi.js'
import LucideIcon from '../components/LucideIcon'
import './ContactPage.css'

const WAREHOUSE_BRANCHES = [
    {
        code: 'HN',
        region: 'NORTH',
        regionLabel: 'Miền Bắc',
        name: 'Kho BN A/B Mega SOC',
        systemWarehouse: 'Kho Hà Nội',
        address: 'Số 6, Đường số 5, KCN VSIP, Phường Phù Chẩn, TP. Từ Sơn, Tỉnh Bắc Ninh',
        hotline: '1900 6868 (Nhánh 1)',
        hours: '08:00 – 21:00 (Thứ 2 – CN)',
        mapQuery: 'KCN VSIP Từ Sơn Bắc Ninh',
    },
    {
        code: 'DN',
        region: 'CENTRAL',
        regionLabel: 'Miền Trung',
        name: 'Kho Đà Nẵng SOC',
        systemWarehouse: 'Kho Đà Nẵng',
        address: 'Kho VFRACHT, Đường số 8, KCN Hòa Cầm, Phường Hòa Thọ Tây, Quận Cẩm Lệ, TP. Đà Nẵng',
        hotline: '1900 6868 (Nhánh 2)',
        hours: '08:00 – 21:00 (Thứ 2 – CN)',
        mapQuery: 'KCN Hòa Cầm Cẩm Lệ Đà Nẵng',
    },
    {
        code: 'HCM',
        region: 'SOUTH',
        regionLabel: 'Miền Nam',
        name: 'Kho HCM Mega SOC (Củ Chi SOC)',
        systemWarehouse: 'Kho TP. Hồ Chí Minh',
        address: 'Lô KB4_1, KCN Tân Phú Trung, Quốc lộ 22, Ấp Trạm Bơm, Xã Tân Phú Trung, Huyện Củ Chi, TP. Hồ Chí Minh',
        hotline: '1900 6868 (Nhánh 3)',
        hours: '08:00 – 21:00 (Thứ 2 – CN)',
        mapQuery: 'KCN Tân Phú Trung Củ Chi TP Hồ Chí Minh',
    },
]

const SUPPORT_TOPICS = [
    'Tư vấn sản phẩm',
    'Kiểm tra & hỗ trợ đơn hàng',
    'Bảo hành & Đổi trả',
    'Mã giảm giá & Thanh toán',
    'Hợp tác / Khiếu nại khác',
]

const FAQ_ITEMS = [
    {
        q: 'Hệ thống đa kho xử lý đơn hàng như thế nào?',
        a: 'Khi bạn đặt hàng, hệ thống tự động chọn một kho duy nhất trong mạng lưới 3 trung tâm (Miền Bắc, Miền Trung, Miền Nam) có đủ toàn bộ sản phẩm trong giỏ để đóng gói và giao trọn gói, giúp rút ngắn thời gian vận chuyển.',
    },
    {
        q: 'Thời gian giữ chỗ hàng khi chờ thanh toán là bao lâu?',
        a: 'Mỗi đơn hàng ở trạng thái Chờ thanh toán được giữ tồn kho tự động trong 15 phút. Nếu quá thời gian này hoặc thanh toán chưa thành công, hệ thống tự giải phóng tồn kho để phục vụ khách hàng khác; bạn vẫn có thể bấm thử thanh toán lại nếu kho còn hàng.',
    },
    {
        q: 'Khi nào tôi có thể hủy đơn hàng và có được hoàn mã giảm giá không?',
        a: 'Bạn có thể tự hủy đơn khi đơn ở trạng thái Chờ thanh toán hoặc Đã thanh toán (trước khi kho chuyển sang Đang xử lý). Tồn kho và mã giảm giá còn hạn sử dụng sẽ được hệ thống tự động hoàn trả ngay.',
    },
    {
        q: 'Làm sao để nhận và xem lại mã giảm giá vòng quay?',
        a: 'Bạn có thể quay thưởng từ nút vòng quay 7 màu ở góc màn hình hoặc mở Menu trái → Mã giảm giá để xem toàn bộ ví voucher, sao chép mã hoặc bật lại vòng quay nếu lỡ tắt.',
    },
]

function ContactPage() {
    const { currentUser } = useAuth()
    const { showToast } = useWishlist()

    const [regionFilter, setRegionFilter] = useState('ALL')
    const [selectedCode, setSelectedCode] = useState('HCM')
    const [copiedCode, setCopiedCode] = useState('')
    const [openFaqIndex, setOpenFaqIndex] = useState(0)

    const [fullName, setFullName] = useState(() => currentUser?.fullName || '')
    const [email, setEmail] = useState(() => currentUser?.email || '')
    const [phone, setPhone] = useState('')
    const [topic, setTopic] = useState(SUPPORT_TOPICS[0])
    const [warehouseCode, setWarehouseCode] = useState('HCM')
    const [orderCode, setOrderCode] = useState('')
    const [message, setMessage] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [feedback, setFeedback] = useState(null)

    const filteredWarehouses =
        regionFilter === 'ALL'
            ? WAREHOUSE_BRANCHES
            : WAREHOUSE_BRANCHES.filter((w) => w.region === regionFilter)

    const activeWarehouse =
        filteredWarehouses.find((w) => w.code === selectedCode) ||
        filteredWarehouses[0] ||
        WAREHOUSE_BRANCHES[0]

    const mapEmbedUrl = `https://www.google.com/maps?q=${encodeURIComponent(
        activeWarehouse.mapQuery
    )}&output=embed`
    const mapExternalUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        activeWarehouse.address
    )}`

    function handleCopyAddress(e, branch) {
        e.stopPropagation()
        navigator.clipboard?.writeText(branch.address).catch(() => {})
        setCopiedCode(branch.code)
        showToast(`Đã sao chép địa chỉ ${branch.name}`)
        setTimeout(() => {
            setCopiedCode((curr) => (curr === branch.code ? '' : curr))
        }, 1800)
    }

    async function handleSubmit(e) {
        e.preventDefault()
        if (submitting) return

        setFeedback(null)
        setSubmitting(true)
        try {
            const data = await submitContactApi({
                fullName: fullName.trim(),
                email: email.trim(),
                phone: phone.trim(),
                topic,
                warehouseCode,
                orderCode: orderCode.trim(),
                message: message.trim(),
            })

            setFeedback({
                ok: true,
                text: `Đã tiếp nhận yêu cầu hỗ trợ thành công (Mã hồ sơ: ${data.referenceCode}). Đội ngũ CSKH sẽ phản hồi qua email ${email.trim()} trong thời gian sớm nhất.`,
            })
            setOrderCode('')
            setMessage('')
        } catch (err) {
            setFeedback({
                ok: false,
                text: err.message || 'Không thể gửi yêu cầu liên hệ. Vui lòng kiểm tra lại thông tin.',
            })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="contact-page">
            <div className="contact-container">
                <header className="contact-header">
                    <div>
                        <h1>Liên hệ &amp; Hệ thống kho hàng</h1>
                        <p>
                            Mạng lưới 3 trung tâm kho vận Bắc – Trung – Nam cùng đội ngũ chăm sóc khách hàng trực tuyến.
                        </p>
                    </div>
                </header>

                {/* 4 thẻ thông tin hỗ trợ nhanh */}
                <section className="contact-strip" aria-label="Thông tin liên hệ nhanh">
                    <div className="contact-info-card">
                        <span className="contact-info-label">Hotline mua hàng</span>
                        <span className="contact-info-value">1900 6868</span>
                        <span className="contact-info-sub">Nhánh 1 • Miễn phí tư vấn</span>
                    </div>
                    <div className="contact-info-card">
                        <span className="contact-info-label">Bảo hành &amp; Khiếu nại</span>
                        <span className="contact-info-value">1900 6868</span>
                        <span className="contact-info-sub">Nhánh 2 • Hỗ trợ đổi trả</span>
                    </div>
                    <div className="contact-info-card">
                        <span className="contact-info-label">Email hỗ trợ</span>
                        <span className="contact-info-value">multiwarehousesystem@gmail.com</span>
                        <span className="contact-info-sub">Phản hồi trong 30 phút – 2 giờ</span>
                    </div>
                    <div className="contact-info-card">
                        <span className="contact-info-label">Giờ làm việc</span>
                        <span className="contact-info-value">08:00 – 21:00</span>
                        <span className="contact-info-sub">Tất cả các ngày trong tuần</span>
                    </div>
                </section>

                {/* Hệ thống 3 chi nhánh & kho hàng kèm bản đồ */}
                <section className="contact-card">
                    <div className="contact-section-head">
                        <h2 className="contact-section-title">
                            Hệ thống chi nhánh &amp; trung tâm kho hàng (3 khu vực)
                        </h2>
                        <div className="contact-region-tabs" role="tablist">
                            {[
                                { key: 'ALL', label: 'Tất cả (3)' },
                                { key: 'NORTH', label: 'Miền Bắc' },
                                { key: 'CENTRAL', label: 'Miền Trung' },
                                { key: 'SOUTH', label: 'Miền Nam' },
                            ].map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={regionFilter === tab.key}
                                    className={`contact-region-tab${
                                        regionFilter === tab.key ? ' is-active' : ''
                                    }`}
                                    onClick={() => {
                                        setRegionFilter(tab.key)
                                        const first =
                                            tab.key === 'ALL'
                                                ? WAREHOUSE_BRANCHES[0]
                                                : WAREHOUSE_BRANCHES.find((w) => w.region === tab.key)
                                        if (first) setSelectedCode(first.code)
                                    }}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="contact-warehouses-grid">
                        <div className="contact-warehouse-list">
                            {filteredWarehouses.map((branch) => {
                                const isSelected = branch.code === activeWarehouse.code
                                return (
                                    <div
                                        key={branch.code}
                                        role="button"
                                        tabIndex={0}
                                        className={`contact-warehouse-item${
                                            isSelected ? ' is-selected' : ''
                                        }`}
                                        onClick={() => setSelectedCode(branch.code)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                setSelectedCode(branch.code)
                                            }
                                        }}
                                    >
                                        <div className="contact-warehouse-top">
                                            <span className="contact-warehouse-region">
                                                {branch.regionLabel} • Mã {branch.code}
                                            </span>
                                            <span className="contact-warehouse-status">
                                                ● Đang hoạt động
                                            </span>
                                        </div>

                                        <h3 className="contact-warehouse-name">{branch.name}</h3>
                                        <p className="contact-warehouse-address">
                                            {branch.address}
                                        </p>

                                        <div className="contact-warehouse-meta">
                                            <span>Hotline: {branch.hotline}</span>
                                            <span>Giờ mở cửa: {branch.hours}</span>
                                        </div>

                                        <div className="contact-warehouse-actions">
                                            <button
                                                type="button"
                                                className="contact-mini-btn"
                                                onClick={(e) => handleCopyAddress(e, branch)}
                                            >
                                                {copiedCode === branch.code
                                                    ? 'Đã sao chép'
                                                    : 'Sao chép địa chỉ'}
                                            </button>
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                                    branch.address
                                                )}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="contact-mini-btn"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                <LucideIcon name="map-pin" size={14} strokeWidth={1.8} />
                                                <span>Mở Google Maps</span>
                                            </a>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>

                        <div className="contact-map-panel">
                            <div className="contact-map-bar">
                                <span>
                                    Đang xem: <strong>{activeWarehouse.name}</strong>
                                </span>
                                <a
                                    href={mapExternalUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{ color: '#e4e4e7', textDecoration: 'underline', fontSize: '12px' }}
                                >
                                    Chỉ đường ↗
                                </a>
                            </div>
                            <iframe
                                title={`Bản đồ ${activeWarehouse.name}`}
                                src={mapEmbedUrl}
                                className="contact-map-iframe"
                                loading="lazy"
                                referrerPolicy="no-referrer-when-downgrade"
                            />
                        </div>
                    </div>
                </section>

                {/* Form liên hệ gửi email thật + Câu hỏi thường gặp */}
                <div className="contact-bottom-grid">
                    <section className="contact-card">
                        <h2 className="contact-section-title" style={{ marginBottom: '16px' }}>
                            Gửi yêu cầu hỗ trợ trực tuyến
                        </h2>

                        {feedback && (
                            <div
                                role="alert"
                                className={`contact-feedback ${
                                    feedback.ok ? 'contact-feedback--ok' : 'contact-feedback--err'
                                }`}
                            >
                                {feedback.text}
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
                            <div className="contact-form-grid">
                                <div className="contact-field">
                                    <label htmlFor="contact-full-name">
                                        Họ và tên <span>*</span>
                                    </label>
                                    <input
                                        id="contact-full-name"
                                        type="text"
                                        className="contact-input"
                                        placeholder="Nhập họ tên của bạn"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                    />
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-email">
                                        Địa chỉ email <span>*</span>
                                    </label>
                                    <input
                                        id="contact-email"
                                        type="email"
                                        className="contact-input"
                                        placeholder="Ví dụ: abc@gmail.com"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-phone">Số điện thoại</label>
                                    <input
                                        id="contact-phone"
                                        type="tel"
                                        className="contact-input"
                                        placeholder="Ví dụ: 0901 234 567"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                    />
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-topic">
                                        Chủ đề hỗ trợ <span>*</span>
                                    </label>
                                    <select
                                        id="contact-topic"
                                        className="contact-select"
                                        value={topic}
                                        onChange={(e) => setTopic(e.target.value)}
                                    >
                                        {SUPPORT_TOPICS.map((item) => (
                                            <option key={item} value={item}>
                                                {item}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-warehouse">Kho hàng liên quan</label>
                                    <select
                                        id="contact-warehouse"
                                        className="contact-select"
                                        value={warehouseCode}
                                        onChange={(e) => setWarehouseCode(e.target.value)}
                                    >
                                        <option value="">Không chọn cụ thể</option>
                                        {WAREHOUSE_BRANCHES.map((w) => (
                                            <option key={w.code} value={w.code}>
                                                {w.regionLabel} — {w.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div className="contact-field">
                                    <label htmlFor="contact-order-code">Mã đơn hàng (tùy chọn)</label>
                                    <input
                                        id="contact-order-code"
                                        type="text"
                                        className="contact-input"
                                        placeholder="Ví dụ: #51"
                                        value={orderCode}
                                        onChange={(e) => setOrderCode(e.target.value)}
                                    />
                                </div>

                                <div className="contact-field contact-field--full">
                                    <label htmlFor="contact-message">
                                        Nội dung chi tiết <span>*</span>
                                    </label>
                                    <textarea
                                        id="contact-message"
                                        className="contact-textarea"
                                        placeholder="Mô tả chi tiết câu hỏi hoặc vấn đề bạn cần hỗ trợ (tối thiểu 10 ký tự)..."
                                        required
                                        minLength={10}
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="contact-submit-btn"
                                disabled={submitting}
                            >
                                {submitting ? 'Đang gửi yêu cầu...' : 'Gửi yêu cầu hỗ trợ'}
                            </button>
                        </form>
                    </section>

                    <section className="contact-card">
                        <h2 className="contact-section-title" style={{ marginBottom: '16px' }}>
                            Câu hỏi thường gặp
                        </h2>
                        <div className="contact-faq-list">
                            {FAQ_ITEMS.map((item, idx) => {
                                const isOpen = openFaqIndex === idx
                                return (
                                    <div key={item.q} className="contact-faq-item">
                                        <button
                                            type="button"
                                            className="contact-faq-trigger"
                                            aria-expanded={isOpen}
                                            onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                                        >
                                            <span>{item.q}</span>
                                            <span>{isOpen ? '−' : '+'}</span>
                                        </button>
                                        {isOpen && (
                                            <div className="contact-faq-answer">{item.a}</div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    )
}

export default ContactPage
