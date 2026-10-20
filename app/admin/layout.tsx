import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookie } from '@/lib/access';
import { authenticateSession } from '@/lib/authorize';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const identity = await authenticateSession((await cookies()).get(sessionCookie)?.value);
  if (!identity) redirect('/login?next=%2Fadmin');
  if (!identity.isAdmin) redirect('/screener');
  return children;
}
