'use client';
import { useState } from 'react';
import { api, useApi, Alert, Empty, Loading, Status, fmtDT } from '@/components/ui';

const NEXT_STATES = ['SECURITY_SCREENED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'CLAIMED', 'LOST'];

export default function Baggage() {
  const me = useApi('/api/auth/me');
  const bags = useApi('/api/baggage');
  const confirmed = useApi('/api/bookings?status=CONFIRMED');
  const isStaff = me.data?.role === 'ADMIN';
  const [msg, setMsg] = useState({ kind: 'ok', text: '' });
  const [history, setHistory] = useState(null);
  const [form, setForm] = useState({ booking_id: '', weight: '' });
  const [scan, setScan] = useState({});

  async function checkIn(e) {
    e.preventDefault();
    try {
      const r = await api('/api/baggage', { method: 'POST', body: { booking_id: Number(form.booking_id), weight: Number(form.weight) } });
      setMsg({ kind: 'ok', text: `Bag ${r.baggage.baggage_tag} checked in.` });
      setForm({ booking_id: '', weight: '' }); bags.reload();
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
  }
  async function doScan(b) {
    const status = scan[b.baggage_id];
    if (!status) return;
    try {
      await api(`/api/baggage/${b.baggage_id}/scan`, { method: 'POST', body: { status } });
      setMsg({ kind: 'ok', text: `${b.baggage_tag} scanned: ${status.replaceAll('_', ' ').toLowerCase()}.` });
      bags.reload();
      if (history?.bag === b.baggage_tag) showHistory(b);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
  }
  async function showHistory(b) {
    try { const r = await api(`/api/baggage/${b.baggage_id}/history`); setHistory({ bag: b.baggage_tag, events: r.events }); }
    catch (err) { setMsg({ kind: 'error', text: err.message }); }
  }
  return (
    <>
      <h1>Baggage</h1>
      <p className="sub">Current status lives in MySQL. Every scan is stored as an event in MongoDB, which powers the trail below.</p>
      <Alert kind={msg.kind}>{msg.text}</Alert>

      {isStaff && (
        <div className="panel" style={{ marginBottom: 20 }}>
          <h3>Check in a bag</h3>
          <form className="row" onSubmit={checkIn}>
            <label>Confirmed booking<select value={form.booking_id} onChange={(e) => setForm({ ...form, booking_id: e.target.value })} required>
              <option value="">Select…</option>
              {confirmed.data?.bookings.map((b) => <option key={b.booking_id} value={b.booking_id}>#{b.booking_id} · {b.passenger_name} · {b.flight_number} · {b.travel_class.toLowerCase()}</option>)}
            </select></label>
            <label style={{ maxWidth: 140 }}>Weight (kg)<input type="number" step="0.1" min="0.1" max="50" value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} required /></label>
            <button>Check in bag</button>
          </form>
          <p className="small muted" style={{ margin: '8px 0 0' }}>Allowance per passenger: economy 30 kg, business 40 kg, first 50 kg. The database rejects anything heavier.</p>
        </div>
      )}

      {bags.loading ? <Loading /> : bags.error ? <Alert>{bags.error}</Alert> : bags.data.baggage.length === 0 ? <Empty>No baggage on record.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Tag</th>{isStaff && <th>Passenger</th>}<th>Flight</th><th>Route</th><th className="num">Weight</th><th>Status</th><th />{isStaff && <th>Scan checkpoint</th>}</tr></thead>
          <tbody>{bags.data.baggage.map((b) => (
            <tr key={b.baggage_id}>
              <td><b>{b.baggage_tag}</b></td>{isStaff && <td>{b.passenger_name}</td>}
              <td>{b.flight_number}</td><td>{b.dep_code} → {b.arr_code}</td><td className="num">{b.weight} kg</td>
              <td><Status value={b.baggage_status} /></td>
              <td><button className="secondary" onClick={() => showHistory(b)}>Trail</button></td>
              {isStaff && <td style={{ whiteSpace: 'nowrap' }}>
                <select value={scan[b.baggage_id] || ''} onChange={(e) => setScan({ ...scan, [b.baggage_id]: e.target.value })}>
                  <option value="">Next status…</option>{NEXT_STATES.map((s) => <option key={s} value={s}>{s.replaceAll('_', ' ').toLowerCase()}</option>)}
                </select>{' '}<button onClick={() => doScan(b)} disabled={!scan[b.baggage_id]}>Scan</button>
              </td>}
            </tr>))}</tbody>
        </table></div>)}

      {history && (
        <div className="panel" style={{ marginTop: 20 }}>
          <h3>Trail for {history.bag}</h3>
          {history.events.length === 0 ? <p className="muted">No scans recorded.</p> : (
            <ul className="timeline">{history.events.map((e, i) => (
              <li key={i}><b>{e.checkpoint.replaceAll('_', ' ').toLowerCase()}</b> · <Status value={e.status} />
                <div className="small muted">{fmtDT(e.ts)} · scanned by {e.scanned_by}{e.notes ? ` · ${e.notes}` : ''}</div></li>))}</ul>)}
        </div>)}
    </>
  );
}
