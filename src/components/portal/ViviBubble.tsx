'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatTurn } from '@/lib/portal/types';
import { VIVI_FAQ, VIVI_URL } from '@/lib/portal/vivi';

const RING = 'Ask me anything · Ask me anything · Ask me anything · ';
const DISMISSED = 'vivi-dismissed';
const MAX_CHARS = 600;

/**
 * ViVi, the Visions AI assistant: the same looping face as visionsdesign.co.uk,
 * with a rotating "Ask me anything" ring. Sample questions are answered
 * instantly; anything else (and any follow-up) goes to ViVi's AI chat.
 */
export function ViviBubble() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const log = useRef<HTMLDivElement>(null);
  // One ID per conversation, so the team sees each chat as a single thread
  const conversationId = useRef<string | null>(null);

  // Show the questions on arrival on wide screens, unless closed earlier this visit
  useEffect(() => {
    try {
      if (window.matchMedia('(min-width: 1200px)').matches && sessionStorage.getItem(DISMISSED) !== '1') setOpen(true);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [turns]);

  function close() {
    setOpen(false);
    try { sessionStorage.setItem(DISMISSED, '1'); } catch { /* ignore */ }
  }

  /** A sample question: answered straight away from the written answer, and the chat carries on from there */
  function sample(i: number) {
    setError('');
    conversationId.current = null;
    setTurns([
      { role: 'user', content: VIVI_FAQ[i].q },
      { role: 'assistant', content: VIVI_FAQ[i].a.join('\n\n') },
    ]);
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setError('');
    const next: ChatTurn[] = [...turns, { role: 'user', content: text }];
    setTurns([...next, { role: 'assistant', content: '' }]);
    setBusy(true);
    try {
      conversationId.current ??= crypto.randomUUID();
      const r = await fetch('/api/vivi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: next, conversationId: conversationId.current, page: window.location.pathname }),
      });
      if (!r.ok || !r.body) {
        setTurns(next.slice(0, -1));
        setInput(text);
        setError((await r.json().catch(() => null))?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let reply = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setTurns([...next, { role: 'assistant', content: reply }]);
      }
    } catch {
      setTurns(next.slice(0, -1));
      setInput(text);
      setError('The connection dropped. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="vivi-wrap">
      {open && (
        <div className="vivi-panel" role="dialog" aria-label="Ask ViVi">
          <div className="vivi-panel-head">
            {turns.length ? (
              <button type="button" className="vivi-back" onClick={() => { setTurns([]); setError(''); conversationId.current = null; }}>← Questions</button>
            ) : (
              <span><strong>Hi, I’m ViVi.</strong> Ask me anything about the workshop:</span>
            )}
            <button type="button" className="vivi-close" onClick={close} aria-label="Close">×</button>
          </div>

          {turns.length ? (
            <div className="vivi-log" ref={log} aria-live="polite">
              {turns.map((t, i) => (
                <p key={i} className={`vivi-msg vivi-${t.role}`}>
                  {t.content || <span className="vivi-typing">ViVi is typing…</span>}
                </p>
              ))}
            </div>
          ) : (
            <ul className="vivi-questions">
              {VIVI_FAQ.map((f, i) => (
                <li key={f.q}>
                  <button type="button" onClick={() => sample(i)}>{f.q}</button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="vivi-error" role="alert">{error}</p>}

          <form className="vivi-form" onSubmit={send}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              placeholder={turns.length ? 'Ask a follow-up…' : 'Ask me anything else…'}
              aria-label="Ask ViVi a question"
              disabled={busy}
            />
            <button type="submit" disabled={busy || !input.trim()} aria-label="Send">→</button>
          </form>

          <p className="vivi-foot">
            ViVi is an AI assistant, so answers may not be perfect. Chats are saved so our team can follow up.{' '}
            <a href={VIVI_URL} target="_blank" rel="noreferrer">Talk to the team ↗</a>
          </p>
        </div>
      )}

      <button
        type="button"
        className="vivi"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label="Ask ViVi, the Visions AI assistant, anything"
      >
        <svg className="vivi-ring" viewBox="0 0 200 200" aria-hidden>
          <defs>
            <path id="vivi-circle" d="M100,100 m-74,0 a74,74 0 1,1 148,0 a74,74 0 1,1 -148,0" />
          </defs>
          <text>
            <textPath href="#vivi-circle" textLength="462" lengthAdjust="spacing">{RING}</textPath>
          </text>
        </svg>
        <span className="vivi-face-wrap" aria-hidden>
          <video className="vivi-face" autoPlay loop muted playsInline preload="metadata" poster="/img/vivi-poster.jpg">
            <source src="/img/vivi.webm" type="video/webm" />
            <source src="/img/vivi.mp4" type="video/mp4" />
          </video>
        </span>
      </button>
    </div>
  );
}
