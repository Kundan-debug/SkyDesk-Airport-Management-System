import { NextResponse } from 'next/server';
import { getSession } from './auth';

export const json = (data, status = 200) => NextResponse.json(data, { status });

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

// Friendly messages for named database constraints (matched against MySQL's error text)
const DUPLICATE_MESSAGES = [
  ['uq_flight_instance', 'A flight with this number and departure time already exists.'],
  ['passenger.email', 'That email is already registered.'],
  ['passenger.passport_number', 'That passport number is already registered.'],
  ['user_account.username', 'That username is taken.'],
  ['user_account.email', 'That email is already registered.'],
];
const CHECK_MESSAGES = {
  ck_passport: 'Passport number must be 6-12 capital letters or digits.',
  ck_pax_phone: 'Phone must be 7-15 digits with an optional leading +.',
  ck_pax_email: 'Email address is not valid.',
  ck_seat: 'Seat must look like 14C (rows 1-40, seats A-F).',
  ck_seat_row: 'Seat row must be between 1 and 40.',
  ck_flight_times: 'Arrival must be after departure.',
  ck_flight_route: 'Departure and arrival airports must differ.',
  ck_bag_weight: 'Baggage weight must be between 0 and 50 kg.',
};

export function handleError(e) {
  if (e instanceof HttpError) return json({ error: e.message }, e.status);
  // SIGNAL SQLSTATE '45001' = conflict (seat taken, duplicate booking) -> 409
  if (e?.sqlState === '45001') return json({ error: e.sqlMessage || e.message }, 409);
  // SIGNAL SQLSTATE '45000' raised by our triggers and stored procedures = a business-rule message
  if (e?.sqlState === '45000') return json({ error: e.sqlMessage || e.message }, 400);
  if (e?.code === 'ER_DUP_ENTRY') {
    const hit = DUPLICATE_MESSAGES.find(([k]) => e.sqlMessage?.includes(k));
    return json({ error: hit ? hit[1] : 'That record already exists.' }, 409);
  }
  if (e?.code === 'ER_CHECK_CONSTRAINT_VIOLATED') {
    const name = /'([^']+)'/.exec(e.sqlMessage || '')?.[1];
    return json({ error: CHECK_MESSAGES[name] || e.sqlMessage }, 400);
  }
  if (['ER_NO_REFERENCED_ROW_2', 'ER_BAD_NULL_ERROR', 'ER_DATA_TOO_LONG', 'ER_TRUNCATED_WRONG_VALUE',
       'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD', 'ER_WARN_DATA_OUT_OF_RANGE', 'ER_ROW_IS_REFERENCED_2'].includes(e?.code)) {
    return json({ error: e.sqlMessage || e.message }, 400);
  }
  if (['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT'].includes(e?.code)) {
    return json({ error: 'The system is busy. Please try again.' }, 409);
  }
  console.error(e);
  // In development show the real cause in the browser too; in production keep it generic.
  const detail = process.env.NODE_ENV !== 'production' ? `: ${e?.code ? e.code + ' - ' : ''}${e?.sqlMessage || e?.message || e}` : '';
  return json({ error: 'Internal server error' + detail }, 500);
}

/**
 * Wrap a route handler with authentication + role-based authorisation.
 * roles = null  -> public
 * roles = []    -> any signed-in user
 * roles = ['ADMIN'] -> only those roles
 */
export function route(roles, handler) {
  return async (req, ctx) => {
    try {
      const session = await getSession();
      if (roles) {
        if (!session) return json({ error: 'Please sign in.' }, 401);
        if (roles.length && !roles.includes(session.role)) return json({ error: 'You do not have access to this.' }, 403);
      }
      return await handler(req, ctx, session);
    } catch (e) {
      return handleError(e);
    }
  };
}

export async function body(req, schema) {
  let data;
  try { data = await req.json(); } catch { throw new HttpError(400, 'Request body must be JSON'); }
  const r = schema.safeParse(data);
  if (!r.success) {
    const first = r.error.issues[0];
    throw new HttpError(400, `${first.path.join('.') || 'input'}: ${first.message}`);
  }
  return r.data;
}

// Airport staff use the ADMIN role in this project (two roles: ADMIN and PASSENGER)
export const STAFF = ['ADMIN'];
