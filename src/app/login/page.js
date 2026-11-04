'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, Alert } from '@/components/ui';

export default function Login() {
  const router = useRouter();
  const [f, setF] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api('/api/auth/login', { method: 'POST', body: f });
      router.push('/dashboard');
      router.refresh();
    } catch (err) { setError(err.message); setBusy(false); }
  }
  return (
    <div className="panel narrow">
      <h1>Sign in</h1>
      <p className="sub">Passengers, airport staff and administrators use the same door.</p>
      <form className="stack" onSubmit={submit}>
        <label>Username<input value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} autoComplete="username" required /></label>
        <label>Password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="current-password" required /></label>
        <Alert>{error}</Alert>
        <button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="small muted">New passenger? <Link href="/register">Create an account</Link></p>
    </div>
  );
}
