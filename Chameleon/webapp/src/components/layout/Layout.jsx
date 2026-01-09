// Layout Component
// Main app layout with sidebar navigation

const { Outlet, Link, useLocation } = require('react-router-dom');
const { useAuth } = require('../../context/AuthContext');

// Icons (you can use lucide-react or similar)
const Icons = {
    Home: () => <span>🏠</span>,
    Zap: () => <span>⚡</span>,
    Users: () => <span>👥</span>,
    Layers: () => <span>📚</span>,
    Folder: () => <span>📁</span>,
    FileText: () => <span>📝</span>,
    Heart: () => <span>💜</span>,
    Settings: () => <span>⚙️</span>,
    LogOut: () => <span>🚪</span>
};

function Layout() {
    const { user, system, userType, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { 
            path: '/app', 
            icon: Icons.Home, 
            label: 'Dashboard', 
            show: true,
            exact: true
        },
        { 
            path: '/app/quick-switch', 
            icon: Icons.Zap, 
            label: 'Quick Switch', 
            show: !!system 
        },
        { 
            path: '/app/alters', 
            icon: Icons.Users, 
            label: system?.alterSynonym?.plural || 'Alters', 
            show: userType === 'system' 
        },
        { 
            path: '/app/states', 
            icon: Icons.Layers, 
            label: 'States', 
            show: userType === 'system' || userType === 'fractured' 
        },
        { 
            path: '/app/groups', 
            icon: Icons.Folder, 
            label: 'Groups', 
            show: userType === 'system' || userType === 'fractured' 
        },
        { 
            path: '/app/notes', 
            icon: Icons.FileText, 
            label: 'Notes', 
            show: true 
        },
        { 
            path: '/app/friends', 
            icon: Icons.Heart, 
            label: 'Friends', 
            show: true 
        }
    ];

    const isActive = (path, exact = false) => {
        if (exact) {
            return location.pathname === path;
        }
        return location.pathname.startsWith(path);
    };

    return (
        <div className="app-layout">
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="system-avatar">
                        {system?.avatar?.url ? (
                            <img src={system.avatar.url} alt="" />
                        ) : (
                            <div className="avatar-placeholder">
                                {(system?.name?.display || 'S')[0]}
                            </div>
                        )}
                    </div>
                    <div className="system-info">
                        <h2>{system?.name?.display || 'My System'}</h2>
                        {userType && (
                            <span className={`user-type-badge ${userType}`}>
                                {userType === 'system' ? '🎭 System' : 
                                 userType === 'fractured' ? '🔀 Fractured' : '📝 Basic'}
                            </span>
                        )}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.filter(item => item.show).map(item => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${isActive(item.path, item.exact) ? 'active' : ''}`}
                        >
                            <item.icon />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <Link to="/app/settings" className="nav-item">
                        <Icons.Settings />
                        <span>Settings</span>
                    </Link>
                    <button onClick={logout} className="nav-item logout-btn">
                        <Icons.LogOut />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

module.exports = Layout;