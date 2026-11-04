import mysql from 'mysql2/promise';

// One pool per server process (survives Next.js hot reload in dev). Credentials come from env only.
const g = globalThis;
function makePool() {
  const pool = mysql.createPool({
    uri: process.env.DATABASE_URL,
    connectionLimit: 10,
    timezone: 'Z',          // JS Dates <-> DATETIME in UTC
    decimalNumbers: true,   // DECIMAL columns come back as numbers, not strings
  });
  // every pooled connection works in UTC so NOW() / CURDATE() agree with the app
  pool.pool.on('connection', (conn) => conn.query("SET time_zone = '+00:00'"));
  return pool;
}
export const pool = g.__skydeskPool ?? makePool();
if (process.env.NODE_ENV !== 'production') g.__skydeskPool = pool;

// Normalise mysql2's result shapes: SELECT -> rows, CALL ... -> first result set, INSERT/UPDATE -> header
function shape([r]) {
  if (Array.isArray(r)) {
    const rows = Array.isArray(r[0]) ? r[0] : r;
    return { rows, rowCount: rows.length, insertId: undefined };
  }
  return { rows: [], rowCount: r.affectedRows, insertId: r.insertId };
}

// ALWAYS pass user input through ? placeholders (prevents SQL injection)
export const query = async (sql, params = []) => shape(await pool.query(sql, params));

// Run several statements as one ACID transaction
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn({ query: async (sql, params = []) => shape(await conn.query(sql, params)) });
    await conn.commit();
    return result;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
