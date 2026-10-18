// Cấu hình nghiệp vụ tập trung một nơi (contract mục 3.4, 5.1, 7.4).
// Muốn đổi thời gian giữ hàng, timeout, giới hạn số lượng... chỉ sửa ở đây hoặc qua biến môi trường.

function readPositiveInt(env, name, defaultValue) {
    const raw = env[name]

    if (raw === undefined || raw === '') {
        return defaultValue
    }

    if (!/^[1-9]\d*$/.test(String(raw))) {
        throw new Error(`Biến môi trường ${name} phải là số nguyên dương, nhận được: "${raw}"`)
    }

    const value = Number(raw)

    if (!Number.isSafeInteger(value)) {
        throw new Error(`Biến môi trường ${name} vượt quá giới hạn số nguyên an toàn, nhận được: "${raw}"`)
    }

    return value
}

function readBoolean(env, name, defaultValue) {
    const raw = env[name]

    if (raw === undefined || raw === '') {
        return defaultValue
    }

    if (raw === 'true') return true
    if (raw === 'false') return false

    throw new Error(`Biến môi trường ${name} phải là "true" hoặc "false", nhận được: "${raw}"`)
}

export function loadBusinessConfig(env = globalThis.process?.env ?? {}) {
    const config = Object.freeze({
        // Thời gian giữ hàng tối đa cho đơn chưa thanh toán xong.
        reservationTtlMinutes: readPositiveInt(env, 'RESERVATION_TTL_MINUTES', 15),
        // Chu kỳ job thu hồi hàng giữ hết hạn.
        expiryJobIntervalSeconds: readPositiveInt(env, 'EXPIRY_JOB_INTERVAL_SECONDS', 60),
        // Hạn chờ phản hồi của mock gateway.
        gatewayTimeoutMs: readPositiveInt(env, 'GATEWAY_TIMEOUT_MS', 10000),
        // Chỉ khi bật mới nhận trường "simulate" từ client.
        demoMode: readBoolean(env, 'DEMO_MODE', false),
        // Giới hạn đầu vào checkout.
        maxItemsPerOrder: readPositiveInt(env, 'MAX_ITEMS_PER_ORDER', 50),
        maxQuantityPerProduct: readPositiveInt(env, 'MAX_QUANTITY_PER_PRODUCT', 100),
        // Phân trang danh sách đơn.
        defaultPageSize: readPositiveInt(env, 'DEFAULT_PAGE_SIZE', 10),
        maxPageSize: readPositiveInt(env, 'MAX_PAGE_SIZE', 50),
        // Số lần thử lại tối đa khi transaction xung đột tạm thời.
        maxTransactionRetries: readPositiveInt(env, 'MAX_TRANSACTION_RETRIES', 3),
        // Số attempt thanh toán tối đa trả trong chi tiết đơn.
        maxPaymentsInOrderDetail: readPositiveInt(env, 'MAX_PAYMENTS_IN_ORDER_DETAIL', 20),
    })

    if (config.defaultPageSize > config.maxPageSize) {
        throw new Error(
            `Cấu hình không hợp lệ: defaultPageSize (${config.defaultPageSize}) không được lớn hơn maxPageSize (${config.maxPageSize})`
        )
    }

    return config
}

const businessConfig = loadBusinessConfig()

export default businessConfig
