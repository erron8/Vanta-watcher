'use client';
import { useState, type FormEvent } from 'react';

export function LoginForm({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: form.get('username'), password: form.get('password'), next }) });
      const data = await response.json() as { error?: string; next?: string };
      if (!response.ok || !data.next) throw new Error(data.error || 'Sign-in failed.');
      window.location.assign(data.next);
    } catch (cause) { setError((cause as Error).message); setPending(false); }
  }
  return <form className="login-form" onSubmit={submit}>
    <label>Username<input name="username" autoComplete="username" required autoFocus /></label>
    <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
    {error && <p className="login-error" role="alert">{error}</p>}
    <button type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'} <span aria-hidden="true">→</span></button>
  </form>;
}
