
import { createContext, useContext, useState } from 'react'

const AuthContext = createContext()

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUserState] = useState(() => {
        const savedUser = sessionStorage.getItem('currentUser')

        if (!savedUser) return null

        try {
            return JSON.parse(savedUser)
        } catch {
            sessionStorage.removeItem('currentUser')
            return null
        }
    })

    const setCurrentUser = (user) => {
        setCurrentUserState(user)

        if (user) {
            const safeUser = { ...user }
            delete safeUser.password
            sessionStorage.setItem('currentUser', JSON.stringify(safeUser))
        } else {
            sessionStorage.removeItem('currentUser')
        }
    }

    return (
        <AuthContext.Provider
            value={{
                currentUser,
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
