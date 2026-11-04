'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, useApi, Alert, Empty, Loading, Status, fmtDay, fmtTime, money } from '@/components/ui';
import { CLASS_MULTIPLIER, TRAVEL_CLASSES, PAYMENT_METHODS, FLIGHT_STATUSES } from '@/lib/constants.mjs';

export default function Flights() {
  const me = useApi('/api/auth/me');
  const lookups = useApi('/api/lookups');
  const [filters, setFilters] = useState({ from: '', to: '', date: '', airline: '', status: '', q: '' });
  const qs = useMemo(() => new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString(), [filters]);
  const flights = useApi(`/api/flights?${qs}`);
  const [sel, setSel] = useState(null);
  const set = (k) => (e) => setFilters({ ...filters, [k]: e.target.value });
  const isPassenger = me.data?.role === 'PASSENGER';
  const L = lookups.data;

  return (
    <>
      <h1>Flights</h1>
      <p className="sub">Search the departure board. Seat counts come straight from the database.</p>
      <div className="panel">
        <div className="row">
          <label>From<select value={filters.from} onChange={set('from')}><option value="">Anywhere</option>{L?.airports.map((a) => <option key={a.airport_id} value={a.airport_code}>{a.city} ({a.airport_code})</option>)}</select></label>
          <label>To<select value={filters.to} onChange={set('to')}><option value="">Anywhere</option>{L?.airports.map((a) => <option key={a.airport_id} value={a.airport_code}>{a.city} ({a.airport_code})</option>)}</select></label>
          <label>Date<input type="date" value={filters.date} onChange={set('date')} /></label>
          <label>Airline<select value={filters.airline} onChange={set('airline')}><option value="">All</option>{L?.airlines.map((a) => <option key={a.airline_id} value={a.airline_code}>{a.airline_name}</option>)}</select></label>
          <label>Status<select value={filters.status} onChange={set('status')}><option value="">Any</option>{FLIGHT_STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
          <label>Search<input value={filters.q} onChange={set('q')} placeholder="flight no., city, airline" /></label>
          <button className="secondary" onClick={() => setFilters({ from: '', to: '', date: '', airline: '', status: '', q: '' })}>Clear</button>
        </div>
      </div>

      <h2>Departures</h2>
      {flights.loading ? <Loading /> : flights.error ? <Alert>{flights.error}</Alert> : flights.data.flights.length === 0 ? <Empty>No flights match these filters.</Empty> : (
        <div className="tablewrap board"><table>
          <thead><tr><th>Date</th><th>Time</th><th>Flight</th><th>From → To</th><th>Gate</th><th>Status</th><th className="num">Seats left</th><th className="num">From</th>{isPassenger && <th />}</tr></thead>
          <tbody>{flights.data.flights.map((f) => (
            <tr key={f.flight_id} className={sel?.flight_id === f.flight_id ? 'selected' : ''}>
              <td>{fmtDay(f.scheduled_departure)}</td><td className="time">{fmtTime(f.scheduled_departure)}</td>
              <td><span className="code">{f.flight_number}</span><div className="city">{f.airline_name}</div></td>
              <td><span className="code">{f.dep_code}</span> → <span className="code">{f.arr_code}</span><div className="city">{f.dep_city} to {f.arr_city}</div></td>
              <td className="code">{f.terminal_name ? `${f.terminal_name}-${f.gate_number}` : 'TBA'}</td>
              <td><Status value={f.flight_status} /></td>
              <td className="num">{f.seats_available}</td><td className="num">{money(f.base_fare)}</td>
              {isPassenger && <td><button className="secondary" disabled={!['SCHEDULED', 'DELAYED'].includes(f.flight_status) || f.seats_available < 1} onClick={() => setSel(f)}>Book</button></td>}
            </tr>))}</tbody>
        </table></div>)}

      {sel && <BookingPanel flight={sel} onClose={() => { setSel(null); flights.reload(); }} />}
    </>
  );
}

function BookingPanel({ flight, onClose }) {
  const [taken, setTaken] = useState([]);
  const [f, setF] = useState({ seat_number: '', travel_class: 'ECONOMY', payment_method: 'UPI', pay_now: true });
  const [msg, setMsg] = useState({ kind: '', text: '' });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => { api(`/api/flights/${flight.flight_id}`).then((d) => setTaken(d.taken_seats)).catch(() => {}); }, [flight.flight_id]);
  const price = Math.round(Number(flight.base_fare) * CLASS_MULTIPLIER[f.travel_class]);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMsg({ kind: '', text: '' });
    try {
      const r = await api('/api/bookings', { method: 'POST', body: { flight_id: flight.flight_id, ...f } });
      setMsg({ kind: 'ok', text: `Booked seat ${r.booking.seat_number} on ${r.booking.flight_number}. Status: ${r.booking.booking_status.toLowerCase()}.` });
      setDone(true);
    } catch (err) { setMsg({ kind: 'error', text: err.message }); }
    setBusy(false);
  }
  return (
    <div className="panel" style={{ marginTop: 20 }}>
      <h3>Book {flight.flight_number}: {flight.dep_city} → {flight.arr_city}</h3>
      <form className="stack" onSubmit={submit}>
        <div className="row">
          <label>Seat (row 1-40, A-F, e.g. 14C)<input value={f.seat_number} onChange={(e) => setF({ ...f, seat_number: e.target.value.toUpperCase() })} maxLength={3} required /></label>
          <label>Class<select value={f.travel_class} onChange={(e) => setF({ ...f, travel_class: e.target.value })}>{TRAVEL_CLASSES.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label>Pay with<select value={f.payment_method} onChange={(e) => setF({ ...f, payment_method: e.target.value })}>{PAYMENT_METHODS.map((c) => <option key={c}>{c}</option>)}</select></label>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><input type="checkbox" checked={f.pay_now} onChange={(e) => setF({ ...f, pay_now: e.target.checked })} /> Pay now</label>
        </div>
        <div className="small muted">Fare: <b>{money(price)}</b>. Seats already taken: {taken.length ? taken.join(', ') : 'none'}.</div>
        <Alert kind={msg.kind || 'error'}>{msg.text}</Alert>
        <div className="row" style={{ justifyContent: 'flex-start' }}>
          {!done && <button className="amber" disabled={busy}>{busy ? 'Booking…' : f.pay_now ? `Pay ${money(price)} and book` : 'Reserve seat'}</button>}
          {done && <Link href="/bookings"><button type="button">View my bookings</button></Link>}
          <button type="button" className="secondary" onClick={onClose}>Close</button>
        </div>
      </form>
    </div>
  );
}
