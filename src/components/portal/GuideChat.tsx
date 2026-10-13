'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChatTurn } from '@/lib/portal/types';

interface Props {
  token: string;
  slideId: string;
  initial: ChatTurn[];
  partLabels: string[];
  disabled?: boolean;
  /** ElevenLabs is configured: offer spoken replies and talking back */
  voice?: boolean;
  /** Called with the drafted answer when the client chooses to use it */
  onUseDraft: (draft: { text: string; parts: Record<string, string> }) => void;
}

/** The AI facilitator for one question: a short conversation, then "Draft my answer". */
export function GuideChat({ token, slideId, initial, partLabels, disabled, voice, onUseDraft }: Props) {
  const [turns, setTurns] = useState<ChatTurn[]>(initial);
  const [open, setOpen] = useState(initial.length > 0);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<'reply' | 'draft' | null>(null);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState<{ text: string; parts: Record<string, string> } | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const headers = { 'Content-Type': 'application/json', 'x-workshop-token': token };

  // ---- voice mode: the facilitator speaks (ElevenLabs) and the client can answer out loud ----
  const [voiceOn, setVoiceOn] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const player = useRef<HTMLAudioElement | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    try { setVoiceOn(Boolean(voice) && localStorage.getItem('ss-voice') === 'on'); } catch { /* ignore */ }
    return () => {
      player.current?.pause();
      if (recorder.current?.state === 'recording') recorder.current.stop();
    };
  }, [voice]);

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    try { localStorage.setItem('ss-voice', next ? 'on' : 'off'); } catch { /* ignore */ }
    if (!next) player.current?.pause();
  }

  /** Speak the facilitator's message at this index (it's looked up server-side from the saved conversation) */
  function say(index: number) {
    player.current?.pause();
    const a = new Audio(`/api/portal/speak?slideId=${slideId}&i=${index}&t=${encodeURIComponent(token)}`);
    player.current = a;
    a.onplaying = () => setSpeaking(true);
    a.onended = a.onpause = a.onerror = () => setSpeaking(false);
    a.play().catch(() => setSpeaking(false));
  }

  async function startTalking() {
    setError('');
    player.current?.pause();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('We could not use your microphone. Check your browser allowed it, or type your reply.');
      return;
    }
    const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
      setBusy('reply');
      const r = await fetch('/api/portal/transcribe', { method: 'POST', headers: { 'Content-Type': blob.type, 'x-workshop-token': token }, body: blob }).catch(() => null);
      const data = await r?.json().catch(() => null);
      setBusy(null);
      if (!r?.ok || !data?.text) {
        setError(data?.error ?? 'We could not hear that. Please try again, or type your reply.');
        return;
      }
      setDraft(null);
      ask([...turnsRef.current, { role: 'user', content: data.text }]);
    };
    recorder.current = rec;
    rec.start();
    setRecording(true);
  }
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: 'smooth' });
  }, [turns, draft]);

  async function ask(next: ChatTurn[]) {
    setError('');
    setBusy('reply');
    setTurns([...next, { role: 'assistant', content: '' }]);
    try {
      const r = await fetch('/api/portal/guide', { method: 'POST', headers, body: JSON.stringify({ slideId, mode: 'chat', turns: next }) });
      if (!r.ok || !r.body) {
        setTurns(next);
        setError((await r.json().catch(() => null))?.error ?? 'Something went wrong. Please try again.');
        return;
      }
      const reader = r.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setTurns([...next, { role: 'assistant', content: text }]);
      }
      if (voiceOn && text.trim()) say(next.length);
    } catch {
      setTurns(next);
      setError('The connection dropped. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  function start() {
    setOpen(true);
    if (!turns.length) ask([]);
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setDraft(null);
    ask([...turns, { role: 'user', content: text }]);
  }

  async function makeDraft() {
    setError('');
    setBusy('draft');
    try {
      const r = await fetch('/api/portal/guide', { method: 'POST', headers, body: JSON.stringify({ slideId, mode: 'draft', turns }) });
      const data = await r.json().catch(() => null);
      if (!r.ok) setError(data?.error ?? 'The draft did not work. Please try again.');
      else setDraft(data);
    } finally {
      setBusy(null);
    }
  }

  if (!open) {
    return (
      <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm ss-guide-start" onClick={start} disabled={disabled}>
        Talk it through with our AI facilitator
      </button>
    );
  }

  const replied = turns.some((t) => t.role === 'user');
  return (
    <div className="ss-guide">
      <div className="ss-guide-head">
        <div className="ss-guide-title">
          <strong>AI facilitator</strong>
          {voice && (
            <button type="button" className={`ss-voice-toggle ${voiceOn ? 'is-on' : ''}`} onClick={toggleVoice} aria-pressed={voiceOn}>
              {voiceOn ? (speaking ? 'Speaking…' : 'Voice on') : 'Voice off'}
            </button>
          )}
        </div>
        <span>
          Answers are processed by Claude, an AI model from Anthropic{voice ? ', and voice by ElevenLabs' : ''}. Our team reads the
          conversation too.
        </span>
      </div>
      <div className="ss-guide-log" ref={log} aria-live="polite">
        {turns.map((t, i) => (
          <p key={i} className={`ss-msg ss-msg-${t.role}`}>
            {t.content || (busy === 'reply' && i === turns.length - 1 ? <span className="ss-typing">Thinking…</span> : null)}
            {voice && t.role === 'assistant' && t.content && !(busy === 'reply' && i === turns.length - 1) && (
              <button type="button" className="ss-replay" onClick={() => say(i)} aria-label="Play this message">▶ Listen</button>
            )}
          </p>
        ))}
        {draft && (
          <div className="ss-draft">
            <p className="ss-draft-label">Your drafted answer</p>
            {partLabels.map((label) =>
              draft.parts[label]?.trim() ? <p key={label}><b>{label}:</b> {draft.parts[label]}</p> : null,
            )}
            {draft.text.trim() && <p>{draft.text}</p>}
            <div className="ss-draft-actions">
              <button type="button" className="pt-btn pt-btn-sm" onClick={() => { onUseDraft(draft); setDraft(null); }}>
                Use this answer
              </button>
              <span>You can edit it in the boxes above.</span>
            </div>
          </div>
        )}
      </div>
      {error && <p className="pt-error">{error}</p>}
      {!disabled && (
        <form className="ss-guide-form" onSubmit={send}>
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(e);
              }
            }}
            placeholder="Type your reply…"
            maxLength={3000}
          />
          <div className="ss-guide-actions">
            {voice && (
              recording ? (
                <button type="button" className="pt-btn pt-btn-sm ss-talking" onClick={() => recorder.current?.stop()}>
                  <span className="dot rec" /> Stop and send
                </button>
              ) : (
                <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" disabled={!!busy} onClick={startTalking}>
                  Answer out loud
                </button>
              )
            )}
            <button type="submit" className="pt-btn pt-btn-sm" disabled={!!busy || !input.trim()}>Send</button>
            <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" disabled={!!busy || !replied} onClick={makeDraft}>
              {busy === 'draft' ? 'Drafting…' : 'Draft my answer'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
