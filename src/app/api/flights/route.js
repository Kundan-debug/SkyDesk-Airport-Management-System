import { z } from 'zod';
import { query } from '@/lib/db';
import { logEvents } from '@/lib/mongo';
import { route, json, body, STAFF } from '@/lib/http';

// GET /api/flights?from=BLR&to=DEL&date=2026-11-02&airline=AI&status=SCHEDULED&q=text&scope=all
export const GET = route([], async (req, _ctx, s) => {
  const sp = new URL(req.url).searchParams;
  const where = [];
  const params = [];
  const add = (sql, v) => { where.push(sql); params.push(v); };

  if (sp.get('from')) add('dep_code = ?', sp.get('from').toUpperCase());
  if (sp.get('to')) add('arr_code = ?', sp.get('to').toUpperCase());
  if (sp.get('date')) add('DATE(scheduled_departure) = ?', sp.get('date'));
  if (sp.get('airline')) add('airline_code = ?', sp.get('airline').toUpperCase());
  if (sp.get('status')) add('flight_status = ?', sp.get('status').toUpperCase());
  if (sp.get('q')) {
    const like = `%${sp.get('q')}%`;
    where.push('(flight_number LIKE ? OR dep_city LIKE ? OR arr_city LIKE ? OR airline_name LIKE ?)');
    params.push(like, like, like, like);
  }
  // passengers only see flights that have not left yet; admins can look back 3 days
  if (s.role === 'PASSENGER' || sp.get('scope') !== 'all') where.push('scheduled_departure >= NOW()');
  else where.push('scheduled_departure >= DATE_SUB(NOW(), INTERVAL 3 DAY)');

  const { rows } = await query(
    `SELECT * FROM v_flight_board ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY scheduled_departure LIMIT 200`, params);
  return json({ flights: rows });
});

const schema = z.object({
  flight_number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}[0-9]{1,4}$/, 'like AI501'),
  airline_id: z.number().int().positive(),
  departure_airport_id: z.number().int().positive(),
  arrival_airport_id: z.number().int().positive(),
  gate_id: z.number().int().positive().nullable().optional(),
  scheduled_departure: z.string().min(10),
  scheduled_arrival: z.string().min(10),
});

export const POST = route(STAFF, async (req, _ctx, s) => {
  const d = await body(req, schema);
  const dep = new Date(d.scheduled_departure);
  const arr = new Date(d.scheduled_arrival);
  if (isNaN(dep) || isNaN(arr)) return json({ error: 'Invalid departure or arrival time' }, 400);
  const r = await query(
    `INSERT INTO flight (flight_number, airline_id, departure_airport_id, arrival_airport_id, gate_id,
                         scheduled_departure, scheduled_arrival)
     VALUES (?,?,?,?,?,?,?)`,
    [d.flight_number, d.airline_id, d.departure_airport_id, d.arrival_airport_id, d.gate_id ?? null, dep, arr]
  );
  await logEvents('flight_events', {
    flight_id: r.insertId, flight_number: d.flight_number, event_type: 'STATUS_CHANGE',
    old_value: null, new_value: 'SCHEDULED', actor: { user_id: s.userId, username: s.username, role: s.role },
  });
  return json({ flight: { flight_id: r.insertId, flight_number: d.flight_number } }, 201);
});
