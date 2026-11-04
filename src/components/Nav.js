'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', roles: ['ADMIN', 'PASSENGER'] },
  { href: '/flights', label: 'Flights', roles: ['ADMIN', 'PASSENGER'] },
  { href: '/bookings', label: 'Bookings', roles: ['ADMIN', 'PASSENGER'] },
  { href: '/baggage', label: 'Baggage', roles: ['ADMIN', 'PASSENGER'] },
  { href: '/ops', label: 'Flight operations', roles: ['ADMIN'] },
  { href: '/analytics', label: 'Analytics', roles: ['ADMIN'] },
];

export default function Nav({ user }) {
  const path = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <header className="topbar">
      <Link href="/" className="brand">Sky<span>Desk</span></Link>
      <nav aria-label="Main">
        {user && LINKS.filter((l) => l.roles.includes(user.role)).map((l) => (
          <Link key={l.href} href={l.href} className={path.startsWith(l.href) ? 'active' : ''}>{l.label}</Link>
        ))}
      </nav>
      {user && (
        <div className="who">
          <span><b>{user.username}</b> · {user.role.toLowerCase()}</span>
          <button className="secondary" onClick={logout}>Sign out</button>
        </div>
      )}
    </header>
  );
}
