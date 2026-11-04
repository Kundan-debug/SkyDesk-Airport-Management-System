import { z } from 'zod';
import { query } from '@/lib/db';
import { logEvents } from '@/lib/mongo';
import { route, json, body, HttpError, STAFF } from '@/lib/http';
import { BAGGAGE_CHECKPOINT } from '@/lib/constants.mjs';

const schema = z.object({
  status: z.enum(['SECURITY_SCREENED', 'LOADED', 'IN_TRANSIT', 'ARRIVED', 'CLAIMED', 'LOST']),
  notes: z.string().trim().max(200).optional(),
});

// A checkpoint scan: MySQL keeps the CURRENT status; MongoDB keeps the full scan history.
export const POST = route(STAFF, async (req, ctx, s) => {
  const id = Number(ctx.params.id);
  const d = await body(req, schema);
  const found = await query('SELECT baggage_id FROM baggage WHERE baggage_id = ?', [id]);
  if (!found.rows[0]) throw new HttpError(404, 'Baggage not found');
  await query('UPDATE baggage SET baggage_status = ? WHERE baggage_id = ?', [d.status, id]);
  const bag = (await query('SELECT baggage_id, baggage_tag, flight_id, baggage_status FROM baggage WHERE baggage_id = ?', [id])).rows[0];
  await logEvents('baggage_events', {
    baggage_id: bag.baggage_id, baggage_tag: bag.baggage_tag, flight_id: bag.flight_id,
    checkpoint: BAGGAGE_CHECKPOINT[d.status], status: d.status, scanned_by: s.username, notes: d.notes ?? null,
  });
  return json({ baggage: bag });
});
