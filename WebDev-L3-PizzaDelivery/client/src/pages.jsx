// All screens: Home, Login/Register, Forgot/Reset password, Builder, Cart, Dashboard, Profile, Admin.
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, loadRazorpay, MOCK, useApp, useSocket } from './lib.jsx';
import Pizza, { PizzaPic } from './Pizza.jsx';
import { ls } from './store.js';

const rs = (n) => '₹' + n;
const STEPS = ['Order Received', 'In Kitchen', 'Sent to Delivery'];
const recipeText = (r) =>
  [r.base, r.sauce, r.cheese, ...(r.veggies || [])].filter(Boolean).join(', ');

function MenuGrid() {
  const { addToCart } = useApp();
  const [menu, setMenu] = useState(null);
  useEffect(() => {
    api('/menu')
      .then(setMenu)
      .catch(() => setMenu({ pizzas: [], error: true }));
  }, []);
  return (
    <>
      {!menu && <p>Loading the menu…</p>}
      {menu?.error && <p className="err">Can't reach the server. Start the backend and refresh.</p>}
      <div className="grid">
        {menu?.pizzas.map((p) => (
          <article className="card" key={p._id}>
            <span className="veg" title="Vegetarian" />
            <PizzaPic className="pic" name={p.name} recipe={p.recipe} />
            <h3>{p.name}</h3>
            <p className="muted">{p.desc}</p>
            <small className="ing">{recipeText(p.recipe)}</small>
            <div className="row between">
              <b className="price">{rs(p.price)}</b>
              <button
                className="btn sm"
                onClick={() =>
                  addToCart({
                    kind: 'menu',
                    pizzaId: p._id,
                    name: p.name,
                    price: p.price,
                    recipe: p.recipe,
                  })
                }
              >
                Add to cart
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

export function Home() {
  const go = () => document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <>
      <section className="hero">
        <h1>Fresh dough, your toppings, straight from the oven.</h1>
        <p>
          Choose a pizza from the menu or build your own with five crusts, five sauces, four cheeses
          and eight vegetables.
        </p>
        <div className="row mid">
          <Link className="btn" to="/build">
            Build your pizza
          </Link>
          <button className="btn ghost" onClick={go}>
            See the menu
          </button>
        </div>
        <div className="spin">
          <Pizza
            className="hero-pizza"
            sauce="Tomato Basil"
            cheese="Mozzarella"
            veggies={['Tomato', 'Capsicum', 'Olives', 'Mushroom', 'Onion']}
          />
          <span className="fl f1">Hand-tossed crust</span>
          <span className="fl f2">Fresh veggies</span>
          <span className="fl f3">Real cheese</span>
          <span className="fl f4">Made to order</span>
        </div>
      </section>
      <section id="menu" className="wrap sec">
        <h2>Our pizzas</h2>
        <MenuGrid />
      </section>
    </>
  );
}

export function Auth({ mode }) {
  const nav = useNavigate(),
    { login, cart } = useApp();
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const [msg, setMsg] = useState(''),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setMsg('');
    setBusy(true);
    try {
      if (mode === 'register')
        setMsg((await api('/auth/register', { method: 'POST', body: f })).message);
      else {
        const d = await api(mode === 'admin' ? '/admin/login' : '/auth/login', {
          method: 'POST',
          body: f,
        });
        login(d.token, d.user);
        nav(mode === 'admin' ? '/admin' : cart.length ? '/cart' : '/dashboard');
      }
    } catch (x) {
      setErr(x.message);
    }
    setBusy(false);
  };
  const title = { login: 'Welcome back', register: 'Create your account', admin: 'Admin sign in' }[
    mode
  ];
  return (
    <section className="wrap narrow">
      <form className="panel" onSubmit={submit}>
        <h2>{title}</h2>
        {mode === 'register' && (
          <label>
            Full name
            <input required value={f.name} onChange={set('name')} />
          </label>
        )}
        <label>
          Email
          <input type="email" required value={f.email} onChange={set('email')} />
        </label>
        <label>
          Password
          <input
            type="password"
            required
            minLength={6}
            value={f.password}
            onChange={set('password')}
          />
        </label>
        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        {MOCK && mode !== 'register' && (
          <button
            type="button"
            className="link"
            onClick={() =>
              setF({
                ...f,
                email: mode === 'admin' ? 'admin@pizza.com' : 'demo@pizza.com',
                password: mode === 'admin' ? 'Admin@123' : 'demo123',
              })
            }
          >
            Fill demo login
          </button>
        )}
        <button className="btn full" disabled={busy}>
          {mode === 'register' ? 'Create account' : 'Log in'}
        </button>
        {mode === 'login' && (
          <p className="muted">
            <Link to="/forgot">Forgot your password?</Link> &nbsp;|&nbsp;{' '}
            <Link to="/register">New here? Sign up</Link>
          </p>
        )}
        {mode === 'register' && (
          <p className="muted">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        )}
      </form>
    </section>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''),
    [msg, setMsg] = useState(''),
    [err, setErr] = useState('');
  const go = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      setMsg((await api('/auth/forgot', { method: 'POST', body: { email } })).message);
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <section className="wrap narrow">
      <form className="panel" onSubmit={go}>
        <h2>Reset your password</h2>
        <label>
          Email
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button className="btn full">Send reset link</button>
      </form>
    </section>
  );
}

export function Reset() {
  const { token } = useParams(),
    nav = useNavigate();
  const [password, setPassword] = useState(''),
    [msg, setMsg] = useState(''),
    [err, setErr] = useState('');
  const go = async (e) => {
    e.preventDefault();
    setErr('');
    try {
      setMsg((await api('/auth/reset/' + token, { method: 'POST', body: { password } })).message);
      setTimeout(() => nav('/login'), 1500);
    } catch (x) {
      setErr(x.message);
    }
  };
  return (
    <section className="wrap narrow">
      <form className="panel" onSubmit={go}>
        <h2>Choose a new password</h2>
        <label>
          New password
          <input
            type="password"
            minLength={6}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {err && <p className="err">{err}</p>}
        {msg && <p className="ok">{msg}</p>}
        <button className="btn full">Save password</button>
      </form>
    </section>
  );
}

export function Verify() {
  const { token } = useParams();
  const [s, setS] = useState({ text: 'Verifying your email…' });
  useEffect(() => {
    api('/auth/verify/' + token)
      .then((d) => setS({ text: d.message, ok: true }))
      .catch((e) => setS({ text: e.message, bad: true }));
  }, [token]);
  return (
    <section className="wrap narrow">
      <div className="panel">
        <h2>Email verification</h2>
        <p className={s.bad ? 'err' : s.ok ? 'ok' : ''}>{s.text}</p>
        {s.ok && (
          <Link className="btn" to="/login">
            Log in
          </Link>
        )}
      </div>
    </section>
  );
}

const STEP_DEFS = [
  ['base', 'Choose your base', 'Pick one of five crusts.'],
  ['sauce', 'Choose your sauce', 'Pick one of five sauces.'],
  ['cheese', 'Choose your cheese', 'Pick one cheese.'],
  ['veggie', 'Choose your vegetables', 'Pick as many as you like.'],
];

export function Builder() {
  const { addToCart } = useApp(),
    nav = useNavigate();
  const [items, setItems] = useState([]),
    [step, setStep] = useState(0),
    [sel, setSel] = useState({ base: '', sauce: '', cheese: '', veggies: [] });
  useEffect(() => {
    api('/menu')
      .then((d) => setItems(d.items))
      .catch(() => {});
  }, []);
  const [type, title, hint] = STEP_DEFS[step];
  const on = (it) => (type === 'veggie' ? sel.veggies.includes(it.name) : sel[type] === it.name);
  const pick = (it) =>
    it.stock < 1
      ? null
      : setSel((s) =>
          type === 'veggie'
            ? {
                ...s,
                veggies: s.veggies.includes(it.name)
                  ? s.veggies.filter((v) => v !== it.name)
                  : [...s.veggies, it.name],
              }
            : { ...s, [type]: it.name }
        );
  const price =
    49 +
    [sel.base, sel.sauce, sel.cheese, ...sel.veggies]
      .filter(Boolean)
      .reduce((s, n) => s + (items.find((i) => i.name === n)?.price || 0), 0);
  const canNext = step === 3 || sel[type];
  const finish = () => {
    addToCart({ kind: 'custom', name: 'Custom pizza', price, recipe: sel });
    nav('/cart');
  };
  return (
    <section className="wrap sec">
      <h2>Build your own pizza</h2>
      <div className="builder">
        <div className="panel">
          <ol className="steps">
            {STEP_DEFS.map((s, i) => (
              <li key={s[0]} className={i === step ? 'cur' : i < step ? 'done' : ''}>
                {s[0] === 'veggie' ? 'Veggies' : s[0][0].toUpperCase() + s[0].slice(1)}
              </li>
            ))}
          </ol>
          <h3>{title}</h3>
          <p className="muted">{hint}</p>
          <div className="opts">
            {items
              .filter((i) => i.type === type)
              .map((it) => (
                <button
                  key={it._id}
                  type="button"
                  className={'opt' + (on(it) ? ' on' : '')}
                  disabled={it.stock < 1}
                  onClick={() => pick(it)}
                  aria-pressed={on(it)}
                >
                  <span>{it.name}</span>
                  <small>{it.stock < 1 ? 'Out of stock' : '+ ' + rs(it.price)}</small>
                </button>
              ))}
          </div>
          <div className="row between">
            <button
              className="btn ghost dark"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              Back
            </button>
            {step < 3 ? (
              <button className="btn" disabled={!canNext} onClick={() => setStep(step + 1)}>
                Next step
              </button>
            ) : (
              <button className="btn" onClick={finish}>
                Add to cart
              </button>
            )}
          </div>
        </div>
        <aside className="panel preview">
          <Pizza
            className="prev-pizza"
            sauce={sel.sauce}
            cheese={sel.cheese}
            veggies={sel.veggies}
          />
          <p className="muted center">
            {recipeText(sel) || 'Your pizza will appear here as you choose.'}
          </p>
          <b className="price center">{rs(price)}</b>
          <p className="muted center small">Includes {rs(49)} for baking and packing.</p>
        </aside>
      </div>
    </section>
  );
}

export function Cart() {
  const { cart, setCart, user, notify, clear } = useApp(),
    nav = useNavigate();
  const [addr, setAddr] = useState(''),
    [busy, setBusy] = useState(false);
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
  const chg = (key, d) =>
    setCart(
      cart.map((c) => (c.key === key ? { ...c, qty: Math.max(1, Math.min(10, c.qty + d)) } : c))
    );
  const pay = async () => {
    if (!user || user.role !== 'user') return nav('/login');
    if (addr.trim().length < 8) return notify('Please add your full delivery address.');
    setBusy(true);
    try {
      await loadRazorpay();
      const o = await api('/orders', {
        method: 'POST',
        body: {
          address: addr,
          items: cart.map(({ kind, pizzaId, recipe, qty }) => ({ kind, pizzaId, recipe, qty })),
        },
      });
      new window.Razorpay({
        key: o.key,
        amount: o.amount,
        currency: 'INR',
        name: 'Slice Society',
        description: 'Pizza order',
        order_id: o.razorpayOrderId,
        theme: { color: '#D8341C' },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (r) => {
          try {
            await api('/orders/verify', { method: 'POST', body: { orderId: o.orderId, ...r } });
            clear();
            notify('Payment successful. Your order is confirmed!');
            nav('/dashboard');
          } catch (e) {
            notify(e.message);
            setBusy(false);
          }
        },
      }).open();
    } catch (e) {
      notify(e.message);
      setBusy(false);
    }
  };
  if (!cart.length)
    return (
      <section className="wrap narrow">
        <div className="panel">
          <h2>Your cart is empty</h2>
          <p className="muted">Add a pizza from the menu or build your own.</p>
          <Link className="btn" to="/">
            Browse the menu
          </Link>
        </div>
      </section>
    );
  return (
    <section className="wrap sec">
      <h2>Order summary</h2>
      <div className="builder">
        <div className="panel">
          {cart.map((c) => (
            <div className="line" key={c.key}>
              <div className="mini">
                <Pizza
                  sauce={c.recipe?.sauce}
                  cheese={c.recipe?.cheese}
                  veggies={c.recipe?.veggies}
                />
              </div>
              <div className="grow">
                <b>{c.name}</b>
                <p className="muted small">{recipeText(c.recipe || {})}</p>
                <div className="qty">
                  <button onClick={() => chg(c.key, -1)} aria-label="Fewer">
                    -
                  </button>
                  <span>{c.qty}</span>
                  <button onClick={() => chg(c.key, 1)} aria-label="More">
                    +
                  </button>
                  <button
                    className="link"
                    onClick={() => setCart(cart.filter((x) => x.key !== c.key))}
                  >
                    Remove
                  </button>
                </div>
              </div>
              <b>{rs(c.price * c.qty)}</b>
            </div>
          ))}
        </div>
        <aside className="panel">
          <label>
            Delivery address
            <textarea
              rows="3"
              value={addr}
              onChange={(e) => setAddr(e.target.value)}
              placeholder="House no, street, area, city, pincode"
            />
          </label>
          <div className="row between total">
            <span>Total</span>
            <b className="price">{rs(total)}</b>
          </div>
          <button className="btn full" onClick={pay} disabled={busy}>
            {user ? 'Pay with Razorpay' : 'Log in to pay'}
          </button>
          <p className="muted small">
            Test mode: no real money is charged. Choose any method and click Success.
          </p>
        </aside>
      </div>
    </section>
  );
}

const Tracker = ({ status }) => (
  <ol className="track">
    {STEPS.map((s, i) => (
      <li key={s} className={i <= STEPS.indexOf(status) ? 'done' : ''}>
        <i />
        {s}
      </li>
    ))}
  </ol>
);

export function Dashboard() {
  const { user } = useApp();
  const [orders, setOrders] = useState(null);
  useEffect(() => {
    api('/orders/mine')
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);
  useSocket({
    'order:update': (o) => setOrders((a) => a && a.map((x) => (x._id === o._id ? o : x))),
  });
  return (
    <section className="wrap sec">
      <h2>Hi {user.name}, here are your orders</h2>
      {orders && !orders.length && (
        <div className="panel">
          <p>No orders yet.</p>
          <Link className="btn" to="/">
            Order a pizza
          </Link>
        </div>
      )}
      {orders?.map((o) => (
        <div className="panel order" key={o._id}>
          <div className="row between">
            <b>Order #{o._id.slice(-6)}</b>
            <b className="price">{rs(o.total)}</b>
          </div>
          <p className="muted small">
            {new Date(o.createdAt).toLocaleString()} ·{' '}
            {o.lines.map((l) => `${l.qty} x ${l.name}`).join(', ')}
          </p>
          <Tracker status={o.status} />
        </div>
      ))}
      <h2 style={{ marginTop: 48 }}>Available pizzas</h2>
      <MenuGrid />
    </section>
  );
}

function InvRow({ it, onSave }) {
  const [stock, setStock] = useState(it.stock),
    [th, setTh] = useState(it.threshold);
  useEffect(() => {
    setStock(it.stock);
    setTh(it.threshold);
  }, [it.stock, it.threshold]);
  return (
    <tr className={it.stock < it.threshold ? 'low' : ''}>
      <td>{it.name}</td>
      <td>{it.type}</td>
      <td>
        <input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} />
      </td>
      <td>
        <input type="number" min="0" value={th} onChange={(e) => setTh(e.target.value)} />
      </td>
      <td>
        <button className="btn sm" onClick={() => onSave(it._id, { stock, threshold: th })}>
          Save
        </button>
      </td>
    </tr>
  );
}

export function Admin() {
  const { notify } = useApp(),
    inv = useLocation().pathname.endsWith('/inventory');
  const [orders, setOrders] = useState([]),
    [items, setItems] = useState([]);
  const load = () => {
    api('/admin/orders')
      .then(setOrders)
      .catch((e) => notify(e.message));
    api('/admin/inventory')
      .then(setItems)
      .catch(() => {});
  };
  useEffect(load, []);
  useSocket({
    'order:new': () => {
      load();
      notify('New order received');
    },
  });
  const setStatus = async (id, status) => {
    try {
      const o = await api(`/admin/orders/${id}/status`, { method: 'PUT', body: { status } });
      setOrders((a) => a.map((x) => (x._id === id ? o : x)));
      notify('Status updated');
    } catch (e) {
      notify(e.message);
    }
  };
  const save = async (id, body) => {
    try {
      await api('/admin/inventory/' + id, { method: 'PUT', body });
      notify('Stock updated');
      load();
    } catch (e) {
      notify(e.message);
    }
  };
  const low = items.filter((i) => i.stock < i.threshold).length,
    active = orders.filter((o) => o.status !== STEPS[2]).length;
  return (
    <section className="wrap sec">
      <h2>{inv ? 'Inventory' : 'Incoming orders'}</h2>
      <div className="stats">
        <div>
          <b>{orders.length}</b>
          <span>Paid orders</span>
        </div>
        <div>
          <b>{active}</b>
          <span>Still in progress</span>
        </div>
        <div className={low ? 'warn' : ''}>
          <b>{low}</b>
          <span>Low-stock items</span>
        </div>
      </div>
      {inv ? (
        <div className="panel scroll">
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Type</th>
                <th>Stock</th>
                <th>Alert below</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <InvRow key={it._id} it={it} onSave={save} />
              ))}
            </tbody>
          </table>
          <p className="muted small">
            The admin gets an email when an item falls below its limit. Low items are highlighted.
          </p>
        </div>
      ) : orders.length ? (
        orders.map((o) => (
          <div className="panel order" key={o._id}>
            <div className="row between">
              <b>
                #{o._id.slice(-6)} · {o.user?.name}
              </b>
              <b className="price">{rs(o.total)}</b>
            </div>
            <p className="muted small">
              {o.lines.map((l) => `${l.qty} x ${l.name} (${recipeText(l.recipe)})`).join(' | ')}
            </p>
            <p className="small">Deliver to: {o.address}</p>
            <div className="row">
              {STEPS.map((st) => (
                <button
                  key={st}
                  className={'chip' + (o.status === st ? ' on' : '')}
                  onClick={() => setStatus(o._id, st)}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        ))
      ) : (
        <p>No paid orders yet.</p>
      )}
    </section>
  );
}

export function Profile() {
  const { user, login, notify } = useApp();
  const [me, setMe] = useState(null),
    [name, setName] = useState(''),
    [pw, setPw] = useState({ current: '', password: '' });
  useEffect(() => {
    api('/auth/me')
      .then((d) => {
        setMe(d);
        setName(d.name);
      })
      .catch((e) => notify(e.message));
  }, []);
  const saveName = async (e) => {
    e.preventDefault();
    try {
      const d = await api('/auth/me', { method: 'PUT', body: { name } });
      login(ls.get('token') || '', { ...user, name: d.name });
      notify('Profile updated');
    } catch (x) {
      notify(x.message);
    }
  };
  const savePw = async (e) => {
    e.preventDefault();
    try {
      await api('/auth/password', { method: 'PUT', body: pw });
      setPw({ current: '', password: '' });
      notify('Password changed');
    } catch (x) {
      notify(x.message);
    }
  };
  return (
    <section className="wrap sec">
      <h2>My profile</h2>
      <div className="two">
        <form className="panel" onSubmit={saveName}>
          <div className="av big">{(name || user.name)[0].toUpperCase()}</div>
          <label>
            Full name
            <input required minLength={2} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            Email
            <input value={me?.email || ''} disabled />
          </label>
          {user.role === 'user' && (
            <p className="muted">
              Orders placed: <b>{me?.orders ?? 0}</b>
            </p>
          )}
          <button className="btn">Save changes</button>
        </form>
        <form className="panel" onSubmit={savePw}>
          <h3>Change password</h3>
          <label>
            Current password
            <input
              type="password"
              required
              value={pw.current}
              onChange={(e) => setPw({ ...pw, current: e.target.value })}
            />
          </label>
          <label>
            New password
            <input
              type="password"
              required
              minLength={6}
              value={pw.password}
              onChange={(e) => setPw({ ...pw, password: e.target.value })}
            />
          </label>
          <button className="btn">Update password</button>
        </form>
      </div>
    </section>
  );
}
