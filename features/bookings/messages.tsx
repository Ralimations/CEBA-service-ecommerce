'use client';
import { memo, Profiler, useCallback, useEffect, useState, type ProfilerOnRenderCallback } from 'react';
import { Send, RefreshCw } from 'lucide-react';
type Message = { id: string; sender_id: string; body: string; created_at: string };
type Thread = {
  providerName: string;
  canSend: boolean;
  unread: number;
  messages: Message[];
  hasMore: boolean;
};

const messageTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Manila',
});
const timeLabel = (value: string) => messageTimeFormatter.format(new Date(value));

const profileMessageList: ProfilerOnRenderCallback = (id, phase, actualDuration, baseDuration, startTime, commitTime) => {
  if (typeof window === 'undefined' || !new URLSearchParams(window.location.search).has('reactProfile')) return;
  const profileWindow = window as Window & { __reactProfileRecords?: unknown[] };
  profileWindow.__reactProfileRecords ??= [];
  profileWindow.__reactProfileRecords.push({ id, phase, actualDuration, baseDuration, startTime, commitTime });
};

type MessageHistoryProps = {
  thread: Thread | null;
  loading: boolean;
  viewerId: string;
  reported: string[];
  reporting: boolean;
  loadingEarlier: boolean;
  onLoadEarlier: () => void;
  onReport: (messageId: string, form: HTMLFormElement) => void;
};

const MessageHistory = memo(function MessageHistory({ thread, loading, viewerId, reported, reporting, loadingEarlier, onLoadEarlier, onReport }: MessageHistoryProps) {
  return <Profiler id="booking-message-list" onRender={profileMessageList}>
    <div className="message-list" aria-live="polite" aria-relevant="additions text">
      {!thread && loading && <p role="status">Loading messages…</p>}
      {thread?.hasMore && <button className="btn secondary small" type="button" onClick={onLoadEarlier} disabled={loadingEarlier}>{loadingEarlier ? 'Loading…' : 'Load earlier messages'}</button>}
      {thread?.messages.length === 0 && <p className="muted">Start a conversation about this booking.</p>}
      {thread?.messages.map((message) => <article className={`message-bubble ${message.sender_id === viewerId ? 'mine' : ''}`} key={message.id}>
        <p className="message-body">{message.body}</p><time dateTime={message.created_at}>{timeLabel(message.created_at)}</time>
        {message.sender_id !== viewerId && (reported.includes(message.id)
          ? <small role="status" className="message-report-status">Report sent for administrator review.</small>
          : <details className="message-report-control">
              <summary>Report message</summary>
              <form onSubmit={(event) => { event.preventDefault(); onReport(message.id, event.currentTarget); }}>
                <label htmlFor={`report-category-${message.id}`}>Reason</label>
                <select id={`report-category-${message.id}`} name="category" defaultValue="HARASSMENT">
                  <option value="HARASSMENT">Harassment or disrespect</option>
                  <option value="SPAM">Spam or unwanted solicitation</option>
                  <option value="SAFETY">Safety concern</option>
                  <option value="OTHER">Other concern</option>
                </select>
                <label htmlFor={`report-details-${message.id}`}>Details (optional)</label>
                <textarea id={`report-details-${message.id}`} name="details" maxLength={1000} rows={2}/>
                <button className="btn secondary small" type="submit" disabled={reporting}>Send report</button>
              </form>
            </details>)}
      </article>)}
    </div>
  </Profiler>;
});

const MessageComposer = memo(function MessageComposer({ itemId, onSend }: { itemId: string; onSend: (body: string) => Promise<void> }) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !body.trim()) return;
    setBusy(true);
    try {
      await onSend(body);
      setBody('');
    } finally {
      setBusy(false);
    }
  }
  return <form className="message-compose" onSubmit={(event) => void submit(event)}>
    <label className="sr-only" htmlFor={`message-${itemId}`}>Write a booking message</label>
    <textarea id={`message-${itemId}`} value={body} onChange={(event) => setBody(event.target.value)}
      maxLength={4000} rows={3} placeholder="Write a message about this booking…" disabled={busy}/>
    <button className="btn" type="submit" disabled={busy || !body.trim()}><Send size={15}/> Send</button>
    <small>{body.length}/4000 · Avoid sharing passwords or payment details.</small>
  </form>;
});

export function BookingMessages({ itemId, viewerId }: { itemId: string; viewerId: string }) {
  const [thread, setThread] = useState<Thread | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState<string[]>([]);
  const [loadingEarlier, setLoadingEarlier] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages?itemId=${encodeURIComponent(itemId)}`, {
        cache: 'no-store', credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Messages are unavailable.');
      setThread(data);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Messages are unavailable.');
    } finally {
      setLoading(false);
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
      if (active) {
        setThread(data);
        setError('');
        setLoading(false);
      }
    }).catch((cause: unknown) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : 'Messages are unavailable.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [itemId]);

  const send = useCallback(async (body: string) => {
    setError('');
    try {
      const response = await fetch('/api/messages', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, body }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Message could not be sent.');
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Message could not be sent.');
    }
  }, [itemId, refresh]);

  const loadEarlier = useCallback(async () => {
    const oldest = thread?.messages[0];
    if (!thread?.hasMore || !oldest || loadingEarlier) return;
    setLoadingEarlier(true);
    setError('');
    try {
      const params = new URLSearchParams({ itemId, beforeAt: oldest.created_at, beforeId: oldest.id });
      const response = await fetch(`/api/messages?${params}`, { cache: 'no-store', credentials: 'same-origin' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Earlier messages are unavailable.');
      setThread((current) => current ? { ...current, ...data, messages: [...data.messages, ...current.messages] } : data);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Earlier messages are unavailable.');
    } finally {
      setLoadingEarlier(false);
    }
  }, [itemId, loadingEarlier, thread]);

  const report = useCallback(async (messageId: string, form: HTMLFormElement) => {
    if (reporting || reported.includes(messageId)) return;
    setReporting(true);
    setError('');
    const fields = new FormData(form);
    try {
      const response = await fetch('/api/messages/report', {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, category: fields.get('category'), details: fields.get('details') || '' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Report could not be submitted.');
      setReported((existing) => [...existing, messageId]);
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Report could not be submitted.');
    } finally {
      setReporting(false);
    }
  }, [reported, reporting]);

  return <section className="booking-messages panel" data-item-id={itemId} aria-label={`Messages with ${thread?.providerName || 'provider'}`}>
    <div className="row between">
      <div><h2>Messages</h2><p>Private to this booking and provider.</p></div>
      <button className="btn secondary" type="button" onClick={() => void refresh()} aria-label="Refresh messages"><RefreshCw size={15}/></button>
    </div>
    {thread?.unread ? <p className="message-unread" role="status">{thread.unread} unread message{thread.unread === 1 ? '' : 's'}</p> : null}
    <MessageHistory thread={thread} loading={loading} viewerId={viewerId} reported={reported} reporting={reporting} loadingEarlier={loadingEarlier}
      onLoadEarlier={() => void loadEarlier()} onReport={(messageId, form) => void report(messageId, form)} />
    {thread?.canSend && <MessageComposer itemId={itemId} onSend={send} />}
    {thread && !thread.canSend && <p className="notice">This conversation is read-only during administrator dispute review.</p>}
    {error && <p className="form-message error" role="alert">{error}</p>}
  </section>;
}
