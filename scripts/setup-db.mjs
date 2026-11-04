// Usage: npm run db:setup  -> creates the MySQL database, runs the SQL files, loads seed data, creates demo logins
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const sqlDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const FILES = ['01_schema.sql', '02_programmability.sql', '03_views.sql', '04_seed.sql'];

if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is not set (copy .env.example to .env)'); process.exit(1); }
const url = new URL(process.env.DATABASE_URL);
const dbName = url.pathname.replace('/', '') || 'skydesk';

// Split a .sql file into statements. Understands the mysql client's "DELIMITER" command,
// which is how stored procedures and triggers are written.
function splitSql(text) {
  const out = [];
  let delim = ';';
  let buf = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^DELIMITER\s+/i.test(line)) { delim = line.split(/\s+/)[1]; continue; }
    if (!buf && (line === '' || line.startsWith('--'))) continue;
    buf += raw + '\n';
    if (line.endsWith(delim)) { out.push(buf.trim().slice(0, -delim.length).trim()); buf = ''; }
  }
  if (buf.trim()) out.push(buf.trim());
  return out.filter(Boolean);
}

const conn = await mysql.createConnection({
  host: url.hostname, port: Number(url.port || 3306),
  user: decodeURIComponent(url.username), password: decodeURIComponent(url.password),
  timezone: 'Z',
});
await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
await conn.query(`USE \`${dbName}\``);
await conn.query("SET time_zone = '+00:00'");

let current = '';
try {
  for (const f of FILES) {
    process.stdout.write(`Running ${f} ... `);
    for (const stmt of splitSql(fs.readFileSync(path.join(sqlDir, f), 'utf8'))) { current = stmt; await conn.query(stmt); }
    console.log('ok');
  }
} catch (e) {
  console.error('\nFAILED:', e.sqlMessage || e.message);
  console.error('Statement:', current.slice(0, 300));
  if (/SUPER|log_bin_trust/i.test(e.message)) console.error('Hint: run  SET GLOBAL log_bin_trust_function_creators = 1;  as root, or use the Docker setup.');
  await conn.end();
  process.exit(1);
}

// ---- demo accounts (passwords are bcrypt-hashed; plain text is never stored) ----
const pw = (envName) => {
  const given = process.env[envName];
  if (given) return { plain: given, shown: '(from .env)' };
  const generated = crypto.randomBytes(9).toString('base64url') + '9a';
  return { plain: generated, shown: generated };
};
const adminPw = pw('DEMO_ADMIN_PASSWORD');
const paxPw = pw('DEMO_PASSENGER_PASSWORD');

const adminInsert = `INSERT INTO user_account (role_id, employee_id, username, email, password_hash)
  SELECT r.role_id, e.employee_id, ?, e.email, ? FROM employee e, role r WHERE e.email = ? AND r.role_name = 'ADMIN'`;
const paxInsert = `INSERT INTO user_account (role_id, passenger_id, username, email, password_hash)
  SELECT r.role_id, p.passenger_id, ?, p.email, ? FROM passenger p, role r WHERE p.email = ? AND r.role_name = 'PASSENGER'`;

for (const [username, p, sql, email] of [
  ['admin', adminPw, adminInsert, 'kavita.sharma@skydesk.example'],
  ['arjun', paxPw, paxInsert, 'arjun.mehta@example.com'],
  ['priya', paxPw, paxInsert, 'priya.nair@example.com'],
]) {
  await conn.query(sql, [username, await bcrypt.hash(p.plain, 10), email]);
}
await conn.end();

console.log('\nDemo logins created:');
console.log(`  admin   / ${adminPw.shown}     (ADMIN: airport staff)`);
console.log(`  arjun   / ${paxPw.shown}     (PASSENGER)  also: priya`);
console.log('\nNote these now - only hashes are stored.');
