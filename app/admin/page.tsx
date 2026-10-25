'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Pencil, Plus, Trash2 } from 'lucide-react';
import { Navigation } from '../screener-ui';

type User = { id: string; username: string; enabled: boolean; createdAt: string; updatedAt: string };
type WaitlistEntry = { id: string; telegramHandle: string; done: boolean; createdAt: string; updatedAt: string };
type Credentials = { username: string; password: string };

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || 'Request failed.');
  return body;
}

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(true);
  const [showDone, setShowDone] = useState(false);
  const [waitlistPending, setWaitlistPending] = useState<string | null>(null);
  const [waitlistError, setWaitlistError] = useState('');
  const [waitlistNotice, setWaitlistNotice] = useState('');

  useEffect(() => {
    let mounted = true;
    request<{ users: User[] }>('/api/admin/users')
      .then(result => { if (mounted) setUsers(result.users); })
      .catch(cause => { if (mounted) setError((cause as Error).message); })
      .finally(() => { if (mounted) setLoading(false); });
    request<{ entries: WaitlistEntry[] }>('/api/admin/waitlist')
      .then(result => { if (mounted) setWaitlist(result.entries); })
      .catch(cause => { if (mounted) setWaitlistError((cause as Error).message); })
      .finally(() => { if (mounted) setWaitlistLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending('create'); setError(''); setNotice(''); setCredentials(null);
    try {
      const result = await request<{ user: User; password: string }>('/api/admin/users', { method: 'POST', body: JSON.stringify({ username, ...(password ? { password } : {}) }) });
      setUsers(current => [result.user, ...current]);
      setCredentials({ username: result.user.username, password: result.password });
      setUsername(''); setPassword(''); setCopied(false);
      setNotice('Account created. Copy the password before leaving this page.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(null); }
  }

  async function save(user: User) {
    setPending(user.id); setError(''); setNotice('');
    try {
      const result = await request<{ user: User }>(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ username: editName, ...(editPassword ? { password: editPassword } : {}) }) });
      setUsers(current => current.map(row => row.id === user.id ? result.user : row));
      if (editPassword) { setCredentials({ username: result.user.username, password: editPassword }); setCopied(false); }
      setEditing(null); setEditPassword('');
      setNotice(editPassword ? 'Account updated. Share the new password; previous sessions were signed out.' : 'Account updated. Previous sessions were signed out.');
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(null); }
  }

  async function toggle(user: User) {
    setPending(user.id); setError(''); setNotice('');
    try {
      const result = await request<{ user: User }>(`/api/admin/users/${user.id}`, { method: 'PATCH', body: JSON.stringify({ enabled: !user.enabled }) });
      setUsers(current => current.map(row => row.id === user.id ? result.user : row));
      setNotice(result.user.enabled ? `${result.user.username} can sign in again. Previous sessions remain signed out.` : `${result.user.username} is disabled and signed out.`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(null); }
  }

  async function remove(user: User) {
    if (!window.confirm(`Delete ${user.username}? Their access will end immediately. This cannot be undone.`)) return;
    setPending(user.id); setError(''); setNotice('');
    try {
      await request<{ deleted: true }>(`/api/admin/users/${user.id}`, { method: 'DELETE' });
      setUsers(current => current.filter(row => row.id !== user.id));
      if (editing === user.id) setEditing(null);
      setNotice(`${user.username} was deleted.`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setPending(null); }
  }

  async function copyPassword() {
    if (!credentials) return;
    try { await navigator.clipboard.writeText(credentials.password); setCopied(true); }
    catch { setError('Could not copy. Select the password and copy it manually.'); }
  }

  async function setWaitlistDone(entry: WaitlistEntry, done: boolean) {
    setWaitlistPending(entry.id); setWaitlistError(''); setWaitlistNotice('');
    try {
      const result = await request<{ entry: WaitlistEntry }>('/api/admin/waitlist', { method: 'PATCH', body: JSON.stringify({ id: entry.id, done }) });
      setWaitlist(current => current.map(row => row.id === entry.id ? result.entry : row));
      setWaitlistNotice(done ? `${entry.telegramHandle} marked done.` : `${entry.telegramHandle} moved back to pending.`);
    } catch (cause) { setWaitlistError((cause as Error).message); }
    finally { setWaitlistPending(null); }
  }

  return <main className="terminal"><Navigation active="admin" /><div className="admin-content">
    <header className="admin-heading"><h1>Admin</h1><span>{users.filter(user => user.enabled).length} active users · {waitlist.filter(entry => !entry.done).length} pending</span></header>
    {error && <p className="admin-message admin-error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
    <section className="admin-create" aria-labelledby="admin-create-title"><h2 id="admin-create-title">Add user</h2><form onSubmit={create}>
      <label htmlFor="create-username">Username<input id="create-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9_-]{2,31}" disabled={pending !== null} /></label>
      <label htmlFor="create-password"><span>Password <small>(optional, 12+ characters)</small></span><input id="create-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={256} placeholder="Leave blank to generate" disabled={pending !== null} /></label>
      <button className="admin-primary" type="submit" disabled={pending !== null}><Plus size={16} />{pending === 'create' ? 'Creating…' : 'Add user'}</button>
    </form>{credentials && <div className="admin-credentials" aria-label="New account credentials"><strong>Copy this password now. It will not be shown again.</strong><div className="admin-credential-line"><span>{credentials.username}</span><code>{credentials.password}</code><button type="button" onClick={() => void copyPassword()} aria-label="Copy password">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}</button></div></div>}</section>
    <div className="admin-grid"><section className="admin-users" aria-labelledby="admin-users-title"><div className="admin-users-top"><h2 id="admin-users-title">Users</h2><span>{users.length}</span></div>
      {loading ? <p className="admin-empty">Loading users…</p> : users.length === 0 ? <p className="admin-empty">No users yet.</p> : <div className="admin-user-list">{users.map(user => <div className="admin-user" key={user.id}>
        <strong className="admin-user-name">{user.username}</strong><span className={`admin-status ${user.enabled ? 'enabled' : 'disabled'}`}>{user.enabled ? 'Active' : 'Disabled'}</span>
        <div className="admin-user-actions"><button type="button" disabled={pending !== null} onClick={() => { setEditing(editing === user.id ? null : user.id); setEditName(user.username); setEditPassword(''); setError(''); }}><Pencil size={14} />Edit</button><button type="button" disabled={pending !== null} onClick={() => void toggle(user)}>{user.enabled ? 'Disable' : 'Enable'}</button><button type="button" className="admin-danger" disabled={pending !== null} onClick={() => void remove(user)} title={`Delete ${user.username}`} aria-label={`Delete ${user.username}`}><Trash2 size={15} /></button></div>
        {editing === user.id && <form className="admin-edit" onSubmit={event => { event.preventDefault(); void save(user); }}><label>Username<input value={editName} onChange={event => setEditName(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9_-]{2,31}" disabled={pending !== null} /></label><label>New password <small>Leave blank to keep it</small><input type="password" value={editPassword} onChange={event => setEditPassword(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" disabled={pending !== null} /></label><div><button className="admin-primary" type="submit" disabled={pending !== null}>{pending === user.id ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</button></div></form>}
      </div>)}</div>}</section>
    <section className="admin-waitlist admin-users" aria-labelledby="admin-waitlist-title">
      <div className="admin-users-top"><h2 id="admin-waitlist-title">Waitlist</h2><span>{waitlist.filter(entry => !entry.done).length} pending</span></div>
      {waitlistLoading ? <p className="admin-empty">Loading waitlist…</p> : waitlist.filter(entry => !entry.done).length === 0 ? <p className="admin-empty">No pending requests.</p> : null}
      {!waitlistLoading && <div className="admin-waitlist-list">{[...waitlist.filter(entry => !entry.done), ...(showDone ? waitlist.filter(entry => entry.done) : [])].map(entry => <div className={`admin-waitlist-row${entry.done ? ' is-done' : ''}`} key={entry.id}><div className="admin-waitlist-person"><a href={`https://t.me/${entry.telegramHandle.slice(1)}`} target="_blank" rel="noopener noreferrer">{entry.telegramHandle}</a><span>Requested {new Date(entry.createdAt).toLocaleString()}</span></div><button type="button" disabled={waitlistPending !== null} onClick={() => void setWaitlistDone(entry, !entry.done)}>{entry.done ? 'Restore' : <><Check size={14} /> Mark done</>}{waitlistPending === entry.id && '…'}</button></div>)}</div>}
      {waitlist.some(entry => entry.done) && <button type="button" className="admin-waitlist-toggle" aria-expanded={showDone} onClick={() => setShowDone(value => !value)}>{showDone ? 'Hide' : 'Show'} completed ({waitlist.filter(entry => entry.done).length})</button>}
      {waitlistError && <p className="admin-waitlist-feedback admin-error" role="alert">{waitlistError}</p>}{waitlistNotice && <p className="admin-waitlist-feedback" role="status">{waitlistNotice}</p>}
    </section></div>
  </div></main>;
}
