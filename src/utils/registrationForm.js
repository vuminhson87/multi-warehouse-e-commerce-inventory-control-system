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
