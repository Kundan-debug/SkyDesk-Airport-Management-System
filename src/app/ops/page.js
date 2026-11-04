'use client';
import { useState } from 'react';
import { api, useApi, Alert, Loading, Status, fmtDT } from '@/components/ui';
import { FLIGHT_STATUSES } from '@/lib/constants.mjs';

const REASONS = ['WEATHER', 'CREW_SHORTAGE', 'TECHNICAL_FAULT', 'AIR_TRAFFIC_CONTROL', 'LATE_INBOUND_AIRCRAFT'];

export default function Ops() {
  const flights = useApi('/api/flights?scope=all');
  const lookups = useApi('/api/lookups');
  const [sel, setSel] = useState(null);
  const [msg, setMsg] = useState({ kind: 'ok', text: '' });
  const L = lookups.data;

  async function patch(body) {
    setMsg({ kind: 'ok', text: '' });
    try { await api(`/api/flights/${sel.flight_id}`, { method: 'PATCH', body }); setMsg({ kind: 'ok', text: 'Updated. Event logged to MongoDB.' }); flights.reload(); setSel(null); }
    catch (e) { setMsg({ kind: 'error', text: e.message }); }
  }
  return (
    <>
      <h1>Flight operations</h1>
      <p className="sub">Change status, move gates, record delays. The database refuses clashes and wrong-airport gates.</p>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      {flights.loading ? <Loading /> : flights.error ? <Alert>{flights.error}</Alert> : (
        <div className="tablewrap"><table>
          <thead><tr><th>Flight</th><th>Route</th><th>Departs</th><th>Gate</th><th>Status</th><th className="num">Booked</th><th /></tr></thead>
          <tbody>{flights.data.flights.map((f) => (
            <tr key={f.flight_id}>
              <td><b>{f.flight_number}</b><div className="small muted">{f.airline_name}</div></td>
              <td>{f.dep_code} → {f.arr_code}</td><td>{fmtDT(f.scheduled_departure)}</td>
              <td>{f.terminal_name ? `${f.terminal_name}-${f.gate_number}` : 'TBA'}</td><td><Status value={f.flight_status} /></td>
              <td className="num">{f.seats_booked}/{f.total_seats}</td>
              <td><button className="secondary" onClick={() => setSel(f)}>Manage</button></td>
            </tr>))}</tbody>
        </table></div>)}
      {sel && L && <Manage key={sel.flight_id} flight={sel} gates={L.gates.filter((g) => g.airport_id === sel.dep_airport_id)} onPatch={patch} onClose={() => setSel(null)} />}
      {L && <CreateFlight L={L} onCreated={() => { flights.reload(); setMsg({ kind: 'ok', text: 'Flight created.' }); }} onError={(t) => setMsg({ kind: 'error', text: t })} />}
    </>
  );
}

function Manage({ flight, gates, onPatch, onClose }) {
  const [status, setStatus] = useState(flight.flight_status);
  const [gate, setGate] = useState(flight.gate_id ?? '');
  const [delay, setDelay] = useState('');
  const [reason, setReason] = useState('WEATHER');
  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <h3>Manage {flight.flight_number} ({flight.dep_code} → {flight.arr_code})</h3>
      <div className="grid2">
        <div className="stack">
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>{FLIGHT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <div><button disabled={status === flight.flight_status} onClick={() => onPatch({ flight_status: status, reason })}>Update status</button></div>
          {status === 'CANCELLED' && <p className="small muted">Cancelling cancels every live booking and refunds paid tickets.</p>}
        </div>
        <div className="stack">
          <label>Gate at {flight.dep_code}<select value={gate} onChange={(e) => setGate(e.target.value)}>
            <option value="">Unassigned</option>{gates.map((g) => <option key={g.gate_id} value={g.gate_id}>{g.terminal_name}-{g.gate_number} ({g.gate_status.toLowerCase()})</option>)}</select></label>
          <div><button onClick={() => onPatch({ gate_id: gate === '' ? null : Number(gate) })}>Assign gate</button></div>
        </div>
        <div className="stack">
          <div className="row">
            <label>Delay (minutes)<input type="number" min="1" max="1440" value={delay} onChange={(e) => setDelay(e.target.value)} /></label>
            <label>Reason<select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r} value={r}>{r.replaceAll('_', ' ').toLowerCase()}</option>)}</select></label>
          </div>
          <div><button disabled={!delay} onClick={() => onPatch({ delay_minutes: Number(delay), reason })}>Record delay</button></div>
        </div>
      </div>
      <button className="secondary" style={{ marginTop: 12 }} onClick={onClose}>Close</button>
    </div>
  );
}

function CreateFlight({ L, onCreated, onError }) {
  const tomorrow = new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 16);
  const [f, setF] = useState({ flight_number: '', airline_id: '', departure_airport_id: '', arrival_airport_id: '', gate_id: '', scheduled_departure: tomorrow, scheduled_arrival: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  async function submit(e) {
    e.preventDefault();
    try {
      await api('/api/flights', { method: 'POST', body: {
        flight_number: f.flight_number, airline_id: Number(f.airline_id), departure_airport_id: Number(f.departure_airport_id),
        arrival_airport_id: Number(f.arrival_airport_id), gate_id: f.gate_id ? Number(f.gate_id) : null,
        scheduled_departure: new Date(f.scheduled_departure).toISOString(), scheduled_arrival: new Date(f.scheduled_arrival).toISOString() } });
      onCreated();
    } catch (err) { onError(err.message); }
  }
  const gates = L.gates.filter((g) => String(g.airport_id) === String(f.departure_airport_id));
  return (
    <>
      <h2>Schedule a new flight</h2>
      <p className="small muted">Every flight has 240 seats (rows 1-40, seats A-F). The fare is calculated from the flight duration.</p>
      <form className="panel stack" onSubmit={submit}>
        <div className="row">
          <label>Flight number<input value={f.flight_number} onChange={set('flight_number')} placeholder="AI777" required /></label>
          <label>Airline<select value={f.airline_id} onChange={set('airline_id')} required><option value="">Select…</option>{L.airlines.map((a) => <option key={a.airline_id} value={a.airline_id}>{a.airline_name}</option>)}</select></label>
          <label>From<select value={f.departure_airport_id} onChange={set('departure_airport_id')} required><option value="">Select…</option>{L.airports.map((a) => <option key={a.airport_id} value={a.airport_id}>{a.airport_code} · {a.city}</option>)}</select></label>
          <label>To<select value={f.arrival_airport_id} onChange={set('arrival_airport_id')} required><option value="">Select…</option>{L.airports.map((a) => <option key={a.airport_id} value={a.airport_id}>{a.airport_code} · {a.city}</option>)}</select></label>
          <label>Gate<select value={f.gate_id} onChange={set('gate_id')}><option value="">Assign later</option>{gates.map((g) => <option key={g.gate_id} value={g.gate_id}>{g.terminal_name}-{g.gate_number}</option>)}</select></label>
        </div>
        <div className="row">
          <label>Departure<input type="datetime-local" value={f.scheduled_departure} onChange={set('scheduled_departure')} required /></label>
          <label>Arrival<input type="datetime-local" value={f.scheduled_arrival} onChange={set('scheduled_arrival')} required /></label>
          <button>Create flight</button>
        </div>
      </form>
    </>
  );
}
