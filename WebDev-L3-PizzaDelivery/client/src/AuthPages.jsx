import React, { useEffect, useRef, useState } from 'react';
import { UserRound, ArrowRight, Mail, LockKeyhole, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { request } from './api.js';

function PasswordField({ value, onChange, show, setShow, autoComplete, label = 'Password' }) {
  return <label>{label}<div className="input-wrap"><LockKeyhole size={17} />
    <input name="password" type={show ? 'text' : 'password'} value={value} onChange={onChange} required minLength="6" placeholder="At least 6 characters" autoComplete={autoComplete} />
    <button type="button" className="show-pass" onClick={() => setShow(!show)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></label>;
}

export function AuthPage({ mode, setMode, urlAction, setUrlAction, onLoggedIn, setNotice }) {
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState(null); // { kind, text, devLink, email }
  const ran = useRef(false);
  const set = e => setForm({ ...form, [e.target.name]: e.target.value });
  const switchMode = m => { setMode(m); setError(''); setInfo(null); };

  async function verifyToken(token) {
    setBusy(true); setError('');
    try {
      const d = await request('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) });
      setUrlAction(null); onLoggedIn(d);
    } catch (e) { setUrlAction(null); setMode('login'); setError(e.message); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    if (ran.current) return; ran.current = true;
    if (urlAction?.type === 'verify') verifyToken(urlAction.token);
    else if (urlAction?.type === 'reset') setMode('reset');
  }, []);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError(''); setInfo(null);
    const email = form.email.trim().toLowerCase();
    try {
      if (mode === 'signup') {
        const d = await request('/auth/signup', { method: 'POST', body: JSON.stringify({ name: form.name, email, password: form.password }) });
        setInfo({ kind: 'verify', text: d.message, devLink: d.devLink, email });
        setForm({ name: '', email: '', password: '' });
      } else if (mode === 'forgot') {
        const d = await request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
        setInfo({ kind: 'reset', text: d.message, devLink: d.devLink });
      } else if (mode === 'reset') {
        await request('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token: urlAction.token, password: form.password }) });
        setUrlAction(null); setForm({ name: '', email: '', password: '' }); setMode('login'); setNotice('Password updated. You can now log in.');
      } else {
        onLoggedIn(await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: form.password }) }));
      }
    } catch (err) {
      if (err.data?.needsVerification) setInfo({ kind: 'unverified', text: err.message, email });
      else setError(err.message);
    } finally { setBusy(false); }
  }

  async function resend(email) {
    setBusy(true);
    try {
      const d = await request('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) });
      setInfo({ kind: 'verify', text: d.message, devLink: d.devLink, email });
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  const tokenFrom = (link, key) => new URL(link).searchParams.get(key);

  const titles = { login: 'Welcome back', signup: 'Create your account', forgot: 'Forgot your password?', reset: 'Set a new password' };
  const subs = {
    login: 'Your pizza plans are right where you left them.',
    signup: 'Join the table. We will email you a link to verify your account.',
    forgot: 'Enter your email and we will send you a reset link.',
    reset: 'Choose a new password for your account.'
  };

  return <section className="auth-layout"><div className="auth-art"><div className="eyebrow"><span className="eyebrow-line"></span> WELCOME TO THE TABLE</div><h2>Your next favourite<br />moment is <em>one slice away.</em></h2><p>Sign in to keep track of your orders, save your favourites, and get straight to the good stuff.</p><div className="auth-illustration">🍕<span>✦</span><i>✳</i></div><div className="auth-art-foot">GOOD FOOD. GOOD MOOD. GOOD COMPANY.</div></div>
    <div className="auth-card"><div className="auth-card-head"><div className="auth-icon"><UserRound /></div><h2>{titles[mode] || titles.login}</h2><p>{subs[mode] || subs.login}</p></div>
      {info ? <div className="auth-info">
        <div className="info-icon">{info.kind === 'reset' ? '🔑' : '✉️'}</div>
        <h3>{info.kind === 'verify' ? 'Check your inbox' : info.kind === 'unverified' ? 'Email not verified yet' : 'Reset link ready'}</h3>
        <p>{info.text}</p>
        {info.devLink && <div className="dev-link-box"><small>Email is not set up on this server, so here is your link:</small>
          {info.kind === 'reset'
            ? <button className="primary-btn full-btn" onClick={() => { setUrlAction({ type: 'reset', token: tokenFrom(info.devLink, 'reset') }); setInfo(null); setMode('reset'); }}>Open reset page <ArrowRight size={17} /></button>
            : <button className="primary-btn full-btn" disabled={busy} onClick={() => verifyToken(tokenFrom(info.devLink, 'verify'))}>{busy ? 'Verifying…' : 'Verify my email now'} <ArrowRight size={17} /></button>}
        </div>}
        {info.kind === 'unverified' && <button className="outline-btn full-btn" disabled={busy} onClick={() => resend(info.email)}>{busy ? 'Please wait…' : 'Resend verification link'}</button>}
        <button type="button" className="forgot-link" onClick={() => switchMode('login')}>← Back to login</button>
      </div> :
        <form onSubmit={submit} className="auth-form">
          {error && <div className="form-error" role="alert">{error}</div>}
          {mode === 'signup' && <label>Full name<div className="input-wrap"><UserRound size={17} /><input name="name" value={form.name} onChange={set} required minLength="2" placeholder="Your name" autoComplete="name" /></div></label>}
          {(mode === 'login' || mode === 'signup' || mode === 'forgot') && <label>Email address<div className="input-wrap"><Mail size={17} /><input name="email" type="email" value={form.email} onChange={set} required placeholder="you@example.com" autoComplete="email" /></div></label>}
          {mode !== 'forgot' && <PasswordField value={form.password} onChange={set} show={show} setShow={setShow} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} label={mode === 'reset' ? 'New password' : 'Password'} />}
          {mode === 'login' && <button type="button" className="forgot-link" onClick={() => switchMode('forgot')}>Forgot password?</button>}
          <button className="primary-btn full-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : mode === 'reset' ? 'Update password' : 'Log in'} <ArrowRight size={17} /></button>
          <div className="auth-switch">{mode === 'forgot' || mode === 'reset' ? <>Remembered it? <button type="button" onClick={() => { setUrlAction(null); switchMode('login'); }}>Back to login</button></> : mode === 'signup' ? <>Already have an account? <button type="button" onClick={() => switchMode('login')}>Log in</button></> : <>New to SliceCraft? <button type="button" onClick={() => switchMode('signup')}>Create account</button></>}</div>
        </form>}
      <div className="secure-note"><ShieldCheck size={15} /> Your account is protected with encrypted passwords.</div></div></section>;
}

export function AdminLogin({ onLoggedIn, goHome }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    try { onLoggedIn(await request('/auth/admin-login', { method: 'POST', body: JSON.stringify({ email: form.email.trim().toLowerCase(), password: form.password }) })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <section className="auth-layout admin-login"><div className="auth-art"><div className="eyebrow"><span className="eyebrow-line"></span> STAFF ONLY</div><h2>Welcome to the<br /><em>control room.</em></h2><p>Manage incoming orders, track ingredient stock and keep the kitchen running smoothly.</p><div className="auth-illustration">🧑‍🍳<span>✦</span><i>✳</i></div><div className="auth-art-foot">SEPARATE FROM THE CUSTOMER LOGIN</div></div>
    <div className="auth-card"><div className="auth-card-head"><div className="auth-icon"><ShieldCheck /></div><h2>Admin login</h2><p>Only administrators can sign in here.</p></div>
      <form onSubmit={submit} className="auth-form">
        {error && <div className="form-error" role="alert">{error}</div>}
        <label>Admin email<div className="input-wrap"><Mail size={17} /><input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="admin@slicecraft.local" autoComplete="username" /></div></label>
        <PasswordField value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} show={show} setShow={setShow} autoComplete="current-password" />
        <button className="primary-btn full-btn" disabled={busy}>{busy ? 'Please wait…' : 'Enter admin portal'} <ArrowRight size={17} /></button>
        <div className="auth-switch"><button type="button" onClick={goHome}>← Back to the store</button></div>
      </form>
      <div className="secure-note"><ShieldCheck size={15} /> Admin accounts are not created through customer sign-up.</div></div></section>;
}
