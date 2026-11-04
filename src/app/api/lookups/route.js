import { query } from '@/lib/db';
import { route, json } from '@/lib/http';

export const GET = route([], async () => {
  const [airports, airlines, gates] = await Promise.all([
    query('SELECT airport_id, airport_code, airport_name, city FROM airport ORDER BY airport_code'),
    query('SELECT airline_id, airline_code, airline_name FROM airline ORDER BY airline_name'),
    query(`SELECT g.gate_id, a.airport_id, a.airport_code, t.terminal_name, g.gate_number, g.gate_status
           FROM gate g JOIN terminal t ON t.terminal_id = g.terminal_id JOIN airport a ON a.airport_id = t.airport_id
           ORDER BY a.airport_code, t.terminal_name, g.gate_number`),
  ]);
  return json({ airports: airports.rows, airlines: airlines.rows, gates: gates.rows });
});
