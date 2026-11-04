import { query } from '@/lib/db';
import { mongoDb } from '@/lib/mongo';
import { route, json, HttpError } from '@/lib/http';

export const GET = route([], async (_req, ctx, s) => {
  const id = Number(ctx.params.id);
  const own = await query('SELECT passenger_id FROM baggage WHERE baggage_id = ?', [id]);
  if (!own.rows[0]) throw new HttpError(404, 'Baggage not found');
  if (s.role === 'PASSENGER' && own.rows[0].passenger_id !== s.passengerId) throw new HttpError(404, 'Baggage not found');
  const db = await mongoDb();
  const events = await db.collection('baggage_events').find({ baggage_id: id }, { projection: { _id: 0 } }).sort({ ts: 1 }).toArray();
  return json({ events });
});
