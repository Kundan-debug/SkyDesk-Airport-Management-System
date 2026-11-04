'use client';
import { useState } from 'react';
import { api, useApi, Alert, Empty, Loading, Status, fmtDT, money } from '@/components/ui';

export default function Bookings() {
  const me = useApi('/api/auth/me');
  const [status, setStatus] = useState('');
  const { data, error, loading, reload } = useApi(`/api/bookings${status ? `?status=${status}` : ''}`);
  const [msg, setMsg] = useState({ kind: 'ok', text: '' });
  const isPassenger = me.data?.role === 'PASSENGER';

  async function act(id, what) {
    if (what === 'cancel' && !confirm('Cancel this booking? A paid ticket will be refunded.')) return;
    setMsg({ kind: 'ok', text: '' });
    try {
      await api(`/api/bookings/${id}/${what}`, { method: 'POST' });
      setMsg({ kind: 'ok', text: what === 'pay' ? 'Payment received. Booking confirmed.' : 'Booking cancelled.' });
      reload();
    } catch (e) { setMsg({ kind: 'error', text: e.message }); }
  }
  return (
    <>
      <h1>{isPassenger ? 'My bookings' : 'All bookings'}</h1>
      <p className="sub">Payment and cancellation rules (refunds, baggage lock) are enforced by database triggers.</p>
      <div className="row" style={{ marginBottom: 12 }}>
        <label style={{ maxWidth: 200 }}>Show<select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option><option>PENDING</option><option>CONFIRMED</option><option>CANCELLED</option></select></label>
      </div>
      <Alert kind={msg.kind}>{msg.text}</Alert>
      {loading ? <Loading /> : error ? <Alert>{error}</Alert> : data.bookings.length === 0 ? <Empty>No bookings yet.</Empty> : (
        <div className="tablewrap"><table>
          <thead><tr><th>#</th>{!isPassenger && <th>Passenger</th>}<th>Flight</th><th>Route</th><th>Departs</th><th>Seat</th><th>Booking</th><th>Payment</th><th className="num">Amount</th><th /></tr></thead>
          <tbody>{data.bookings.map((b) => (
            <tr key={b.booking_id}>
              <td>{b.booking_id}</td>{!isPassenger && <td>{b.passenger_name}</td>}
              <td><b>{b.flight_number}</b><div className="small muted">{b.airline_name}</div></td>
              <td>{b.dep_code} → {b.arr_code}</td><td>{fmtDT(b.scheduled_departure)}</td>
              <td>{b.seat_number} <span className="small muted">{b.travel_class.toLowerCase()}</span></td>
              <td><Status value={b.booking_status} /></td>
              <td><Status value={b.payment_status} /><div className="small muted">{b.transaction_reference}</div></td>
              <td className="num">{money(b.amount)}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                {isPassenger && b.booking_status === 'PENDING' && b.payment_status === 'PENDING' && <button className="amber" onClick={() => act(b.booking_id, 'pay')}>Pay now</button>}{' '}
                {b.booking_status !== 'CANCELLED' && <button className="danger" onClick={() => act(b.booking_id, 'cancel')}>Cancel</button>}
              </td>
            </tr>))}</tbody>
        </table></div>)}
    </>
  );
}
