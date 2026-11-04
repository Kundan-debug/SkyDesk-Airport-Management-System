// Usage: (server running)  npm run test:api
// Black-box tests of auth, roles, validation and database-enforced rules through the real HTTP API.
import 'dotenv/config';

const BASE = process.env.BASE_URL || 'http://localhost:3000';
let pass = 0, fail = 0;

async function call(method, url, { cookie, data } = {}) {
  const res = await fetch(BASE + url, {
    method, redirect: 'manual',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  let j = null; try { j = await res.json(); } catch {}
  return { status: res.status, body: j, setCookie: res.headers.get('set-cookie') };
}
async function login(username, password) {
  const r = await call('POST', '/api/auth/login', { data: { username, password } });
  return r.setCookie ? r.setCookie.split(';')[0] : null;
}
function check(id, name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${id}  ${name}${cond ? '' : '  -> ' + extra}`);
  cond ? pass++ : fail++;
}

const adminPw = process.env.DEMO_ADMIN_PASSWORD, paxPw = process.env.DEMO_PASSENGER_PASSWORD;
if (!adminPw || !paxPw) { console.error('Set DEMO_ADMIN_PASSWORD and DEMO_PASSENGER_PASSWORD in .env (same values used for db:setup).'); process.exit(1); }

// --- authentication ---
let r = await call('GET', '/api/flights');
check('TC-01', 'Unauthenticated request is rejected (401)', r.status === 401, r.status);
r = await call('POST', '/api/auth/login', { data: { username: 'arjun', password: 'wrong-password-1' } });
check('TC-02', 'Wrong password is rejected (401)', r.status === 401, r.status);
const pax = await login('arjun', paxPw);
const admin = await login('admin', adminPw);
check('TC-03', 'Valid logins succeed for passenger and admin', pax && admin);

// --- authorisation ---
r = await call('GET', '/api/analytics', { cookie: pax });
check('TC-04', 'Passenger cannot open analytics (403)', r.status === 403, r.status);
r = await call('GET', '/api/analytics', { cookie: admin });
check('TC-05', 'Admin can open analytics (200)', r.status === 200, r.status);
r = await call('POST', '/api/flights', { cookie: pax, data: {} });
check('TC-06', 'Passenger cannot create flights (403)', r.status === 403, r.status);

// --- search and ownership ---
r = await call('GET', '/api/flights?from=BLR&to=DEL', { cookie: pax });
check('TC-07', 'Flight search BLR->DEL returns results', r.status === 200 && r.body.flights.length > 0, r.status);
const qp = (await call('GET', '/api/flights?from=BLR&to=HYD', { cookie: pax })).body.flights[0];
const bom = (await call('GET', '/api/flights?from=BLR&to=BOM', { cookie: pax })).body.flights[0];
r = await call('GET', '/api/bookings', { cookie: pax });
check('TC-08', 'Passenger sees only their own bookings', r.status === 200 && r.body.bookings.length > 0 && new Set(r.body.bookings.map((b) => b.passenger_id)).size === 1);

// --- booking rules enforced by the database ---
r = await call('POST', '/api/bookings', { cookie: pax, data: { flight_id: qp.flight_id, seat_number: '14B', travel_class: 'ECONOMY', payment_method: 'UPI' } });
check('TC-09', 'Booking an already-taken seat fails (409)', r.status === 409, `${r.status} ${JSON.stringify(r.body)}`);
r = await call('POST', '/api/bookings', { cookie: pax, data: { flight_id: qp.flight_id, seat_number: 'ZZ', travel_class: 'ECONOMY', payment_method: 'UPI' } });
check('TC-10', 'Invalid seat format is rejected (400)', r.status === 400, r.status);
r = await call('POST', '/api/bookings', { cookie: pax, data: { flight_id: qp.flight_id, seat_number: '41A', travel_class: 'ECONOMY', payment_method: 'UPI' } });
check('TC-17', 'Seat row 41 (outside the 40-row layout) is rejected by the database CHECK (400)', r.status === 400, `${r.status} ${JSON.stringify(r.body)}`);
r = await call('POST', '/api/bookings', { cookie: pax, data: { flight_id: bom.flight_id, seat_number: '31F', travel_class: 'ECONOMY', payment_method: 'CARD', pay_now: true } });
const ok = r.status === 201 && r.body.booking.booking_status === 'CONFIRMED' && r.body.booking.payment_status === 'SUCCESS';
check('TC-11', 'Book + pay: booking CONFIRMED, payment SUCCESS (trigger)', ok, `${r.status} ${JSON.stringify(r.body)}`);
if (ok) {
  const id = r.body.booking.booking_id;
  r = await call('POST', `/api/bookings/${id}/cancel`, { cookie: pax });
  check('TC-12', 'Cancel: booking CANCELLED and payment REFUNDED (trigger)', r.status === 200 && r.body.booking.booking_status === 'CANCELLED' && r.body.booking.payment_status === 'REFUNDED', JSON.stringify(r.body));
  r = await call('POST', `/api/bookings/${id}/cancel`, { cookie: pax });
  check('TC-13', 'Cancelling twice is rejected (400)', r.status === 400, r.status);
}

// --- admin operations and integrity ---
const all = (await call('GET', '/api/bookings?status=CONFIRMED', { cookie: admin })).body.bookings;
const vikram = all.find((b) => b.passenger_email === 'vikram.singh@example.com');
r = await call('POST', '/api/baggage', { cookie: admin, data: { booking_id: vikram.booking_id, weight: 10 } });
check('TC-14', 'Overweight baggage (25+10 kg > 30 kg economy) is rejected (400)', r.status === 400, `${r.status} ${JSON.stringify(r.body)}`);
const lk = await call('GET', '/api/lookups', { cookie: admin });
const delGate = lk.body.gates.find((g) => g.airport_code === 'DEL');
r = await call('PATCH', `/api/flights/${bom.flight_id}`, { cookie: admin, data: { gate_id: delGate.gate_id } });
check('TC-15', 'Assigning a gate from another airport is rejected (400)', r.status === 400, `${r.status} ${JSON.stringify(r.body)}`);
r = await call('GET', '/api/flights?q=hyderabad', { cookie: pax });
check('TC-16', 'Free-text flight search finds Hyderabad flights', r.status === 200 && r.body.flights.length > 0, r.status);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
