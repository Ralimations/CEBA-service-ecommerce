'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { LoaderCircle, CheckCircle2, AlertCircle } from 'lucide-react';
import { FormErrors } from './form-state';
export type Result = {
  message?: string;
  error?: string;
  fields?: Record<string, string>;
  redirect?: string;
  code?: string;
  expires?: string;
};
export function ActionForm({
  action,
  children,
  data = {},
  className = '',
  endpoint,
  confirm,
  onResult,
  reset = false,
}: {
  action?: string;
  children: ReactNode;
  data?: Record<string, unknown>;
  className?: string;
  endpoint?: string;
  confirm?: string;
  onResult?: (r: Result) => void;
  reset?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [confirming, setConfirming] = useState(false);
  const pending = useRef<Record<string, unknown>>({});
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  async function submit(values: Record<string, unknown>) {
    setBusy(true);
    setResult(null);
    try {
      const response = await fetch(endpoint || '/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpoint ? values : { action, data: values }),
      });
      const result: Result = await response.json();
      setResult(result);
      if (response.ok) {
        onResult?.(result);
        if (reset) form.current?.reset();
        if (result.redirect) {
          router.push(result.redirect);
        }
        router.refresh();
      }
    } catch {
      setResult({ error: 'Unable to reach the server. Please try again.' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        ref={form}
        className={`action-form ${className}`}
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          const values: Record<string, unknown> = { ...data };
          const fd = new FormData(e.currentTarget);
          for (const [k, v] of fd.entries()) values[k] = v;
          for (const input of e.currentTarget.querySelectorAll<HTMLInputElement>(
            'input[type="checkbox"]',
          )) {
            if (input.name === 'addons') values.addons = fd.getAll('addons');
            else if (input.name) values[input.name] = input.checked;
          }
          pending.current = values;
          if (confirm) {
            setConfirming(true);
            dialog.current?.showModal();
          } else void submit(values);
        }}
      >
        <FormErrors.Provider value={result?.fields || {}}>
          <fieldset disabled={busy}>{children}</fieldset>
        </FormErrors.Provider>
        {busy && (
          <p className="form-message" role="status">
            <LoaderCircle size={16} className="spin" />
            Saving…
          </p>
        )}
        {result && (result.error || result.message) && (
          <div
            role={result.error ? 'alert' : 'status'}
            className={`form-message ${result.error ? 'error' : 'success'}`}
          >
            {result.error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <div>
              {result.error || result.message}
              {result.fields && (
                <ul>
                  {Object.entries(result.fields).map(([key, value]) => (
                    <li key={key}>
                      <strong>{key.replace(/([A-Z])/g, ' $1')}:</strong> {value}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </form>
      {confirm && (
        <dialog ref={dialog} onCancel={() => setConfirming(false)} className="confirm-dialog">
          {confirming && (
            <>
              <h2>Please confirm</h2>
              <p>{confirm}</p>
              <div className="button-row">
                <button
                  className="btn secondary"
                  onClick={() => {
                    dialog.current?.close();
                    setConfirming(false);
                  }}
                >
                  Go back
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    dialog.current?.close();
                    setConfirming(false);
                    void submit(pending.current);
                  }}
                >
                  Confirm
                </button>
              </div>
            </>
          )}
        </dialog>
      )}
    </>
  );
}
export function ActionButton({
  action,
  data,
  label,
  variant = 'secondary',
  confirm,
}: {
  action: string;
  data?: Record<string, unknown>;
  label: string;
  variant?: string;
  confirm?: string;
}) {
  return (
    <ActionForm action={action} data={data} confirm={confirm} className="inline-form">
      <button className={`btn small ${variant}`} type="submit">
        {label}
      </button>
    </ActionForm>
  );
}
