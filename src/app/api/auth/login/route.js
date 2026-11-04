import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '@/lib/db';
import { signSession, cookieOptions, COOKIE } from '@/lib/auth';
import { route, json, body } from '@/lib/http';

const schema = z.object({ username: z.string().min(1).max(40), password: z.string().min(1).max(200) });
// A real bcrypt hash of a random string: compared when the user does not exist so response time doesn't reveal valid usernames
const DUMMY_HASH = '$2a$10$CwTycUXWue0Thq9StjUM0uJ8.4oQ0cdsJ5v6hR8zS1sQ4QfXr3p0K';

export const POST = route(null, async (req) => {
  const { username, password } = await body(req, schema);
  const { rows } = await query(
    `SELECT u.user_id, u.username, u.password_hash, u.account_status, u.employee_id, u.passenger_id, r.role_name
     FROM user_account u JOIN role r ON r.role_id = u.role_id WHERE LOWER(u.username) = LOWER(?)`,
    [username]
  );
  const user = rows[0];
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);
  if (!user || !ok) return json({ error: 'Wrong username or password.' }, 401);
  if (user.account_status !== 'ACTIVE') return json({ error: `This account is ${user.account_status.toLowerCase()}. Contact an administrator.` }, 403);

  const token = await signSession({
    userId: user.user_id, username: user.username, role: user.role_name,
    passengerId: user.passenger_id, employeeId: user.employee_id,
  });
  const res = json({ ok: true, role: user.role_name, username: user.username });
  res.cookies.set(COOKIE, token, cookieOptions);
  return res;
});
