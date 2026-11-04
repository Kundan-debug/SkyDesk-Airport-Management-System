import { z } from 'zod';
import { query } from '@/lib/db';
import { route, json, body, HttpError } from '@/lib/http';
import { TRAVEL_CLASSES, PAYMENT_METHODS } from '@/lib/constants.mjs';

export const GET = route([], async (req, _ctx, s) => {
  const status = new URL(req.url).searchParams.get('status');
  const params = [];
  const where = [];
  if (s.role === 'PASSENGER') { where.push('passenger_id = ?'); params.push(s.passengerId); }
  if (status) { where.push('booking_status = ?'); params.push(status.toUpperCase()); }
  const { rows } = await query(
    `SELECT * FROM v_booking_details ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY booking_date DESC, booking_id DESC LIMIT 200`, params);
  return json({ bookings: rows });
});

const schema = z.object({
  flight_id: z.number().int().positive(),
  seat_number: z.string().trim().toUpperCase().regex(/^[0-9]{1,2}[A-F]$/, 'like 14C (rows 1-40, seats A-F)'),
  travel_class: z.enum(TRAVEL_CLASSES),
  payment_method: z.enum(PAYMENT_METHODS),
  pay_now: z.boolean().default(true),
});

// Passenger books a seat. The stored procedure sp_book_flight does booking + payment (+ "pay now")
// inside ONE database transaction, so a failure leaves nothing behind.
export const POST = route(['PASSENGER'], async (req, _ctx, s) => {
  const d = await body(req, schema);
  if (!s.passengerId) throw new HttpError(400, 'Your account is not linked to a passenger profile');
  const r = await query('CALL sp_book_flight(?,?,?,?,?,?)',
    [s.passengerId, d.flight_id, d.seat_number, d.travel_class, d.payment_method, d.pay_now ? 1 : 0]);
  const { rows } = await query('SELECT * FROM v_booking_details WHERE booking_id = ?', [r.rows[0].booking_id]);
  return json({ booking: rows[0] }, 201);
});
