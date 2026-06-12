// Layout Component
// Main app layout with sidebar navigation

const { Outlet, Link, useLocation } = require('react-router-dom');
const { useAuth } = require('../../context/AuthContext');
const { Icon } = require('@chameleon/shared');

function Layout() {
    const { user, system, userType, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { 
            path: '/app', 
            icon: 'home', 
            label: 'Dashboard', 
            show: true,
            exact: true
        },
        { 
            path: '/app/quick-switch', 
            icon: 'zap', 
            label: 'Quick Switch', 
            show: !!system 
        },
        { 
            path: '/app/alters', 
            icon: 'users', 
            label: system?.alterSynonym?.plural || 'Alters', 
            show: userType === 'system' 
        },
        { 
            path: '/app/states', 
            icon: 'layers', 
            label: 'States', 
            show: userType === 'system' || userType === 'fractured' 
        },
        { 
            path: '/app/groups', 
            icon: 'folder', 
            label: 'Groups', 
            show: userType === 'system' || userType === 'fractured' 
        },
        { 
            path: '/app/notes', 
            icon: 'fileText', 
            label: 'Notes', 
            show: true 
        },
        { 
            path: '/app/friends', 
            icon: 'heart', 
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
                                {userType === 'system' ? <><Icon name="drama" size={14} /> System</> : 
                                 userType === 'fractured' ? <><Icon name="shuffle" size={14} /> Fractured</> : <><Icon name="fileText" size={14} /> Basic</>}
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
                            <Icon name={item.icon} size={20} />
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <Link to="/app/settings" className="nav-item">
                        <Icon name="settings" size={20} />
                        <span>Settings</span>
                    </Link>
                    <button onClick={logout} className="nav-item logout-btn">
                        <Icon name="logOut" size={20} />
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