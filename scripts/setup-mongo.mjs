// Usage: npm run mongo:setup  (run AFTER db:setup)  -> creates collections, validators, indexes, sample events
import 'dotenv/config';
import mysql from 'mysql2/promise';
import { MongoClient } from 'mongodb';
import { BAGGAGE_FLOW, BAGGAGE_CHECKPOINT } from '../src/lib/constants.mjs';

for (const v of ['DATABASE_URL', 'MONGODB_URI']) if (!process.env[v]) { console.error(`${v} is not set`); process.exit(1); }

const sql = await mysql.createConnection({ uri: process.env.DATABASE_URL, timezone: 'Z', decimalNumbers: true });
await sql.query("SET time_zone = '+00:00'");
const mongo = await new MongoClient(process.env.MONGODB_URI).connect();
const db = mongo.db(process.env.MONGODB_DB || 'skydesk');

// deterministic pseudo-random so every run produces the same demo data
let seed = 42;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const num = ['int', 'long', 'double'];

async function recreate(name, validator, indexes) {
  await db.collection(name).drop().catch(() => {});
  await db.createCollection(name, { validator: { $jsonSchema: validator }, validationLevel: 'strict', validationAction: 'error' });
  for (const [keys, opts] of indexes) await db.collection(name).createIndex(keys, opts);
}

await recreate('flight_events', {
  bsonType: 'object', required: ['flight_id', 'flight_number', 'event_type', 'ts'],
  properties: {
    flight_id: { bsonType: num }, flight_number: { bsonType: 'string' }, airline_code: { bsonType: 'string' },
    event_type: { enum: ['STATUS_CHANGE', 'GATE_CHANGE', 'DELAY', 'DEPARTURE_ACTUAL'] },
    delay_minutes: { bsonType: num, minimum: 0 }, ts: { bsonType: 'date' },
  },
}, [[{ flight_id: 1, ts: -1 }], [{ event_type: 1, airline_code: 1 }], [{ ts: -1 }]]);

await recreate('baggage_events', {
  bsonType: 'object', required: ['baggage_id', 'baggage_tag', 'checkpoint', 'ts'],
  properties: { baggage_id: { bsonType: num }, baggage_tag: { bsonType: 'string' }, checkpoint: { bsonType: 'string' }, ts: { bsonType: 'date' } },
}, [[{ baggage_id: 1, ts: 1 }], [{ checkpoint: 1 }]]);

const DAY = 86400000;
const now = Date.now();
const flightEvents = [];

// 1) lifecycle events for every real flight in MySQL
const [flights] = await sql.query(`SELECT f.flight_id, f.flight_number, a.airline_code, f.scheduled_departure, f.scheduled_arrival, f.flight_status
                                  FROM flight f JOIN airline a ON a.airline_id = f.airline_id`);
for (const f of flights) {
  const base = { flight_id: f.flight_id, flight_number: f.flight_number, airline_code: f.airline_code, actor: { username: 'system', role: 'ADMIN' } };
  const dep = new Date(f.scheduled_departure).getTime();
  flightEvents.push({ ...base, event_type: 'STATUS_CHANGE', old_value: null, new_value: 'SCHEDULED', ts: new Date(dep - 7 * DAY) });
  if (f.flight_status === 'ARRIVED') {
    const delay = Math.floor(rnd() * 40);
    flightEvents.push({ ...base, event_type: 'DEPARTURE_ACTUAL', delay_minutes: delay, meta: { reason: delay > 15 ? 'LATE_INBOUND_AIRCRAFT' : null }, ts: new Date(dep + delay * 60000) });
    flightEvents.push({ ...base, event_type: 'STATUS_CHANGE', old_value: 'SCHEDULED', new_value: 'DEPARTED', ts: new Date(dep + delay * 60000) });
    flightEvents.push({ ...base, event_type: 'STATUS_CHANGE', old_value: 'DEPARTED', new_value: 'ARRIVED', ts: new Date(new Date(f.scheduled_arrival).getTime() + delay * 60000) });
  } else if (f.flight_status === 'CANCELLED') {
    flightEvents.push({ ...base, event_type: 'STATUS_CHANGE', old_value: 'SCHEDULED', new_value: 'CANCELLED', meta: { reason: 'TECHNICAL_FAULT' }, ts: new Date(dep - 3 * 3600000) });
  } else if (f.flight_status === 'DELAYED') {
    flightEvents.push({ ...base, event_type: 'DELAY', delay_minutes: 90, meta: { reason: 'WEATHER' }, ts: new Date(now - 3600000) });
    flightEvents.push({ ...base, event_type: 'STATUS_CHANGE', old_value: 'SCHEDULED', new_value: 'DELAYED', meta: { reason: 'WEATHER' }, ts: new Date(now - 3600000) });
  }
}

// 2) 30 days of synthetic history so the analytics charts have something to aggregate
const airlines = ['AI', '6E', 'QP', 'SG', 'EK', 'SQ'];
const typical = { AI: 28, '6E': 12, QP: 9, SG: 35, EK: 14, SQ: 8 };
const reasons = ['WEATHER', 'CREW_SHORTAGE', 'TECHNICAL_FAULT', 'AIR_TRAFFIC_CONTROL', 'LATE_INBOUND_AIRCRAFT'];
for (let i = 0; i < 180; i++) {
  const al = pick(airlines);
  const delay = Math.max(0, Math.round(typical[al] * (rnd() * 2 - 0.4)));
  const ts = new Date(now - Math.floor(rnd() * 30) * DAY - Math.floor(rnd() * DAY));
  const base = { flight_id: 10000 + i, flight_number: `${al}${100 + Math.floor(rnd() * 800)}`, airline_code: al, synthetic: true };
  flightEvents.push({ ...base, event_type: 'DEPARTURE_ACTUAL', delay_minutes: delay, meta: { reason: delay > 15 ? pick(reasons) : null }, ts });
  if (delay > 15) flightEvents.push({ ...base, event_type: 'DELAY', delay_minutes: delay, meta: { reason: pick(reasons) }, ts });
}
await db.collection('flight_events').insertMany(flightEvents);

// 3) baggage scan history: one event per checkpoint passed so far
const [bags] = await sql.query('SELECT baggage_id, baggage_tag, flight_id, baggage_status FROM baggage');
const baggageEvents = [];
for (const b of bags) {
  const steps = b.baggage_status === 'LOST' ? BAGGAGE_FLOW.slice(0, 3).concat('LOST') : BAGGAGE_FLOW.slice(0, BAGGAGE_FLOW.indexOf(b.baggage_status) + 1);
  steps.forEach((st, i) => baggageEvents.push({
    baggage_id: b.baggage_id, baggage_tag: b.baggage_tag, flight_id: b.flight_id, checkpoint: BAGGAGE_CHECKPOINT[st], status: st,
    scanned_by: pick(['admin']), notes: null, ts: new Date(now - (steps.length - i) * 20 * 60000),
  }));
}
if (baggageEvents.length) await db.collection('baggage_events').insertMany(baggageEvents);

console.log(`MongoDB ready: ${flightEvents.length} flight_events, ${baggageEvents.length} baggage_events`);
await sql.end();
await mongo.close();
