const GMAIL_REGEX = /^[a-z0-9](?:[a-z0-9.+_-]{0,62}[a-z0-9])?@gmail\.com$/
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,50}$/

export function deriveUsernameFromGmail(rawEmail) {
    if (typeof rawEmail !== 'string') return ''
    const trimmed = rawEmail.trim().toLowerCase()
    const atIndex = trimmed.indexOf('@')
    if (atIndex <= 0) {
        return trimmed
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/_+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 50)
    }

    return trimmed
        .slice(0, atIndex)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 50)
}

export function prepareRegistration({ username, fullName, password, confirmPassword }) {
    if (password !== confirmPassword) {
        return { error: 'Mật khẩu xác nhận không khớp.', payload: null }
    }

    return {
        error: null,
        payload: {
            username: username.trim(),
            fullName: fullName.trim(),
            password,
        },
    }
}

export function prepareOtpRegistrationRequest({
    email,
    username,
    fullName,
    password,
    confirmPassword,
}) {
    const normalizedEmail = String(email ?? '').trim().toLowerCase()
    if (!normalizedEmail || normalizedEmail.length > 120 || !GMAIL_REGEX.test(normalizedEmail)) {
        return {
            error: 'Vui lòng nhập địa chỉ Gmail hợp lệ (kết thúc bằng @gmail.com).',
            payload: null,
        }
    }

    const chosenUsername =
        String(username ?? '').trim() || deriveUsernameFromGmail(normalizedEmail)
    if (!USERNAME_REGEX.test(chosenUsername)) {
        return {
            error: 'Tên đăng nhập phải dài 3–50 ký tự, chỉ gồm chữ, số hoặc dấu gạch dưới.',
            payload: null,
        }
    }

    if (typeof password !== 'string' || password.length < 8) {
        return { error: 'Mật khẩu phải có ít nhất 8 ký tự.', payload: null }
    }

    if (password !== confirmPassword) {
        return { error: 'Mật khẩu xác nhận không khớp.', payload: null }
    }

    return {
        error: null,
        payload: {
            email: normalizedEmail,
            username: chosenUsername,
            fullName: String(fullName ?? '').trim(),
            password,
        },
    }
}

export function prepareOtpVerification(otp) {
    const clean = String(otp ?? '').trim()
    if (!/^\d{6}$/.test(clean)) {
        return { error: 'Vui lòng nhập đủ 6 chữ số mã OTP.', otp: null }
    }
    return { error: null, otp: clean }
}

export function formatCountdown(seconds) {
    const safe = Math.max(0, Math.floor(Number(seconds) || 0))
    const mins = Math.floor(safe / 60)
    const secs = safe % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}
