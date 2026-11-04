import { route, json } from '@/lib/http';
import { COOKIE } from '@/lib/auth';

export const POST = route(null, async () => {
  const res = json({ ok: true });
  res.cookies.set(COOKIE, '', { path: '/', maxAge: 0 });
  return res;
});
