'use client';
import { useApi, Alert, Loading, Empty, money, fmtDay } from '@/components/ui';

const Table = ({ head, rows, num = [] }) => (
  <div className="tablewrap"><table>
    <thead><tr>{head.map((h, i) => <th key={h} className={num.includes(i) ? 'num' : ''}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={num.includes(j) ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
  </table></div>
);
const Bar = ({ pct, color }) => <div className="bar"><i style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} /></div>;

export default function Analytics() {
  const { data, error, loading } = useApi('/api/analytics');
  if (loading) return <Loading />;
  if (error) return <Alert>{error}</Alert>;
  const maxRev = Math.max(1, ...data.airlines.map((a) => Number(a.revenue)));
  const m = data.mongo;

  return (
    <>
      <h1>Analytics</h1>
      <p className="sub">Transactional figures come from MySQL views and queries. Operational event analysis comes from MongoDB aggregation pipelines.</p>

      <h2>Airline performance <span className="small muted">MySQL · view with GROUP BY and COUNT(CASE …)</span></h2>
      <Table head={['Airline', 'Flights', 'Confirmed bookings', 'Delayed', 'Cancelled', 'Revenue', '']} num={[1, 2, 3, 4, 5]}
        rows={data.airlines.map((a) => [<b key="n">{a.airline_name}</b>, a.flights, a.confirmed_bookings, a.delayed_flights, a.cancelled_flights, money(a.revenue), <Bar key="b" pct={(Number(a.revenue) / maxRev) * 100} />])} />

      <div className="grid2">
        <div>
          <h2>Busiest routes <span className="small muted">CTE + window function</span></h2>
          {data.routes.length ? <Table head={['Route', 'Passengers', 'Share']} num={[1, 2]} rows={data.routes.map((r) => [r.route, r.passengers, `${r.pct}%`])} /> : <Empty>No confirmed bookings.</Empty>}
        </div>
        <div>
          <h2>Daily ticket sales <span className="small muted">GROUP BY + HAVING</span></h2>
          {data.daily.length ? <Table head={['Day', 'Tickets', 'Revenue']} num={[1, 2]} rows={data.daily.map((d) => [fmtDay(d.day), d.tickets, money(d.revenue)])} /> : <Empty>No paid tickets.</Empty>}
        </div>
      </div>

      <h2>Delays and baggage flow <span className="small muted">MongoDB · aggregation pipelines</span></h2>
      {data.mongoError && <Alert>MongoDB is not reachable: {data.mongoError}</Alert>}
      {m && (
        <>
          <h3>Departure delay by airline (last 30 days)</h3>
          <Table head={['Airline', 'Departures', 'Avg delay (min)', 'Worst (min)', 'On time (≤15 min)', '']} num={[1, 2, 3, 4]}
            rows={m.delayByAirline.map((a) => [<b key="a">{a._id}</b>, a.departures, a.avg_delay, a.max_delay, `${a.on_time_pct}%`, <Bar key="b" pct={a.on_time_pct} color="var(--green)" />])} />
          <div className="grid2" style={{ marginTop: 20 }}>
            <div><h3>Why flights are delayed</h3>
              <Table head={['Reason', 'Incidents', 'Total minutes']} num={[1, 2]} rows={m.delayReasons.map((r) => [String(r._id ?? 'unspecified').replaceAll('_', ' ').toLowerCase(), r.incidents, r.total_minutes])} /></div>
            <div><h3>Baggage scans per checkpoint</h3>
              <Table head={['Checkpoint', 'Scans', 'Distinct bags']} num={[1, 2]} rows={m.baggageCheckpoints.map((r) => [r._id.replaceAll('_', ' ').toLowerCase(), r.scans, r.distinct_bags])} /></div>
          </div>
        </>
      )}
    </>
  );
}
