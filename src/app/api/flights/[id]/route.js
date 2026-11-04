import { z } from 'zod';
import { query, tx } from '@/lib/db';
import { logEvents } from '@/lib/mongo';
import { route, json, body, HttpError, STAFF } from '@/lib/http';
import { FLIGHT_STATUSES } from '@/lib/constants.mjs';

const idOf = (ctx) => {
  const id = Number(ctx.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(400, 'Invalid flight id');
  return id;
};

export const GET = route([], async (_req, ctx) => {
  const id = idOf(ctx);
  const f = await query('SELECT * FROM v_flight_board WHERE flight_id = ?', [id]);
  if (!f.rows[0]) throw new HttpError(404, 'Flight not found');
  const seats = await query(`SELECT seat_number FROM booking WHERE flight_id = ? AND booking_status <> 'CANCELLED' ORDER BY 1`, [id]);
  return json({ flight: f.rows[0], taken_seats: seats.rows.map((r) => r.seat_number) });
});

const patch = z.object({
  flight_status: z.enum(FLIGHT_STATUSES).optional(),
  gate_id: z.number().int().positive().nullable().optional(),
  delay_minutes: z.number().int().min(1).max(1440).optional(),
  reason: z.string().trim().max(120).optional(),
});

// Admin: change status / gate / delay. SQL is the source of truth; Mongo gets the event history.
export const PATCH = route(STAFF, async (req, ctx, s) => {
  const id = idOf(ctx);
  const d = await body(req, patch);
  const actor = { user_id: s.userId, username: s.username, role: s.role };

  const before = await query('SELECT * FROM v_flight_board WHERE flight_id = ?', [id]);
  const old = before.rows[0];
  if (!old) throw new HttpError(404, 'Flight not found');

  const status = d.delay_minutes ? 'DELAYED' : d.flight_status;
  await tx(async (c) => {
    if (d.delay_minutes) {
      await c.query(
        `UPDATE flight SET scheduled_departure = DATE_ADD(scheduled_departure, INTERVAL ? MINUTE),
                           scheduled_arrival   = DATE_ADD(scheduled_arrival,   INTERVAL ? MINUTE)
         WHERE flight_id = ?`, [d.delay_minutes, d.delay_minutes, id]);
    }
    if (status) await c.query('UPDATE flight SET flight_status = ? WHERE flight_id = ?', [status, id]);
    if (d.gate_id !== undefined) await c.query('UPDATE flight SET gate_id = ? WHERE flight_id = ?', [d.gate_id, id]);
  });

  const after = (await query('SELECT * FROM v_flight_board WHERE flight_id = ?', [id])).rows[0];
  const base = { flight_id: id, flight_number: old.flight_number, airline_code: old.airline_code, actor };
  const events = [];
  if (status && status !== old.flight_status) {
    events.push({ ...base, event_type: 'STATUS_CHANGE', old_value: old.flight_status, new_value: status, meta: { reason: d.reason ?? null } });
  }
  if (d.delay_minutes) {
    events.push({ ...base, event_type: 'DELAY', delay_minutes: d.delay_minutes, meta: { reason: d.reason ?? 'UNSPECIFIED' } });
  }
  if (d.gate_id !== undefined && (after.gate_number !== old.gate_number)) {
    events.push({ ...base, event_type: 'GATE_CHANGE', old_value: old.gate_number, new_value: after.gate_number });
  }
  if (status === 'DEPARTED') {
    events.push({ ...base, event_type: 'DEPARTURE_ACTUAL', delay_minutes: 0, meta: { reason: null } });
  }
  await logEvents('flight_events', events);
  return json({ flight: after });
});
