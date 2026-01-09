const React = require('react');

const { BrowserRouter, Routes, Route, Navigate } = require('react-router-dom');
const { AuthProvider, useAuth } = require('./context/AuthContext');
const { QueryClient, QueryClientProvider } = require('@tanstack/react-query');

// Pages
const Home = require('./pages/Home');
const Dashboard = require('./pages/Dashboard');
const AuthCallback = require('./pages/AuthCallback');
const SystemSetup = require('./pages/SystemSetup');
const QuickSwitch = require('./pages/QuickSwitch');
const NotesPage = require('./pages/NotesPage');

// Layout
const Layout = require('./components/layout/Layout');

// Styles (Webpack/Vite will still process this)
require('./styles/index.css');

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1
    }
  }
});

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Routes component (needs to be inside AuthProvider)
function AppRoutes() {
  const { userType, system } = useAuth();

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Home />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Protected app routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard - everyone */}
        <Route index element={<Dashboard />} />

        {/* Setup - for new users */}
        <Route path="setup" element={<SystemSetup />} />

        {/* Quick Switch - everyone with a system */}
        <Route path="quick-switch" element={<QuickSwitch />} />

        {/* Notes - everyone */}
        <Route path="notes" element={<NotesPage />} />

        {/* Friends */}
        <Route
          path="friends"
          element={
            <div className="page">
              <h1>Friends</h1>
              <p>Coming soon...</p>
            </div>
          }
        />

        {/* Alters - system users only */}
        {userType === 'system' && (
          <Route
            path="alters"
            element={
              <div className="page">
                <h1>{system?.alterSynonym?.plural || 'Alters'}</h1>
                <p>Alter management coming soon...</p>
              </div>
            }
          />
        )}

        {/* States */}
        {(userType === 'system' || userType === 'fractured') && (
          <Route
            path="states"
            element={
              <div className="page">
                <h1>States</h1>
                <p>State management coming soon...</p>
              </div>
            }
          />
        )}

        {/* Groups */}
        {(userType === 'system' || userType === 'fractured') && (
          <Route
            path="groups"
            element={
              <div className="page">
                <h1>Groups</h1>
                <p>Group management coming soon...</p>
              </div>
            }
          />
        )}

        {/* Settings */}
        <Route
          path="settings"
          element={
            <div className="page">
              <h1>Settings</h1>
              <p>Settings coming soon...</p>
            </div>
          }
        />
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

module.exports = App;