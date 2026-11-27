import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
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
    const currentUserRef = useRef(currentUser)
    const tokenRef = useRef(token)
    const refreshPromiseRef = useRef(null)

    useEffect(() => {
        currentUserRef.current = currentUser
    }, [currentUser])

    useEffect(() => {
        tokenRef.current = token
    }, [token])

    const setCurrentUser = useCallback((user) => {
        if (!user) {
            sessionStorage.removeItem(TOKEN_KEY)
            sessionStorage.removeItem(USER_KEY)
            refreshPromiseRef.current = null
            setToken(null)
            setVerifiedToken(null)
            setCurrentUserState(null)
            return
        }

        // Không tạo phiên đăng nhập giả nếu chưa có JWT.
        if (!sessionStorage.getItem(TOKEN_KEY)) {
            throw new Error('Vui lòng đăng nhập qua hệ thống.')
        }

        const safeUser = { ...user }
        delete safeUser.password
        delete safeUser.passwordHash

        sessionStorage.setItem(USER_KEY, JSON.stringify(safeUser))
        setCurrentUserState(safeUser)
    }, [])

    const syncSafeUser = useCallback((user) => {
        if (!user || !sessionStorage.getItem(TOKEN_KEY)) return
        const safeUser = { ...user }
        delete safeUser.password
        delete safeUser.passwordHash

        const previous = currentUserRef.current
        const unchanged =
            previous &&
            previous.id === safeUser.id &&
            previous.username === safeUser.username &&
            previous.fullName === safeUser.fullName &&
            previous.role === safeUser.role &&
            previous.assignedWarehouseId === safeUser.assignedWarehouseId &&
            previous.isActive === safeUser.isActive

        if (!unchanged) {
            setCurrentUser(safeUser)
        }
    }, [setCurrentUser])

    const login = async (username, password) => {
        const data = await loginApi(username, password)

        if (!data?.token || !data?.user) {
            throw new Error(
                'Hệ thống không trả về phiên đăng nhập hợp lệ.'
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

    const refreshCurrentUser = useCallback(() => {
        const requestToken = tokenRef.current
        if (!requestToken) return Promise.resolve(null)
        if (refreshPromiseRef.current) return refreshPromiseRef.current

        const promise = getCurrentUserApi(requestToken)
            .then((data) => {
                if (tokenRef.current !== requestToken) return null
                if (data?.user) {
                    syncSafeUser(data.user)
                    return data.user
                }
                return null
            })
            .catch((error) => {
                if (tokenRef.current !== requestToken) return null
                if (error.status === 401 || error.status === 403) {
                    logout()
                } else {
                    console.warn('Không xác thực lại phiên lúc này:', error.code || error.message)
                }
                return null
            })
            .finally(() => {
                if (refreshPromiseRef.current === promise) {
                    refreshPromiseRef.current = null
                }
            })

        refreshPromiseRef.current = promise
        return promise
    }, [logout, syncSafeUser])

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

    useEffect(() => {
        if (!token) return undefined

        const handleFocus = () => {
            void refreshCurrentUser()
        }
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') {
                void refreshCurrentUser()
            }
        }

        window.addEventListener('focus', handleFocus)
        document.addEventListener('visibilitychange', handleVisibility)

        return () => {
            window.removeEventListener('focus', handleFocus)
            document.removeEventListener('visibilitychange', handleVisibility)
        }
    }, [token, refreshCurrentUser])

    const authLoading = Boolean(token) && verifiedToken !== token

    return (
        <AuthContext.Provider
            value={{
                currentUser,
                token,
                authLoading,
                login,
                logout,
                refreshCurrentUser,
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
