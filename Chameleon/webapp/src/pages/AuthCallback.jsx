// Auth Callback Page
// Handles the OAuth callback from Discord

const { useEffect, useState } = require('react');

const { useNavigate, useSearchParams } = require('react-router-dom');
const { useAuth } = require('../context/AuthContext');

function AuthCallback() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { handleAuthCallback } = useAuth();
    const [error, setError] = useState(null);

    useEffect(() => {
        const processCallback = async () => {
            const token = searchParams.get('token');
            const errorParam = searchParams.get('error');

            if (errorParam) {
                setError('Authentication failed. Please try again.');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            if (!token) {
                setError('No token received. Please try logging in again.');
                setTimeout(() => navigate('/'), 3000);
                return;
            }

            try {
                await handleAuthCallback(token);
                navigate('/app');
            } catch (err) {
                console.error('Auth callback error:', err);
                setError('Failed to complete login. Please try again.');
                setTimeout(() => navigate('/'), 3000);
            }
        };

        processCallback();
    }, [searchParams, handleAuthCallback, navigate]);

    if (error) {
        return (
            <div className="auth-callback-page error">
                <div className="callback-content">
                    <span className="error-icon">❌</span>
                    <h2>Login Failed</h2>
                    <p>{error}</p>
                    <p className="redirect-notice">Redirecting...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-callback-page">
            <div className="callback-content">
                <div className="loading-spinner" />
                <h2>Logging you in...</h2>
                <p>Please wait while we complete your authentication.</p>
            </div>
        </div>
    );
}

module.exports = AuthCallback;