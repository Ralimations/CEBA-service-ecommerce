'use client';
import { useCallback, useEffect, useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
type Message = { id: string; sender_id: string; body: string; created_at: string };
type Thread = {
  providerName: string;
  canSend: boolean;
  unread: number;
  messages: Message[];
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
  }).format(new Date(value));
}

export function BookingMessages({ itemId, viewerId }: { itemId: string; viewerId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/messages?itemId=${encodeURIComponent(itemId)}`, {
        cache: 'no-store', credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Messages are unavailable.');
      setThread(data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Messages are unavailable.');
    }
  }, [itemId]);

  useEffect(() => {
    let active = true;
    fetch(`/api/messages?itemId=${encodeURIComponent(itemId)}`, {
      cache: 'no-store', credentials: 'same-origin',
    }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Messages are unavailable.');
      return data as Thread;
    }).then((data) => {
      if (active) setThread(data);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : 'Messages are unavailable.');
    });
    return () => { active = false; };
  }, [itemId]);

  async function send() {
    if (busy || !body.trim()) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      setBody('');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    } finally {
      setBusy(false);
    }
  }

  return <section className="booking-messages panel" data-item-id={itemId} aria-label={`Messages with ${thread?.providerName || 'provider'}`}>
    <div className="row between">
      <div><h2>Messages</h2><p>Private to this booking and provider.</p></div>
      <button className="btn secondary" type="button" onClick={() => void refresh()} aria-label="Refresh messages"><RefreshCw size={15}/></button>
    </div>
    {thread?.unread ? <p className="message-unread" role="status">{thread.unread} unread message{thread.unread === 1 ? '' : 's'}</p> : null}
    <div className="message-list" aria-live="polite" aria-relevant="additions text">
      {!thread && !error && <p role="status">Loading messages…</p>}
      {thread?.messages.length === 0 && <p className="muted">Start a conversation about this booking.</p>}
      {thread?.messages.map((message) => <article className={`message-bubble ${message.sender_id === viewerId ? 'mine' : ''}`} key={message.id}>
        <p className="message-body">{message.body}</p><time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
      </article>)}
    </div>
    {thread?.canSend && <form className="message-compose" onSubmit={(event) => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor={`message-${itemId}`}>Write a booking message</label>
      <textarea id={`message-${itemId}`} value={body} onChange={(event) => setBody(event.target.value)}
        maxLength={4000} rows={3} placeholder="Write a message about this booking…" disabled={busy}/>
      <button className="btn" type="submit" disabled={busy || !body.trim()}><Send size={15}/> Send</button>
      <small>{body.length}/4000 · Avoid sharing passwords or payment details.</small>
    </form>}
    {thread && !thread.canSend && <p className="notice">This conversation is read-only during administrator dispute review.</p>}
    {error && <p className="form-message error" role="alert">{error}</p>}
  </section>;
}
