export const API = import.meta.env.VITE_API_URL || '/api';
export const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;

export async function request(path, options = {}) {
  const isAuthCall = path.startsWith('/auth/') && !path.startsWith('/auth/me');
  const token = isAuthCall ? null : localStorage.getItem('slice_token');
  let res;
  try {
    res = await fetch(`${API}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(options.headers || {}) } });
  } catch {
    throw new Error('Cannot reach the server. Make sure the backend is running (cd server && npm run dev).');
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) { localStorage.removeItem('slice_token'); localStorage.removeItem('slice_user'); }
  if (!res.ok) {
    const err = new Error(data.message || 'Something went wrong. Please try again.');
    err.data = data;
    throw err;
  }
  return data;
}
