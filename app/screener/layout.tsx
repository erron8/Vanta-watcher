import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookie } from '@/lib/access';
import { authenticateSession } from '@/lib/authorize';

export default async function ProtectedScreener({ children }: { children: React.ReactNode }) {
  if (!await authenticateSession((await cookies()).get(sessionCookie)?.value)) redirect('/login?next=%2Fscreener');
  return children;
}
