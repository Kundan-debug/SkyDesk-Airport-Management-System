import { query } from '@/lib/db';
import { route, json } from '@/lib/http';

// Passengers can cancel only their own bookings; admins can cancel any. A trigger refunds the payment.
export const POST = route([], async (_req, ctx, s) => {
  const id = Number(ctx.params.id);
  await query('CALL sp_cancel_booking(?, ?)', [id, s.role === 'PASSENGER' ? s.passengerId : null]);
  const { rows } = await query('SELECT * FROM v_booking_details WHERE booking_id = ?', [id]);
  return json({ booking: rows[0] });
});
