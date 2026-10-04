'use client';
import { useState } from 'react';
import Link from 'next/link';
import { MessageCircle, ArrowUpRight, Send, X } from 'lucide-react';
import { answerFaq, faqs } from '@/lib/faq';
export function FaqChat({ floating = false }: { floating?: boolean }) {
  const [open, setOpen] = useState(!floating);
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState(
    'Hi! Planning something special? I can help with bookings, payments, bundles, and rewards.',
  );
  const [unknown, setUnknown] = useState(false);
  function ask(q: string) {
    const match = answerFaq(q);
    setAnswer(
      match?.answer ||
        'I could use a little help with that one. Send your question to the support team and an administrator will reply in the app.',
    );
    setUnknown(!match);
    setInput('');
  }
  return (
    <div className={floating ? 'chat-widget' : 'faq-chat'}>
      {floating && (
        <button
          className="chat-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? 'Close event help' : 'Open event help'}
        >
          {open ? <X size={21} /> : <MessageCircle size={21} />}
          <span>Need a hand?</span>
        </button>
      )}
      {open && (
        <section className="chat-panel" aria-label="Event help">
          <div className="chat-head">
            <MessageCircle size={20} />
            <div>
              <strong>A little help, right here.</strong>
              <small>FAQ assistant · instant answers</small>
            </div>
          </div>
          <p className="chat-answer" role="status">
            {answer}
          </p>
          <div className="faq-suggestions">
            {faqs.slice(0, 4).map((f) => (
              <button type="button" key={f.question} onClick={() => ask(f.question)}>
                {f.question}
              </button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (input.trim()) ask(input);
            }}
            className="chat-input"
          >
            <label className="sr-only" htmlFor={floating ? 'widget-question' : 'help-question'}>
              Ask a question
            </label>
            <input
              id={floating ? 'widget-question' : 'help-question'}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your next event…"
              required
            />
            <button className="icon-button" type="submit" aria-label="Send question">
              <Send size={19} />
            </button>
          </form>
          <Link
            className={`text-link ${unknown ? 'support-highlight' : ''}`}
            href="/support#ticket"
          >
            Ask an administrator
            <ArrowUpRight size={14} />
          </Link>
        </section>
      )}
    </div>
  );
}
