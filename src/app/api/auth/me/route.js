import { route, json } from '@/lib/http';
export const GET = route([], async (_req, _ctx, s) => json({ username: s.username, role: s.role, passengerId: s.passengerId, employeeId: s.employeeId }));
