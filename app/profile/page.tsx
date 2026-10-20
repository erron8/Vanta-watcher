'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { LockKeyhole, UserRound } from 'lucide-react';
import { Navigation } from '../screener-ui';

type Identity = { username: string; isAdmin: boolean };

export default function ProfilePage() {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/auth/me', { cache: 'no-store' }).then(async response => {
      if (!response.ok) throw new Error('Could not load your profile.');
      return response.json() as Promise<Identity>;
    }).then(value => { if (mounted) { setIdentity(value); setUsername(value.username); } })
      .catch(cause => { if (mounted) setError((cause as Error).message); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setNotice('');
    if (newPassword !== confirmPassword) { setError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/profile', { method: 'PATCH', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, currentPassword, newPassword }) });
      const result = await response.json() as { username?: string; message?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not save your profile.');
      setUsername(result.username!);
      setIdentity(value => value && { ...value, username: result.username! });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setNotice(result.message || 'Profile updated.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  return <main className="terminal"><Navigation active="profile" /><div className="profile-content">
    <div className="profile-heading"><span className="admin-eyebrow"><UserRound size={14} /> YOUR ACCOUNT</span><h1>Profile</h1><p>View your account and sign-in details.</p></div>
    <section className="profile-card" aria-labelledby="profile-account-title"><div className="profile-card-heading"><span className="profile-card-icon"><UserRound size={21} /></span><div><h2 id="profile-account-title">Account details</h2><p>{identity?.isAdmin ? 'Administrator' : 'Member'} account</p></div></div>
      {loading ? <p className="profile-muted">Loading profile…</p> : identity?.isAdmin ? <form className="profile-form" onSubmit={save}>
        <label htmlFor="profile-username">Username</label><input id="profile-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="username" required minLength={3} maxLength={32} pattern="[a-z][a-z0-9_-]{2,31}" disabled={saving} /><small>3–32 lowercase letters, numbers, underscores, or hyphens.</small>
        <div className="profile-divider" />
        <label htmlFor="profile-current-password">Current password</label><input id="profile-current-password" type="password" autoComplete="current-password" value={currentPassword} onChange={event => setCurrentPassword(event.target.value)} required disabled={saving} />
        <label htmlFor="profile-new-password">New password <span>Optional</span></label><input id="profile-new-password" type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} minLength={12} maxLength={256} disabled={saving} placeholder="Leave blank to keep your current password" />
        {newPassword && <><label htmlFor="profile-confirm-password">Confirm new password</label><input id="profile-confirm-password" type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} required disabled={saving} /></>}
        <p className="profile-muted"><LockKeyhole size={14} /> Changing your username or password signs out other admin sessions.</p>
        <button type="submit" className="admin-primary" disabled={saving || (username === identity.username && !newPassword)}>{saving ? 'Saving…' : 'Save changes'}</button>
      </form> : identity ? <div className="profile-readonly"><span>Username</span><strong>{identity.username}</strong><p>Your account name is managed by the administrator.</p></div> : null}
      {error && <p className="admin-message admin-error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
    </section>
  </div></main>;
}
