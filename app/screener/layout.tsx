import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession, sessionCookie } from '@/lib/access';

export default async function ProtectedScreener({ children }: { children: React.ReactNode }) {
  if (!readSession((await cookies()).get(sessionCookie)?.value)) redirect('/login?next=%2Fscreener');
  return children;
}
