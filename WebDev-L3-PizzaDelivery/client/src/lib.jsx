// Shared tools: api() to call the backend, login/cart state (Context), live updates (Socket.IO), Razorpay loader.
import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { ls } from './store.js';
import * as mock from './mock.js';

export const MOCK = !!import.meta.env.VITE_MOCK; // demo mode: fake in-browser backend, no server needed

export async function api(path, opts = {}) {
  if (MOCK) return mock.handle(path, opts);
  const { method = 'GET', body } = opts,
    token = ls.get('token');
  const r = await fetch('/api' + path, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message || 'Request failed');
  return d;
}
const Ctx = createContext();
export const useApp = () => useContext(Ctx);
const read = (k, d) => {
  try {
    return JSON.parse(ls.get(k)) ?? d;
  } catch {
    return d;
  }
};

export function AppProvider({ children }) {
  const [user, setUser] = useState(() => read('user', null));
  const [cart, setCart] = useState(() => read('cart', []));
  const [toast, setToast] = useState('');
  useEffect(() => ls.set('cart', JSON.stringify(cart)), [cart]);
  const notify = (m) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };
  const login = (token, u) => {
    ls.set('token', token);
    ls.set('user', JSON.stringify(u));
    setUser(u);
  };
  const logout = () => {
    ls.del('token');
    ls.del('user');
    setUser(null);
  };
  const addToCart = (item) => {
    const key = item.kind === 'menu' ? item.pizzaId : JSON.stringify(item.recipe);
    setCart((c) =>
      c.some((x) => x.key === key)
        ? c.map((x) => (x.key === key ? { ...x, qty: Math.min(10, x.qty + 1) } : x))
        : [...c, { ...item, key, qty: 1 }]
    );
    notify(`${item.name} added to cart`);
  };
  return (
    <Ctx.Provider
      value={{
        user,
        cart,
        setCart,
        clear: () => setCart([]),
        toast,
        notify,
        login,
        logout,
        addToCart,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

// live updates from the server (Socket.IO); demo mode uses a tiny in-browser event bus
export function useSocket(handlers) {
  useEffect(() => {
    if (MOCK) {
      const offs = Object.entries(handlers).map(([e, h]) => mock.on(e, h));
      return () => offs.forEach((f) => f());
    }
    const s = io('/', { auth: { token: ls.get('token') } });
    Object.entries(handlers).forEach(([e, h]) => s.on(e, h));
    return () => s.disconnect();
  }, []);
}
export const loadRazorpay = () =>
  MOCK
    ? (mock.installRazorpay(), Promise.resolve())
    : new Promise((ok, no) => {
        if (window.Razorpay) return ok();
        const s = document.createElement('script');
        s.src = 'https://checkout.razorpay.com/v1/checkout.js';
        s.onload = ok;
        s.onerror = () => no(new Error('Could not load Razorpay. Check your internet.'));
        document.body.appendChild(s);
      });
