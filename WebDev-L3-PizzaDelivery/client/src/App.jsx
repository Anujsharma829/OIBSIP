// The page frame: top navbar, slide-out sidebar (opens with the three-line button) and all page routes.
import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from './lib.jsx';
import {
  Home,
  Auth,
  Forgot,
  Reset,
  Verify,
  Builder,
  Cart,
  Dashboard,
  Admin,
  Profile,
} from './pages.jsx';

const ICONS = {
  home: ['M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', 'M9 22V12h6v10'],
  build: ['c:12,12,10', 'M12 8v8', 'M8 12h8'],
  cart: [
    'c:9,21,1',
    'c:20,21,1',
    'M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6',
  ],
  orders: [
    'M16.5 9.4l-9-5.19',
    'M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z',
    'M3.27 6.96L12 12.01l8.73-5.05',
    'M12 22.08V12',
  ],
  stock: ['M12 2L2 7l10 5 10-5-10-5z', 'M2 17l10 5 10-5', 'M2 12l10 5 10-5'],
  user: ['M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2', 'c:12,7,4'],
  out: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'M16 17l5-5-5-5', 'M21 12H9'],
  burger: ['M3 12h18', 'M3 6h18', 'M3 18h18'],
  close: ['M18 6L6 18', 'M6 6l12 12'],
};
const Icon = ({ n }) => (
  <svg
    className="ico"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {ICONS[n].map((d, i) => {
      if (d.startsWith('c:')) {
        const [cx, cy, r] = d.slice(2).split(',');
        return <circle key={i} cx={cx} cy={cy} r={r} />;
      }
      return <path key={i} d={d} />;
    })}
  </svg>
);
const Guard = ({ role, children }) => {
  const { user } = useApp();
  if (!user) return <Navigate to={role === 'admin' ? '/admin/login' : '/login'} replace />;
  return !role || user.role === role ? children : <Navigate to="/" replace />;
};

export default function App() {
  const { user, cart, logout, toast } = useApp(),
    [open, setOpen] = useState(false),
    loc = useLocation(),
    nav = useNavigate();
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);
  const count = cart.reduce((s, c) => s + c.qty, 0),
    admin = user?.role === 'admin',
    initial = user ? user.name[0].toUpperCase() : '?';
  const doLogout = () => {
    logout();
    setOpen(false);
    nav('/');
  };
  const T = (to, label) => (
    <NavLink
      to={to}
      end={to === '/' || to === '/admin'}
      className={({ isActive }) => 'tl' + (isActive ? ' on' : '')}
    >
      {label}
    </NavLink>
  );
  const L = (to, icon, label, extra) => (
    <NavLink
      to={to}
      end={to === '/' || to === '/admin'}
      className={({ isActive }) => 'sl' + (isActive ? ' on' : '')}
    >
      <Icon n={icon} />
      <span>{label}</span>
      {extra}
    </NavLink>
  );
  return (
    <div className="shell">
      <header className="topbar">
        <div className="tb-in">
          <button
            className="burger"
            aria-label="Open menu"
            aria-expanded={open}
            onClick={() => setOpen(true)}
          >
            <Icon n="burger" />
          </button>
          <Link to="/" className="logo">
            Slice Society
          </Link>
          <nav className="tnav">
            {admin ? (
              <>
                {T('/admin', 'Orders')}
                {T('/admin/inventory', 'Inventory')}
              </>
            ) : (
              <>
                {T('/', 'Menu')}
                {T('/build', 'Build a pizza')}
                {user && T('/dashboard', 'My orders')}
              </>
            )}
          </nav>
          <div className="tright">
            {!admin && (
              <NavLink to="/cart" className="cartb" aria-label="Cart">
                <Icon n="cart" />
                {count > 0 && <span className="pill">{count}</span>}
              </NavLink>
            )}
            {user ? (
              <>
                <Link to="/profile" className="av sm" aria-label="Profile">
                  {initial}
                </Link>
                <button className="btn sm ghost hide-sm" onClick={doLogout}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link className="link-t hide-sm" to="/login">
                  Log in
                </Link>
                <Link className="btn sm" to="/register">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <aside className={'side' + (open ? ' open' : '')} aria-label="Menu">
        <div className="side-head">
          <Link to="/" className="logo">
            Slice Society
          </Link>
          <button className="burger" aria-label="Close menu" onClick={() => setOpen(false)}>
            <Icon n="close" />
          </button>
        </div>
        <div className="prof">
          <div className="av">{initial}</div>
          <div>
            <b>{user ? user.name : 'Hello, guest'}</b>
            <small>{user ? (admin ? 'Admin' : 'Customer') : 'Log in to order'}</small>
          </div>
        </div>
        <nav className="links">
          {admin ? (
            <>
              {L('/admin', 'orders', 'Orders')}
              {L('/admin/inventory', 'stock', 'Inventory')}
              {L('/profile', 'user', 'Profile')}
            </>
          ) : (
            <>
              {L('/', 'home', 'Menu')}
              {L('/build', 'build', 'Build a pizza')}
              {L('/cart', 'cart', 'Cart', count > 0 && <span className="pill">{count}</span>)}
              {user && L('/dashboard', 'orders', 'My orders')}
              {user && L('/profile', 'user', 'Profile')}
            </>
          )}
        </nav>
        <div className="side-foot">
          {user ? (
            <button className="sl" onClick={doLogout}>
              <Icon n="out" />
              <span>Log out</span>
            </button>
          ) : (
            <>
              <Link className="btn sm" to="/login">
                Log in
              </Link>
              <Link className="btn sm ghost" to="/register">
                Sign up
              </Link>
            </>
          )}
        </div>
      </aside>
      <div className="content">
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/register" element={<Auth mode="register" />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset/:token" element={<Reset />} />
            <Route path="/verify/:token" element={<Verify />} />
            <Route path="/build" element={<Builder />} />
            <Route path="/cart" element={<Cart />} />
            <Route
              path="/dashboard"
              element={
                <Guard role="user">
                  <Dashboard />
                </Guard>
              }
            />
            <Route
              path="/profile"
              element={
                <Guard>
                  <Profile />
                </Guard>
              }
            />
            <Route path="/admin/login" element={<Auth mode="admin" />} />
            <Route
              path="/admin"
              element={
                <Guard role="admin">
                  <Admin />
                </Guard>
              }
            />
            <Route
              path="/admin/inventory"
              element={
                <Guard role="admin">
                  <Admin />
                </Guard>
              }
            />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <footer className="foot">
          <div className="wrap">
            Slice Society. Made fresh, delivered hot. Payments run in Razorpay test mode.
          </div>
        </footer>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
