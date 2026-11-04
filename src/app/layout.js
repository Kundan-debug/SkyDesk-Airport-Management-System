import './globals.css';
import { getSession } from '@/lib/auth';
import Nav from '@/components/Nav';

export const metadata = { title: 'SkyDesk - Airport Management', description: 'Flights, bookings and baggage in one place' };

export default async function RootLayout({ children }) {
  const session = await getSession();
  return (
    <html lang="en">
      <body>
        <Nav user={session ? { username: session.username, role: session.role } : null} />
        <main className="page">{children}</main>
      </body>
    </html>
  );
}
