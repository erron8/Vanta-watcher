import { Layers3, LockKeyhole } from 'lucide-react';
import Link from 'next/link';
import { LoginForm } from './login-form';
import { safeDestination } from '@/lib/access';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <main className="login-shell">
    <Link className="login-brand" href="/"><Layers3 size={24} strokeWidth={2.5} /> Vanta</Link>
    <section className="login-card" aria-labelledby="login-title">
      <span className="login-icon"><LockKeyhole size={21} /></span>
      <p className="login-eyebrow">PRIVATE WORKSPACE</p>
      <h1 id="login-title">Welcome back.</h1>
      <p>Sign in to open the wallet screener and your bookmarks.</p>
      <LoginForm next={safeDestination(next)} />
    </section>
  </main>;
}
