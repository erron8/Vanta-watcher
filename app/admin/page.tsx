'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Pencil, Plus, Trash2, Users } from 'lucide-react';
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

  useEffect(() => {
    let mounted = true;
    request<{ users: User[] }>('/api/admin/users')
      .then(result => { if (mounted) setUsers(result.users); })
      .catch(cause => { if (mounted) setError((cause as Error).message); })
      .finally(() => { if (mounted) setLoading(false); });
    request<{ entries: WaitlistEntry[] }>('/api/admin/waitlist')
      .then(result => { if (mounted) setWaitlist(result.entries); })
      .catch(cause => { if (mounted) setError((cause as Error).message); })
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
    setWaitlistPending(entry.id); setError(''); setNotice('');
    try {
      const result = await request<{ entry: WaitlistEntry }>('/api/admin/waitlist', { method: 'PATCH', body: JSON.stringify({ id: entry.id, done }) });
      setWaitlist(current => current.map(row => row.id === entry.id ? result.entry : row));
      setNotice(done ? `${entry.telegramHandle} marked done.` : `${entry.telegramHandle} moved back to pending.`);
    } catch (cause) { setError((cause as Error).message); }
    finally { setWaitlistPending(null); }
  }

  return <main className="terminal"><Navigation active="admin" /><div className="admin-content">
    <div className="admin-heading"><div><span className="admin-eyebrow"><Users size={14} /> ACCESS MANAGEMENT</span><h1>People with access</h1><p>Create individual sign-ins for friends and remove access whenever you need to.</p></div><span className="admin-count">{users.filter(user => user.enabled).length} active</span></div>
    <div className="admin-grid"><section className="admin-create" aria-labelledby="admin-create-title"><h2 id="admin-create-title">Invite someone</h2><p>Each person gets a separate username and password. Leave the password blank to generate a secure one.</p><form onSubmit={create}>
      <label htmlFor="create-username">Username</label><input id="create-username" value={username} onChange={event => setUsername(event.target.value)} autoComplete="off" placeholder="e.g. tradingfriend" required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9_-]{2,31}" disabled={pending !== null} />
      <label htmlFor="create-password">Password <small>Optional · at least 12 characters</small></label><input id="create-password" type="password" value={password} onChange={event => setPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={256} placeholder="Generate one for me" disabled={pending !== null} />
      <button className="admin-primary" type="submit" disabled={pending !== null}><Plus size={16} />{pending === 'create' ? 'Creating…' : 'Create user'}</button>
    </form>{credentials && <div className="admin-credentials" aria-label="New account credentials"><div><strong>Save these credentials now</strong><p>The password is shown here only until you leave this page.</p></div><div className="admin-credential-line"><span>{credentials.username}</span><code>{credentials.password}</code><button type="button" onClick={() => void copyPassword()} aria-label="Copy password">{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? 'Copied' : 'Copy'}</button></div></div>}<p className="admin-system-note">Change your own admin sign-in from the profile icon. The <strong>guest</strong> account remains configured separately.</p></section>
    <section className="admin-users" aria-labelledby="admin-users-title"><div className="admin-users-top"><h2 id="admin-users-title">Managed users</h2><span>{users.length} total</span></div>
      {loading ? <p className="admin-empty">Loading users…</p> : users.length === 0 ? <p className="admin-empty">No friend accounts yet. Create one to give someone access.</p> : <div className="admin-user-list">{users.map(user => <div className="admin-user" key={user.id}>
        <div className="admin-user-main"><div className="admin-user-avatar" aria-hidden="true">{user.username.slice(0, 1).toUpperCase()}</div><div><strong>{user.username}</strong><span>Added {new Date(user.createdAt).toLocaleDateString()}</span></div></div><span className={`admin-status ${user.enabled ? 'enabled' : 'disabled'}`}>{user.enabled ? 'Active' : 'Disabled'}</span>
        <div className="admin-user-actions"><button type="button" disabled={pending !== null} onClick={() => { setEditing(editing === user.id ? null : user.id); setEditName(user.username); setEditPassword(''); setError(''); }}><Pencil size={14} />Edit</button><button type="button" disabled={pending !== null} onClick={() => void toggle(user)}>{user.enabled ? 'Disable' : 'Enable'}</button><button type="button" className="admin-danger" disabled={pending !== null} onClick={() => void remove(user)} title={`Delete ${user.username}`} aria-label={`Delete ${user.username}`}><Trash2 size={15} /></button></div>
        {editing === user.id && <form className="admin-edit" onSubmit={event => { event.preventDefault(); void save(user); }}><label>Username<input value={editName} onChange={event => setEditName(event.target.value)} required minLength={3} maxLength={32} pattern="[A-Za-z][A-Za-z0-9_-]{2,31}" disabled={pending !== null} /></label><label>New password <small>Leave blank to keep it</small><input type="password" value={editPassword} onChange={event => setEditPassword(event.target.value)} minLength={12} maxLength={256} autoComplete="new-password" disabled={pending !== null} /></label><div><button className="admin-primary" type="submit" disabled={pending !== null}>{pending === user.id ? 'Saving…' : 'Save changes'}</button><button type="button" disabled={pending !== null} onClick={() => setEditing(null)}>Cancel</button></div></form>}
      </div>)}</div>}</section></div>
    <section className="admin-waitlist admin-users" aria-labelledby="admin-waitlist-title">
      <div className="admin-users-top"><div><h2 id="admin-waitlist-title">Access waitlist</h2><p>Telegram handles submitted from the homepage.</p></div><span>{waitlist.filter(entry => !entry.done).length} pending</span></div>
      {waitlistLoading ? <p className="admin-empty">Loading waitlist…</p> : waitlist.filter(entry => !entry.done).length === 0 ? <p className="admin-empty">No pending requests.</p> : <div className="admin-waitlist-table-wrap"><table className="admin-waitlist-table"><thead><tr><th>Telegram</th><th>Requested</th><th>Action</th></tr></thead><tbody>{waitlist.filter(entry => !entry.done).map(entry => <tr key={entry.id}><td><a href={`https://t.me/${entry.telegramHandle.slice(1)}`} target="_blank" rel="noopener noreferrer">{entry.telegramHandle}</a></td><td>{new Date(entry.createdAt).toLocaleString()}</td><td><button type="button" disabled={waitlistPending !== null} onClick={() => void setWaitlistDone(entry, true)}><Check size={15} /> {waitlistPending === entry.id ? 'Saving…' : 'Mark done'}</button></td></tr>)}</tbody></table></div>}
      {waitlist.some(entry => entry.done) && <><button type="button" className="admin-waitlist-toggle" aria-expanded={showDone} onClick={() => setShowDone(value => !value)}>{showDone ? 'Hide' : 'Show'} completed ({waitlist.filter(entry => entry.done).length})</button>{showDone && <div className="admin-waitlist-table-wrap"><table className="admin-waitlist-table"><thead><tr><th>Telegram</th><th>Requested</th><th>Action</th></tr></thead><tbody>{waitlist.filter(entry => entry.done).map(entry => <tr key={entry.id}><td><a href={`https://t.me/${entry.telegramHandle.slice(1)}`} target="_blank" rel="noopener noreferrer">{entry.telegramHandle}</a></td><td>{new Date(entry.createdAt).toLocaleString()}</td><td><button type="button" disabled={waitlistPending !== null} onClick={() => void setWaitlistDone(entry, false)}>{waitlistPending === entry.id ? 'Saving…' : 'Restore'}</button></td></tr>)}</tbody></table></div>}</>}
    </section>
    {error && <p className="admin-message admin-error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
  </div></main>;
}
