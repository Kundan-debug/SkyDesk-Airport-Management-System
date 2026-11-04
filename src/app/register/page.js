'use client';
import { useState } from 'react';
import Link from 'next/link';
import { api, Alert } from '@/components/ui';

const empty = { first_name: '', last_name: '', date_of_birth: '', passport_number: '', phone: '', email: '', username: '', password: '' };

export default function Register() {
  const [f, setF] = useState(empty);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setError('');
    try { await api('/api/auth/register', { method: 'POST', body: f }); setDone(true); }
    catch (err) { setError(err.message); }
  }
  if (done) return (
    <div className="panel narrow"><h1>Account created</h1><p><Link href="/login">Sign in</Link> to book your first flight.</p></div>
  );
  return (
    <div className="panel narrow" style={{ maxWidth: 640 }}>
      <h1>Create a passenger account</h1>
      <p className="sub">Your passport number and phone are validated by the database before anything is saved.</p>
      <form className="stack" onSubmit={submit}>
        <div className="row">
          <label>First name<input value={f.first_name} onChange={set('first_name')} required /></label>
          <label>Last name<input value={f.last_name} onChange={set('last_name')} required /></label>
        </div>
        <div className="row">
          <label>Date of birth<input type="date" value={f.date_of_birth} onChange={set('date_of_birth')} required /></label>
          <label>Passport number<input value={f.passport_number} onChange={set('passport_number')} placeholder="N1234567" required /></label>
        </div>
        <div className="row">
          <label>Phone<input value={f.phone} onChange={set('phone')} placeholder="+919800000000" required /></label>
          <label>Email<input type="email" value={f.email} onChange={set('email')} required /></label>
        </div>
        <div className="row">
          <label>Username<input value={f.username} onChange={set('username')} autoComplete="username" required /></label>
          <label>Password (8+ characters, letter and digit)<input type="password" value={f.password} onChange={set('password')} autoComplete="new-password" required /></label>
        </div>
        <Alert>{error}</Alert>
        <button>Create account</button>
      </form>
      <p className="small muted">Already registered? <Link href="/login">Sign in</Link></p>
    </div>
  );
}
