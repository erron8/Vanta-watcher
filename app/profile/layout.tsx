import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sessionCookie } from '@/lib/access';
import { authenticateSession } from '@/lib/authorize';

export default async function ProfileLayout({ children }: { children: React.ReactNode }) {
  if (!await authenticateSession((await cookies()).get(sessionCookie)?.value)) redirect('/login?next=%2Fprofile');
  return children;
}
