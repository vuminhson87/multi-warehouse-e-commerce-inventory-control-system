import nodemailer from 'nodemailer'

let cachedTransporter = null
let cachedSignature = null

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

export function readSmtpConfig(env = globalThis.process?.env ?? {}) {
    const host = (env.SMTP_HOST ?? 'smtp.gmail.com').trim()
    const port = Number(env.SMTP_PORT ?? 465)
    const user = (env.SMTP_USER ?? '').trim()
    // Tự xóa khoảng trắng nếu dán trực tiếp chuỗi 16 ký tự Google App Password (vd: "abcd efgh ijkl mnop").
    const pass = (env.SMTP_PASS ?? '').replace(/\s+/g, '')
    const from = (env.SMTP_FROM ?? '').trim() || user

    return {
        host,
        port: Number.isInteger(port) && port > 0 ? port : 465,
        user,
        pass,
        from,
        configured: Boolean(host && user && pass),
    }
}

export function logMailerMode(logger = console, env = globalThis.process?.env ?? {}) {
    const config = readSmtpConfig(env)
    if (config.configured) {
        logger?.info?.(`[OTP Mailer] Đang bật gửi Gmail thật qua ${config.host}:${config.port} (${config.user})`)
    } else {
        logger?.info?.('[OTP Mailer] Chưa điền SMTP_USER/SMTP_PASS trong backend/.env — tạm in mã OTP ra terminal backend.')
    }
    return config
}

function getTransporter(config) {
    const signature = `${config.host}:${config.port}:${config.user}:${config.pass}`
    if (cachedTransporter && cachedSignature === signature) {
        return cachedTransporter
    }

    cachedTransporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        secure: config.port === 465,
        auth: {
            user: config.user,
            pass: config.pass,
        },
    })
    cachedSignature = signature
    return cachedTransporter
}

export async function sendRegistrationOtpEmail({
    to,
    username,
    code,
    ttlSeconds = 180,
    env = globalThis.process?.env ?? {},
    logger = console,
}) {
    const config = readSmtpConfig(env)
    const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60))

    if (!config.configured) {
        logger?.info?.(
            `[DEV OTP] Gmail SMTP chưa cấu hình | Email: ${to} | Username: ${username} | Mã OTP: ${code} (hiệu lực ${ttlSeconds}s)`
        )
        return { delivery: 'dev-console' }
    }

    const transporter = getTransporter(config)
    const subject = `[Multi-Warehouse] Mã xác thực đăng ký tài khoản: ${code}`
    const text = [
        'Xin chào,',
        '',
        `Bạn đang đăng ký tài khoản Multi-Warehouse với tên đăng nhập: ${username}`,
        `Mã xác thực OTP 6 chữ số của bạn là: ${code}`,
        `Mã có hiệu lực trong ${ttlMinutes} phút.`,
        '',
        'Nếu bạn không thực hiện yêu cầu này, vui lòng bỏ qua email này.',
    ].join('\n')

    const safeUsernameHtml = escapeHtml(username)
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; background: #ffffff; color: #18181b;">
            <p style="margin: 0 0 12px; font-size: 12px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #52525b;">MULTI-WAREHOUSE</p>
            <h2 style="margin: 0 0 12px; font-size: 20px;">Xác thực đăng ký tài khoản</h2>
            <p style="margin: 0 0 16px; line-height: 1.6; color: #3f3f46;">
                Tên đăng nhập dự kiến: <strong>${safeUsernameHtml}</strong>
            </p>
            <div style="margin: 20px 0; padding: 18px; text-align: center; background: #f4f1ec; border: 1px solid #d4d4d8;">
                <div style="font-size: 12px; color: #71717a; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.08em;">Mã xác thực OTP</div>
                <div style="font-size: 32px; font-weight: 700; letter-spacing: 0.28em; color: #09090b;">${code}</div>
            </div>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #52525b;">
                Mã có hiệu lực trong <strong>${ttlMinutes} phút</strong>. Tuyệt đối không chia sẻ mã này cho bất kỳ ai.
            </p>
        </div>
    `

    await transporter.sendMail({
        from: `"Multi-Warehouse" <${config.from}>`,
        to,
        subject,
        text,
        html,
    })

    return { delivery: 'email' }
}
