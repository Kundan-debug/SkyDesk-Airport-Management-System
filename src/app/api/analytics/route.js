import { query } from '@/lib/db';
import { mongoDb } from '@/lib/mongo';
import { route, json, STAFF } from '@/lib/http';

export const GET = route(STAFF, async () => {
  const [kpis, airlines, routes, daily] = await Promise.all([
    query('SELECT * FROM v_dashboard_kpis'),
    query('SELECT * FROM v_airline_performance ORDER BY revenue DESC'),
    // CTE + window function: share of confirmed passengers per route
    query(`WITH route_load AS (
              SELECT CONCAT(dep_code, ' → ', arr_code) AS route, COUNT(*) AS passengers
              FROM v_booking_details WHERE booking_status = 'CONFIRMED' GROUP BY route)
           SELECT route, passengers, ROUND(100.0 * passengers / SUM(passengers) OVER (), 1) AS pct
           FROM route_load ORDER BY passengers DESC LIMIT 8`),
    // GROUP BY + HAVING: only days with at least one paid ticket
    query(`SELECT DATE(payment_date) AS day, COUNT(*) AS tickets, SUM(amount) AS revenue
           FROM payment WHERE payment_status = 'SUCCESS'
           GROUP BY DATE(payment_date) HAVING COUNT(*) >= 1 ORDER BY day DESC LIMIT 14`),
  ]);

  let mongo = null;
  let mongoError = null;
  try {
    const db = await mongoDb();
    const [delayByAirline, delayReasons, baggageCheckpoints, eventsByType] = await Promise.all([
      // Average / worst departure delay per airline
      db.collection('flight_events').aggregate([
        { $match: { event_type: 'DEPARTURE_ACTUAL' } },
        { $group: { _id: '$airline_code', departures: { $sum: 1 }, avg_delay: { $avg: '$delay_minutes' }, max_delay: { $max: '$delay_minutes' },
                    on_time: { $sum: { $cond: [{ $lte: ['$delay_minutes', 15] }, 1, 0] } } } },
        { $addFields: { on_time_pct: { $round: [{ $multiply: [{ $divide: ['$on_time', '$departures'] }, 100] }, 1] }, avg_delay: { $round: ['$avg_delay', 1] } } },
        { $sort: { avg_delay: -1 } },
      ]).toArray(),
      // Why do delays happen?
      db.collection('flight_events').aggregate([
        { $match: { event_type: 'DELAY' } },
        { $group: { _id: '$meta.reason', incidents: { $sum: 1 }, total_minutes: { $sum: '$delay_minutes' } } },
        { $sort: { total_minutes: -1 } }, { $limit: 6 },
      ]).toArray(),
      // How many scans pass each baggage checkpoint?
      db.collection('baggage_events').aggregate([
        { $group: { _id: '$checkpoint', scans: { $sum: 1 }, bags: { $addToSet: '$baggage_id' } } },
        { $project: { scans: 1, distinct_bags: { $size: '$bags' } } },
        { $sort: { scans: -1 } },
      ]).toArray(),
      db.collection('flight_events').aggregate([{ $group: { _id: '$event_type', n: { $sum: 1 } } }, { $sort: { n: -1 } }]).toArray(),
    ]);
    mongo = { delayByAirline, delayReasons, baggageCheckpoints, eventsByType };
  } catch (e) {
    mongoError = e.message;
  }
  return json({ kpis: kpis.rows[0], airlines: airlines.rows, routes: routes.rows, daily: daily.rows, mongo, mongoError });
});
