import crypto from 'node:crypto'
import { runInTransaction } from '../../db/transaction.js'
import { sendRegistrationOtpEmail } from '../../services/mailer.js'
import { AppError, ErrorCodes, validationError } from '../../shared/errors.js'
import { createCustomerAccount } from './user.repository.js'

export const OTP_RESEND_COOLDOWN_SECONDS = 60
export const OTP_MAX_SEND_PER_HOUR = 5
export const OTP_MAX_VERIFY_ATTEMPTS = 5
const DEFAULT_OTP_TTL_SECONDS = 180
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/
const GMAIL_REGEX = /^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@gmail\.com$/

export function getOtpTtlSeconds(env = globalThis.process?.env ?? {}) {
    const raw = env.OTP_TTL_SECONDS
    if (raw !== undefined && /^[1-9]\d*$/.test(String(raw))) {
        const value = Number(raw)
        if (Number.isSafeInteger(value) && value <= 1800) {
            return value
        }
    }
    return DEFAULT_OTP_TTL_SECONDS
}

export function normalizeGmail(rawEmail) {
    if (typeof rawEmail !== 'string') {
        return ''
    }
    return rawEmail.trim().toLowerCase()
}

export function deriveDefaultUsernameFromGmail(rawEmail) {
    const email = normalizeGmail(rawEmail)
    const atIndex = email.indexOf('@')
    if (atIndex <= 0) return ''

    const localPart = email.slice(0, atIndex)
    const sanitized = localPart
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50)

    return sanitized
}

function getOtpHmacSecret() {
    return process.env.JWT_SECRET || 'mw-dev-registration-otp-secret'
}

export function hashOtpCode({ email, code }) {
    return crypto
        .createHmac('sha256', getOtpHmacSecret())
        .update(`${normalizeGmail(email)}:${String(code).trim()}`)
        .digest('hex')
}

export function verifyOtpHash({ email, code, expectedHash }) {
    if (typeof expectedHash !== 'string' || !expectedHash) return false
    const actualHex = hashOtpCode({ email, code })
    const actualBuf = Buffer.from(actualHex, 'hex')
    const expectedBuf = Buffer.from(expectedHash, 'hex')
    if (actualBuf.length !== expectedBuf.length) return false
    return crypto.timingSafeEqual(actualBuf, expectedBuf)
}

export function generateSixDigitOtp() {
    return String(crypto.randomInt(100000, 1000000))
}

function validateRegistrationFields(body, { requireOtp = false } = {}) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw validationError([{ field: 'body', reason: 'Dữ liệu đăng ký không hợp lệ.' }])
    }

    const allowedFields = requireOtp
        ? ['email', 'username', 'password', 'fullName', 'otp']
        : ['email', 'username', 'password', 'fullName']
    const details = []

    if (Object.keys(body).some((key) => !allowedFields.includes(key))) {
        details.push({
            field: 'body',
            reason: `Chỉ chấp nhận các trường: ${allowedFields.join(', ')}.`,
        })
    }

    const email = normalizeGmail(body.email)
    if (!email || email.length > 120 || !GMAIL_REGEX.test(email)) {
        details.push({
            field: 'email',
            reason: 'Vui lòng nhập địa chỉ Gmail hợp lệ (kết thúc bằng @gmail.com).',
        })
    }

    const rawUsername =
        typeof body.username === 'string' && body.username.trim()
            ? body.username.trim()
            : deriveDefaultUsernameFromGmail(email)

    if (!USERNAME_REGEX.test(rawUsername)) {
        details.push({
            field: 'username',
            reason: 'Tên đăng nhập phải dài 3–50 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.',
        })
    }

    const password = body.password
    if (
        typeof password !== 'string' ||
        password.length < 8 ||
        Buffer.byteLength(password, 'utf8') > 72
    ) {
        details.push({
            field: 'password',
            reason: 'Mật khẩu phải có ít nhất 8 ký tự và tối đa 72 byte UTF-8.',
        })
    }

    let fullName = null
    if (body.fullName !== undefined && body.fullName !== null && body.fullName !== '') {
        if (
            typeof body.fullName !== 'string' ||
            !body.fullName.trim() ||
            body.fullName.trim().length > 120
        ) {
            details.push({
                field: 'fullName',
                reason: 'Họ tên phải có từ 1 đến 120 ký tự.',
            })
        } else {
            fullName = body.fullName.trim()
        }
    }

    let otp
    if (requireOtp) {
        otp = typeof body.otp === 'string' ? body.otp.trim() : String(body.otp ?? '').trim()
        if (!/^\d{6}$/.test(otp)) {
            details.push({
                field: 'otp',
                reason: 'Mã xác thực OTP phải gồm đúng 6 chữ số.',
            })
        }
    }

    if (details.length > 0) {
        throw validationError(details)
    }

    return {
        email,
        username: rawUsername,
        password,
        fullName,
        ...(requireOtp ? { otp } : {}),
    }
}

async function assertEmailAndUsernameAvailable(client, { email, username }) {
    const [existingByUsername, existingByEmail] = await Promise.all([
        client.user.findUnique({ where: { username }, select: { id: true } }),
        typeof client.user.findFirst === 'function'
            ? client.user.findFirst({ where: { email }, select: { id: true } })
            : client.user.findUnique({ where: { email }, select: { id: true } }),
    ])

    if (existingByUsername) {
        throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Tên đăng nhập đã được sử dụng.')
    }

    if (existingByEmail) {
        throw new AppError(ErrorCodes.ACCOUNT_EXISTS, 'Địa chỉ Gmail này đã được đăng ký.')
    }
}

export async function requestRegistrationOtp(
    client,
    body,
    { now = new Date(), sendMail = sendRegistrationOtpEmail } = {}
) {
    const input = validateRegistrationFields(body, { requireOtp: false })
    await assertEmailAndUsernameAvailable(client, input)

    const ttlSeconds = getOtpTtlSeconds()
    const oneHourAgo = new Date(now.getTime() - 3600 * 1000)

    const [latestOtp, hourlySendCount] = await Promise.all([
        client.registrationOtp.findFirst({
            where: { email: input.email },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        }),
        client.registrationOtp.count({
            where: {
                email: input.email,
                createdAt: { gte: oneHourAgo },
            },
        }),
    ])

    if (hourlySendCount >= OTP_MAX_SEND_PER_HOUR) {
        throw new AppError(
            ErrorCodes.TOO_MANY_REQUESTS,
            'Bạn đã yêu cầu gửi mã OTP quá 5 lần trong 1 giờ. Vui lòng thử lại sau.'
        )
    }

    if (latestOtp && !latestOtp.consumedAt) {
        const elapsedMs = now.getTime() - latestOtp.createdAt.getTime()
        const cooldownMs = OTP_RESEND_COOLDOWN_SECONDS * 1000
        if (elapsedMs < cooldownMs) {
            const waitSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000)
            throw new AppError(
                ErrorCodes.TOO_MANY_REQUESTS,
                `Vui lòng chờ ${waitSeconds} giây trước khi gửi lại mã OTP mới.`
            )
        }
    }

    const code = generateSixDigitOtp()
    const codeHash = hashOtpCode({ email: input.email, code })
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1000)

    await client.registrationOtp.updateMany({
        where: { email: input.email, consumedAt: null },
        data: { consumedAt: now },
    })

    const otpRecord = await client.registrationOtp.create({
        data: {
            email: input.email,
            codeHash,
            expiresAt,
            createdAt: now,
        },
    })

    let mailResult
    try {
        mailResult = await sendMail({
            to: input.email,
            username: input.username,
            code,
            ttlSeconds,
        })
    } catch (error) {
        await client.registrationOtp.update({
            where: { id: otpRecord.id },
            data: { consumedAt: now },
        })
        if (error instanceof AppError) {
            throw error
        }
        console.error('Lỗi gửi email OTP:', error)
        throw new AppError(
            ErrorCodes.TEMPORARY_CONFLICT,
            'Không thể gửi email xác thực lúc này. Vui lòng kiểm tra cấu hình Gmail SMTP hoặc thử lại sau.'
        )
    }

    return {
        email: input.email,
        username: input.username,
        expiresInSeconds: ttlSeconds,
        cooldownSeconds: OTP_RESEND_COOLDOWN_SECONDS,
        delivery: mailResult?.delivery ?? 'email',
    }
}

export async function verifyRegistrationOtpAndCreateUser(
    client,
    body,
    { now = new Date(), runTx = runInTransaction } = {}
) {
    const input = validateRegistrationFields(body, { requireOtp: true })

    const txOutcome = await runTx(async (tx) => {
        const latestRows = await tx.$queryRaw`
            SELECT id, code_hash AS "codeHash", expires_at AS "expiresAt",
                   consumed_at AS "consumedAt", attempts
            FROM registration_otps
            WHERE email = ${input.email}
              AND consumed_at IS NULL
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            FOR UPDATE
        `

        const otpRecord = latestRows[0]
        if (!otpRecord) {
            return {
                status: 'NOT_FOUND',
            }
        }

        if (new Date(otpRecord.expiresAt).getTime() <= now.getTime()) {
            await tx.registrationOtp.update({
                where: { id: otpRecord.id },
                data: { consumedAt: now },
            })
            return { status: 'EXPIRED' }
        }

        if (otpRecord.attempts >= OTP_MAX_VERIFY_ATTEMPTS) {
            await tx.registrationOtp.update({
                where: { id: otpRecord.id },
                data: { consumedAt: now },
            })
            return { status: 'TOO_MANY_ATTEMPTS' }
        }

        const matched = verifyOtpHash({
            email: input.email,
            code: input.otp,
            expectedHash: otpRecord.codeHash,
        })

        if (!matched) {
            const nextAttempts = otpRecord.attempts + 1
            const exhausted = nextAttempts >= OTP_MAX_VERIFY_ATTEMPTS
            await tx.registrationOtp.update({
                where: { id: otpRecord.id },
                data: {
                    attempts: nextAttempts,
                    ...(exhausted ? { consumedAt: now } : {}),
                },
            })
            return {
                status: exhausted ? 'TOO_MANY_ATTEMPTS' : 'INVALID_OTP',
                remainingAttempts: Math.max(0, OTP_MAX_VERIFY_ATTEMPTS - nextAttempts),
            }
        }

        await assertEmailAndUsernameAvailable(tx, input)

        await tx.registrationOtp.update({
            where: { id: otpRecord.id },
            data: { consumedAt: now },
        })

        const user = await createCustomerAccount(tx, {
            username: input.username,
            password: input.password,
            fullName: input.fullName,
            email: input.email,
            emailVerifiedAt: now,
        })

        return { status: 'VERIFIED', user }
    })

    if (txOutcome.status === 'NOT_FOUND') {
        throw validationError([
            {
                field: 'otp',
                reason: 'Mã xác thực không tồn tại hoặc đã được sử dụng. Vui lòng gửi lại mã mới.',
            },
        ])
    }

    if (txOutcome.status === 'EXPIRED') {
        throw validationError([
            {
                field: 'otp',
                reason: 'Mã xác thực đã hết hạn (quá 3 phút). Vui lòng bấm gửi lại mã mới.',
            },
        ])
    }

    if (txOutcome.status === 'TOO_MANY_ATTEMPTS') {
        throw validationError([
            {
                field: 'otp',
                reason: 'Bạn đã nhập sai mã OTP quá 5 lần. Vui lòng yêu cầu gửi lại mã mới.',
            },
        ])
    }

    if (txOutcome.status === 'INVALID_OTP') {
        throw validationError([
            {
                field: 'otp',
                reason: `Mã OTP không chính xác. Còn ${txOutcome.remainingAttempts} lần thử.`,
            },
        ])
    }

    return { user: txOutcome.user }
}
