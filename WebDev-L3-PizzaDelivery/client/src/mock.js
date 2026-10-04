// DEMO ONLY: a fake backend inside the browser (used by `npm run demo`). The real app uses the server/ folder.
// Demo backend that lives in the browser (used only with `npm run demo`). Real app uses server/.
import { ls } from './store.js';
const ST = ['Order Received', 'In Kitchen', 'Sent to Delivery'];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const subs = {};
export const on = (e, h) => {
  (subs[e] ||= []).push(h);
  return () => {
    subs[e] = subs[e].filter((x) => x !== h);
  };
};
const emit = (e, d) => (subs[e] || []).forEach((h) => h(d));
const mk = (type, arr) =>
  arr.map(([name, price], i) => ({ _id: type + i, type, name, price, stock: 100, threshold: 20 }));
const items = [
  ...mk('base', [
    ['Classic Hand-Tossed', 149],
    ['Thin Crust', 159],
    ['Cheese Burst', 199],
    ['Whole Wheat', 169],
    ['Multigrain', 179],
  ]),
  ...mk('sauce', [
    ['Tomato Basil', 20],
    ['Pesto', 35],
    ['BBQ', 30],
    ['Alfredo', 35],
    ['Spicy Arrabbiata', 25],
  ]),
  ...mk('cheese', [
    ['Mozzarella', 40],
    ['Cheddar', 40],
    ['Parmesan', 55],
    ['Vegan Cashew', 70],
  ]),
  ...mk('veggie', [
    ['Onion', 15],
    ['Capsicum', 20],
    ['Tomato', 15],
    ['Mushroom', 30],
    ['Olives', 25],
    ['Sweet Corn', 20],
    ['Jalapeño', 20],
    ['Paneer', 45],
  ]),
];
items.find((i) => i.name === 'Thin Crust').stock = 14;
items.find((i) => i.name === 'Mozzarella').stock = 8;
const R = (base, sauce, cheese, veggies) => ({ base, sauce, cheese, veggies });
const pizzas = [
  {
    _id: 'p0',
    name: 'Margherita',
    desc: 'Basil tomato sauce, fresh mozzarella, nothing else needed.',
    price: 249,
    recipe: R('Classic Hand-Tossed', 'Tomato Basil', 'Mozzarella', ['Tomato']),
  },
  {
    _id: 'p1',
    name: 'Farmhouse',
    desc: 'Onion, capsicum, mushroom and tomato on a golden crust.',
    price: 329,
    recipe: R('Classic Hand-Tossed', 'Tomato Basil', 'Mozzarella', [
      'Onion',
      'Capsicum',
      'Mushroom',
      'Tomato',
    ]),
  },
  {
    _id: 'p2',
    name: 'Paneer Tikka',
    desc: 'Smoky BBQ base with paneer, onion and capsicum.',
    price: 349,
    recipe: R('Thin Crust', 'BBQ', 'Cheddar', ['Paneer', 'Onion', 'Capsicum']),
  },
  {
    _id: 'p3',
    name: 'Green Pesto',
    desc: 'Pesto, parmesan, olives, mushroom and sweet corn.',
    price: 359,
    recipe: R('Whole Wheat', 'Pesto', 'Parmesan', ['Olives', 'Mushroom', 'Sweet Corn']),
  },
  {
    _id: 'p4',
    name: 'Mexican Fire',
    desc: 'Arrabbiata, jalapeño, corn and onion. Brings the heat.',
    price: 339,
    recipe: R('Multigrain', 'Spicy Arrabbiata', 'Cheddar', ['Jalapeño', 'Sweet Corn', 'Onion']),
  },
  {
    _id: 'p5',
    name: 'Cheese Burst Supreme',
    desc: 'Cheese-stuffed crust with a triple veggie topping.',
    price: 399,
    recipe: R('Cheese Burst', 'Alfredo', 'Mozzarella', ['Mushroom', 'Olives', 'Capsicum']),
  },
];
const users = [
  { id: 'u1', name: 'Rahul Sharma', email: 'demo@pizza.com', password: 'demo123', role: 'user' },
  { id: 'a1', name: 'Admin', email: 'admin@pizza.com', password: 'Admin@123', role: 'admin' },
];
const orders = [
  {
    _id: 'a1f3c2d4e5b6',
    userId: 'u1',
    lines: [{ name: 'Farmhouse', qty: 1, price: 329, recipe: pizzas[1].recipe }],
    total: 329,
    address: '12 MI Road, Jaipur',
    status: ST[1],
    paid: true,
    createdAt: new Date(Date.now() - 36e5).toISOString(),
  },
];
let seq = 1;
const rid = () => Math.random().toString(16).slice(2, 14).padEnd(12, '0');
const names = (r) => [r.base, r.sauce, r.cheese, ...(r.veggies || [])];
const err = (m) => {
  throw new Error(m);
};
const cur = () =>
  users.find((u) => 'mock:' + u.id === ls.get('token')) || err('Please log in again');
const adm = () => {
  const u = cur();
  if (u.role !== 'admin') err('Not allowed');
  return u;
};
const withUser = (o) => {
  const u = users.find((x) => x.id === o.userId);
  return { ...o, user: { _id: u.id, name: u.name, email: u.email } };
};
const by = (n) => items.find((i) => i.name === n);
function priceLines(cart) {
  if (!cart?.length) err('Your cart is empty');
  const lines = cart.map((c) => {
    const qty = Math.max(1, Math.min(10, +c.qty || 1));
    if (c.kind === 'menu') {
      const p = pizzas.find((x) => x._id === c.pizzaId) || err('Pizza not found');
      return { name: p.name, qty, price: p.price, recipe: p.recipe };
    }
    const r = c.recipe || {},
      n = names(r);
    if (!r.base || !r.sauce || !r.cheese || n.some((x) => !by(x))) err('Invalid custom pizza');
    return {
      name: 'Custom pizza',
      qty,
      price: 49 + n.reduce((s, x) => s + by(x).price, 0),
      recipe: r,
    };
  });
  const need = {};
  lines.forEach((l) => names(l.recipe).forEach((n) => (need[n] = (need[n] || 0) + l.qty)));
  for (const n in need) if (by(n).stock < need[n]) err(`Sorry, ${n} is out of stock`);
  return lines;
}
const advance = (o, i) => {
  o.status = ST[i];
  emit('order:update', withUser(o));
};

export async function handle(path, { method = 'GET', body = {} } = {}) {
  await wait(220);
  const k = method + ' ' + path;
  let m;
  if (k === 'GET /menu') return { pizzas, items };
  if (k === 'POST /auth/register') {
    if (!body.name || !body.email || (body.password || '').length < 6)
      err('Name, email and a 6+ character password are required');
    if (users.some((u) => u.email === body.email.toLowerCase()))
      err('This email is already registered');
    users.push({
      id: 'u' + ++seq,
      name: body.name,
      email: body.email.toLowerCase(),
      password: body.password,
      role: 'user',
    });
    return { message: 'Account created. (Demo mode: email is auto-verified, you can log in now.)' };
  }
  if (k === 'POST /auth/login' || k === 'POST /admin/login') {
    const role = k.includes('admin') ? 'admin' : 'user';
    const u = users.find(
      (x) =>
        x.email === (body.email || '').toLowerCase() &&
        x.role === role &&
        x.password === body.password
    );
    if (!u) err(role === 'admin' ? 'Wrong admin credentials' : 'Wrong email or password');
    return { token: 'mock:' + u.id, user: { id: u.id, name: u.name, role: u.role } };
  }
  if (k === 'POST /auth/forgot')
    return {
      message: 'If that email exists, a reset link is on its way. (Demo mode: no email is sent.)',
    };
  if (path.startsWith('/auth/reset/')) return { message: 'Password updated. Please log in.' };
  if (path.startsWith('/auth/verify/')) return { message: 'Email verified. You can log in now.' };
  if (k === 'GET /auth/me') {
    const u = cur();
    return {
      name: u.name,
      email: u.email,
      role: u.role,
      orders: orders.filter((o) => o.userId === u.id && o.paid).length,
    };
  }
  if (k === 'PUT /auth/me') {
    const u = cur();
    if ((body.name || '').trim().length < 2) err('Please enter your name');
    u.name = body.name.trim();
    return { name: u.name };
  }
  if (k === 'PUT /auth/password') {
    const u = cur();
    if (body.current !== u.password) err('Current password is wrong');
    if ((body.password || '').length < 6) err('New password must be 6+ characters');
    u.password = body.password;
    return { message: 'Password changed' };
  }
  if (k === 'POST /orders') {
    const u = cur(),
      lines = priceLines(body.items),
      total = lines.reduce((s, l) => s + l.price * l.qty, 0);
    const o = {
      _id: rid(),
      userId: u.id,
      lines,
      total,
      address: body.address,
      status: ST[0],
      paid: false,
      createdAt: new Date().toISOString(),
      razorpayOrderId: 'order_demo' + ++seq,
    };
    orders.push(o);
    return {
      orderId: o._id,
      razorpayOrderId: o.razorpayOrderId,
      amount: total * 100,
      key: 'rzp_test_demo',
    };
  }
  if (k === 'POST /orders/verify') {
    cur();
    const o = orders.find((x) => x._id === body.orderId) || err('Order not found');
    if (!o.paid) {
      o.paid = true;
      o.createdAt = new Date().toISOString();
      const need = {};
      o.lines.forEach((l) => names(l.recipe).forEach((n) => (need[n] = (need[n] || 0) + l.qty)));
      for (const n in need) by(n).stock -= need[n];
      emit('order:new', withUser(o));
      setTimeout(() => advance(o, 1), 9000);
      setTimeout(() => advance(o, 2), 24000); // demo: kitchen progresses by itself
    }
    return o;
  }
  if (k === 'GET /orders/mine') {
    const u = cur();
    return orders
      .filter((o) => o.userId === u.id && o.paid)
      .slice()
      .reverse();
  }
  if (k === 'GET /admin/orders') {
    adm();
    return orders
      .filter((o) => o.paid)
      .slice()
      .reverse()
      .map(withUser);
  }
  if ((m = path.match(/^\/admin\/orders\/(\w+)\/status$/))) {
    adm();
    const o = orders.find((x) => x._id === m[1]) || err('Order not found');
    if (!ST.includes(body.status)) err('Invalid status');
    o.status = body.status;
    const out = withUser(o);
    emit('order:update', out);
    return out;
  }
  if (k === 'GET /admin/inventory') {
    adm();
    return items;
  }
  if (method === 'PUT' && (m = path.match(/^\/admin\/inventory\/(\w+)$/))) {
    adm();
    const it = items.find((x) => x._id === m[1]) || err('Item not found');
    if (body.stock !== undefined) it.stock = Math.max(0, +body.stock);
    if (body.threshold !== undefined) it.threshold = Math.max(0, +body.threshold);
    return it;
  }
  return err('Not found');
}

export function installRazorpay() {
  window.Razorpay = class {
    constructor(o) {
      this.o = o;
    }
    open() {
      const o = this.o,
        d = document.createElement('div');
      d.className = 'rzov';
      d.innerHTML = `<div class="rzbox"><div class="rzh"><div><b>Slice Society</b><small>Razorpay Secure · Test mode</small></div><b>₹${o.amount / 100}</b></div><div class="rzt">Demo: no real money is charged</div><div class="rzb"><div class="rzm">UPI</div><div class="rzm">Card</div><div class="rzm">Netbanking</div><button class="btn full" data-r="ok">Success</button><button class="btn full ghost dark" data-r="no">Failure</button></div></div>`;
      d.onclick = (e) => {
        const r = e.target.dataset.r;
        if (!r && e.target !== d) return;
        d.remove();
        if (r === 'ok')
          o.handler({
            razorpay_order_id: o.order_id,
            razorpay_payment_id: 'pay_demo' + Date.now(),
            razorpay_signature: 'demo',
          });
        else o.modal?.ondismiss?.();
      };
      document.body.appendChild(d);
    }
  };
}
