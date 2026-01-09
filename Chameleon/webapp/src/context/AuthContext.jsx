// Auth Context
// Manages authentication state and user type

const { createContext, useContext, useState, useEffect, useCallback } = require('react');
const api = require('../api/client');

const AuthContext = createContext(null);

function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [system, setSystem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [userType, setUserType] = useState(null);
    const [error, setError] = useState(null);

    const checkAuth = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const token = localStorage.getItem('systemiser_token');
            if (!token) {
                setLoading(false);
                return;
            }

            const data = await api.getMe();
            setUser(data.user);
            setSystem(data.system);
            setUserType(data.userType);
        } catch (err) {
            console.error('Auth check failed:', err);

            if (err.status === 401) {
                api.setToken(null);
            }

            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const login = () => {
        window.location.href = '/api/auth/discord';
    };

    const logout = async () => {
        try {
            await api.logout();
        } catch (err) {
            console.error('Logout error:', err);
        } finally {
            api.setToken(null);
            setUser(null);
            setSystem(null);
            setUserType(null);
        }
    };

    const handleAuthCallback = async (token) => {
        api.setToken(token);
        await checkAuth();
    };

    const updateSystem = (newSystem) => {
        setSystem(newSystem);

        if (newSystem?.sys_type?.isSystem) {
            setUserType('system');
        } else if (newSystem?.sys_type?.isFragmented) {
            setUserType('fractured');
        } else {
            setUserType('basic');
        }
    };

    const value = {
        user,
        system,
        userType,
        loading,
        error,
        login,
        logout,
        handleAuthCallback,
        refreshAuth: checkAuth,
        updateSystem,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

module.exports = {
    AuthProvider,
    useAuth,
    default: AuthContext
};