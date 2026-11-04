import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { tx } from '@/lib/db';
import { route, json, body } from '@/lib/http';

const schema = z.object({
  first_name: z.string().trim().min(1).max(50),
  last_name: z.string().trim().min(1).max(50),
  date_of_birth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD'),
  passport_number: z.string().trim().min(6).max(12).transform((s) => s.toUpperCase()),
  phone: z.string().trim().regex(/^\+?[0-9]{7,15}$/, 'digits only, 7-15, optional leading +'),
  email: z.string().trim().email().max(120).transform((s) => s.toLowerCase()),
  username: z.string().trim().regex(/^[a-zA-Z0-9_.]{4,40}$/, '4-40 letters, digits, _ or .'),
  password: z.string().min(8).max(100)
    .regex(/[A-Za-z]/, 'must contain a letter').regex(/[0-9]/, 'must contain a digit'),
});

// Creates the passenger profile and the login in ONE transaction: either both exist or neither.
export const POST = route(null, async (req) => {
  const d = await body(req, schema);
  const hash = await bcrypt.hash(d.password, 10);
  await tx(async (c) => {
    const p = await c.query(
      `INSERT INTO passenger (first_name, last_name, date_of_birth, passport_number, phone, email)
       VALUES (?,?,?,?,?,?)`,
      [d.first_name, d.last_name, d.date_of_birth, d.passport_number, d.phone, d.email]
    );
    await c.query(
      `INSERT INTO user_account (role_id, passenger_id, username, email, password_hash)
       VALUES ((SELECT role_id FROM role WHERE role_name = 'PASSENGER'), ?, ?, ?, ?)`,
      [p.insertId, d.username, d.email, hash]
    );
  });
  return json({ ok: true }, 201);
});
