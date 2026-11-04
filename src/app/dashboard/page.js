'use client';
import Link from 'next/link';
import { useApi, Alert, Loading, Empty, Status, fmtDT, fmtTime, money } from '@/components/ui';

export default function Dashboard() {
  const { data, error, loading } = useApi('/api/dashboard');
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;

  if (data.role === 'PASSENGER') return (
    <>
      <h1>Your trips</h1>
      <p className="sub">Your upcoming flights.</p>
      <div>
        <div>
          <h3>Upcoming bookings</h3>
          {data.upcoming.length === 0 ? <Empty>No upcoming trips. <Link href="/flights">Find a flight</Link>.</Empty> : (
            <div className="tablewrap"><table>
              <thead><tr><th>Flight</th><th>Route</th><th>Departs</th><th>Seat</th><th>Status</th></tr></thead>
              <tbody>{data.upcoming.map((b) => (
                <tr key={b.booking_id}>
                  <td><b>{b.flight_number}</b></td><td>{b.dep_code} → {b.arr_code}</td><td>{fmtDT(b.scheduled_departure)}</td>
                  <td>{b.seat_number}</td><td><Status value={b.booking_status} /> {b.flight_status === 'DELAYED' && <Status value="DELAYED" />}</td>
                </tr>))}</tbody>
            </table></div>)}
        </div>
      </div>
    </>
  );

  const k = data.kpis;
  return (
    <>
      <h1>Operations today</h1>
      <p className="sub">Live figures from MySQL views.</p>
      <div className="kpis">
        <div className="kpi good"><b>{k.upcoming_flights}</b><span>Upcoming flights</span></div>
        <div className={`kpi ${Number(k.delayed_flights) ? 'warn' : ''}`}><b>{k.delayed_flights}</b><span>Delayed flights</span></div>
        <div className="kpi"><b>{k.confirmed_bookings}</b><span>Confirmed bookings</span></div>
        <div className="kpi"><b>{k.pending_bookings}</b><span>Awaiting payment</span></div>
        <div className="kpi"><b>{money(k.revenue)}</b><span>Ticket revenue</span></div>
        <div className={`kpi ${Number(k.lost_baggage) ? 'bad' : ''}`}><b>{k.lost_baggage}</b><span>Bags reported lost</span></div>
      </div>
      <h2>Next departures</h2>
      <div className="tablewrap board"><table>
        <thead><tr><th>Time</th><th>Flight</th><th>To</th><th>Gate</th><th>Status</th><th className="num">Seats left</th></tr></thead>
        <tbody>{data.next.map((f) => (
          <tr key={f.flight_id}>
            <td className="time">{fmtTime(f.scheduled_departure)}</td><td className="code">{f.flight_number}</td>
            <td>{f.arr_city}</td><td className="code">{f.terminal_name ? `${f.terminal_name}-${f.gate_number}` : 'TBA'}</td>
            <td><Status value={f.flight_status} /></td><td className="num">{f.seats_available}</td>
          </tr>))}</tbody>
      </table></div>
    </>
  );
}
