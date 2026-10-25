'use client';

import { useRef, useState, type FormEvent } from 'react';
import { ArrowRight, X } from 'lucide-react';

export function WaitlistForm() {
  const dialog = useRef<HTMLDialogElement>(null);
  const [handle, setHandle] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function open() {
    setError('');
    setSubmitted(false);
    dialog.current?.showModal();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramHandle: handle }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Could not join the waitlist.');
      setSubmitted(true);
      setHandle('');
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  return <>
    <div className="landing-waitlist-slot"><button type="button" className="landing-waitlist-trigger" onClick={open}>Need access? <strong>Join waitlist</strong> <ArrowRight size={16} /></button></div>
    <dialog ref={dialog} className="landing-waitlist-dialog" aria-labelledby="waitlist-title" onClick={event => { if (event.target === dialog.current) dialog.current?.close(); }}>
      <button type="button" className="landing-waitlist-close" aria-label="Close waitlist" onClick={() => dialog.current?.close()}><X size={19} /></button>
      {submitted ? <div className="landing-waitlist-success"><span className="landing-waitlist-kicker">REQUEST RECEIVED</span><h2 id="waitlist-title">You’re on the list.</h2><p>We’ll use your Telegram handle if we can offer you access.</p><button type="button" className="landing-waitlist-submit" onClick={() => dialog.current?.close()}>Done</button></div> : <>
        <span className="landing-waitlist-kicker">EARLY ACCESS</span>
        <h2 id="waitlist-title">Join the waitlist.</h2>
        <p>Don’t have a Vanta account yet? Leave your Telegram username and we’ll reach out when access is available.</p>
        <form onSubmit={event => void submit(event)}>
          <label htmlFor="waitlist-handle">Telegram handle</label>
          <input id="waitlist-handle" name="telegramHandle" type="text" value={handle} onChange={event => setHandle(event.target.value)} placeholder="@yourusername" autoComplete="off" autoCapitalize="off" spellCheck={false} required minLength={5} maxLength={33} autoFocus />
          {error && <span className="landing-waitlist-error" role="alert">{error}</span>}
          <button type="submit" className="landing-waitlist-submit" disabled={saving}>{saving ? 'Submitting…' : 'Join waitlist'} <ArrowRight size={18} /></button>
        </form>
        <small>We’ll only use this handle to contact you about Vanta access.</small>
      </>}
    </dialog>
  </>;
}
