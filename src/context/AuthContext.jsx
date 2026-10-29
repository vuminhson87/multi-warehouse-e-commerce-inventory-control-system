import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useState,
} from 'react'

import {
    loginApi,
    getCurrentUserApi,
} from '../services/authApi'

const AuthContext = createContext(null)

const TOKEN_KEY = 'mw_access_token'
const USER_KEY = 'currentUser'

export function AuthProvider({ children }) {
    const [token, setToken] = useState(
        () => sessionStorage.getItem(TOKEN_KEY)
    )

    const [currentUser, setCurrentUserState] = useState(() => {
        if (!sessionStorage.getItem(TOKEN_KEY)) return null

        try {
            const value = sessionStorage.getItem(USER_KEY)
            return value ? JSON.parse(value) : null
        } catch {
            return null
        }
    })

    const [verifiedToken, setVerifiedToken] = useState(null)

    const setCurrentUser = useCallback((user) => {
        if (!user) {
            sessionStorage.removeItem(TOKEN_KEY)
            sessionStorage.removeItem(USER_KEY)
            setToken(null)
            setVerifiedToken(null)
            setCurrentUserState(null)
            return
        }

        // Không tạo phiên đăng nhập giả nếu chưa có JWT.
        if (!sessionStorage.getItem(TOKEN_KEY)) {
            throw new Error('Cần đăng nhập bằng Backend API.')
        }

        const safeUser = { ...user }
        delete safeUser.password
        delete safeUser.passwordHash

        sessionStorage.setItem(USER_KEY, JSON.stringify(safeUser))
        setCurrentUserState(safeUser)
    }, [])

    const login = async (username, password) => {
        const data = await loginApi(username, password)

        if (!data?.token || !data?.user) {
            throw new Error(
                'Backend không trả về phiên đăng nhập hợp lệ.'
            )
        }

        const safeUser = { ...data.user }
        delete safeUser.password
        delete safeUser.passwordHash

        sessionStorage.setItem(TOKEN_KEY, data.token)
        sessionStorage.setItem(
            USER_KEY,
            JSON.stringify(safeUser)
        )

        setCurrentUserState(safeUser)
        setVerifiedToken(data.token)
        setToken(data.token)

        return safeUser
    }

    const logout = useCallback(() => setCurrentUser(null), [setCurrentUser])

    useEffect(() => {
        if (!token) {
            return
        }

        let cancelled = false

        getCurrentUserApi(token)
            .then(data => {
                if (!cancelled) {
                    setCurrentUser(data.user)
                }
            })
            .catch((error) => {
                if (cancelled) return
                if (error.status === 401 || error.status === 403) {
                    logout()
                } else {
                    // Mạng hoặc backend tạm lỗi: giữ token, hiển thị cảnh báo
                    // để người dùng thử tải lại; không tự động xóa phiên.
                    console.warn('Không xác thực lại phiên lúc này:', error.code || error.message)
                }
            })
            .finally(() => {
                if (!cancelled) setVerifiedToken(token)
            })

        return () => {
            cancelled = true
        }
    }, [token, logout, setCurrentUser])

    const authLoading = Boolean(token) && verifiedToken !== token

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                token,
                authLoading,
                login,
                logout,
                setCurrentUser,
            }}
        >
            {children}
        </AuthContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
    return useContext(AuthContext)
}
