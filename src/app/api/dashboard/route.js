import { query } from '@/lib/db';
import { route, json } from '@/lib/http';

export const GET = route([], async (_req, _ctx, s) => {
  if (s.role === 'PASSENGER') {
    const upcoming = await query(
      `SELECT * FROM v_booking_details WHERE passenger_id = ? AND booking_status <> 'CANCELLED'
         AND scheduled_departure >= NOW() ORDER BY scheduled_departure LIMIT 5`, [s.passengerId]);
    return json({ role: s.role, upcoming: upcoming.rows });
  }
  const [kpis, next] = await Promise.all([
    query('SELECT * FROM v_dashboard_kpis'),
    query(`SELECT * FROM v_flight_board WHERE scheduled_departure >= NOW() AND flight_status NOT IN ('CANCELLED','ARRIVED')
           ORDER BY scheduled_departure LIMIT 8`),
  ]);
  return json({ role: s.role, kpis: kpis.rows[0], next: next.rows });
});
