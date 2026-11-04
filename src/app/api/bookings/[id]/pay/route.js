import { query } from '@/lib/db';
import { route, json, HttpError } from '@/lib/http';

// Simulated payment gateway: marks the pending payment as paid. A trigger confirms the booking.
export const POST = route(['PASSENGER'], async (_req, ctx, s) => {
  const id = Number(ctx.params.id);
  const own = await query('SELECT 1 FROM booking WHERE booking_id = ? AND passenger_id = ?', [id, s.passengerId]);
  if (!own.rowCount) throw new HttpError(404, 'Booking not found');
  await query('CALL sp_process_payment(?, 1)', [id]);
  const { rows } = await query('SELECT * FROM v_booking_details WHERE booking_id = ?', [id]);
  return json({ booking: rows[0] });
});
