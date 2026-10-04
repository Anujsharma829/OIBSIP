// Small wrapper around localStorage (token, user and cart are saved here so a refresh keeps you logged in).
const mem = {};
export const ls = {
  get: (k) => {
    try {
      const v = localStorage.getItem(k);
      if (v !== null) return v;
    } catch {}
    return mem[k] ?? null;
  },
  set: (k, v) => {
    mem[k] = v;
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  del: (k) => {
    delete mem[k];
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};
