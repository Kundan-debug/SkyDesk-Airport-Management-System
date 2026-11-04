'use client';
import { useCallback, useEffect, useState } from 'react';

export async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export function useApi(url) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true }));
    try { setState({ data: await api(url), error: null, loading: false }); }
    catch (e) { setState({ data: null, error: e.message, loading: false }); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

export const fmtDT = (s) => (s ? new Date(s).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
export const fmtTime = (s) => (s ? new Date(s).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }) : '—');
export const fmtDay = (s) => (s ? new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
export const money = (n) => '₹' + Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function Status({ value }) {
  if (!value) return null;
  return <span className={`badge b-${String(value).toLowerCase()}`}>{String(value).replaceAll('_', ' ').toLowerCase()}</span>;
}
export function Alert({ kind = 'error', children }) {
  if (!children) return null;
  return <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>{children}</div>;
}
export const Empty = ({ children }) => <div className="empty">{children}</div>;
export const Loading = () => <p className="muted">Loading…</p>;
