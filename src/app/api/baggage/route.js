import { z } from 'zod';
import { query } from '@/lib/db';
import { logEvents } from '@/lib/mongo';
import { route, json, body, HttpError, STAFF } from '@/lib/http';

export const GET = route([], async (_req, _ctx, s) => {
  const params = [];
  let where = '';
  if (s.role === 'PASSENGER') { params.push(s.passengerId); where = 'WHERE passenger_id = ?'; }
  const { rows } = await query(`SELECT * FROM v_baggage_tracking ${where} ORDER BY baggage_id DESC LIMIT 200`, params);
  return json({ baggage: rows });
});

const schema = z.object({ booking_id: z.number().int().positive(), weight: z.number().positive().max(50) });

// Admin checks a bag in against a CONFIRMED booking (the database trigger enforces the class allowance).
export const POST = route(STAFF, async (req, _ctx, s) => {
  const d = await body(req, schema);
  const b = await query('SELECT passenger_id, flight_id FROM booking WHERE booking_id = ?', [d.booking_id]);
  if (!b.rows[0]) throw new HttpError(404, 'Booking not found');
  const ins = await query('INSERT INTO baggage (passenger_id, flight_id, weight) VALUES (?,?,?)',
    [b.rows[0].passenger_id, b.rows[0].flight_id, d.weight]);
  const bag = (await query('SELECT baggage_id, baggage_tag, baggage_status FROM baggage WHERE baggage_id = ?', [ins.insertId])).rows[0];
  await logEvents('baggage_events', {
    baggage_id: bag.baggage_id, baggage_tag: bag.baggage_tag, flight_id: b.rows[0].flight_id,
    checkpoint: 'CHECK_IN_COUNTER', status: 'CHECKED_IN', scanned_by: s.username, notes: `Weighed ${d.weight} kg`,
  });
  return json({ baggage: bag }, 201);
});
