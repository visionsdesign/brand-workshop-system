'use client';

import { useEffect, useRef, useState } from 'react';
import type { WorkshopFile } from '@/lib/portal/types';

const MAX_SECONDS = 5 * 60;

// Minimal typing for the browser speech API (Chrome, Edge, Safari)
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
const getRecognition = (): Recognition | null => {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  const R = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return R ? new R() : null;
};

const pickMime = () =>
  ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) ?? '';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

interface Props {
  token: string;
  workshopId: string;
  slideId: string;
  notes: WorkshopFile[];
  disabled?: boolean;
  onChange: (notes: WorkshopFile[]) => void;
}

/** Record voice notes against a slide. Audio is always kept; a live transcript is added where the browser supports it. */
export function VoiceNotes({ token, workshopId, slideId, notes, disabled, onChange }: Props) {
  const [state, setState] = useState<'idle' | 'recording' | 'saving'>('idle');
  const [seconds, setSeconds] = useState(0);
  const [live, setLive] = useState('');
  const [error, setError] = useState('');
  const rec = useRef<MediaRecorder | null>(null);
  const speech = useRef<Recognition | null>(null);
  const finalText = useRef('');
  const liveRef = useRef('');
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const headers = { 'x-workshop-token': token };

  useEffect(() => () => stopAll(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function stopAll() {
    if (timer.current) clearInterval(timer.current);
    speech.current?.stop();
    speech.current = null;
    if (rec.current && rec.current.state !== 'inactive') rec.current.stop();
  }

  async function start() {
    setError('');
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('We could not use your microphone. Check your browser allowed it, then try again.');
      return;
    }
    const mime = pickMime();
    const mr = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const secs = (Date.now() - started.current) / 1000;
      save(new Blob(chunks, { type: mr.mimeType || 'audio/webm' }), secs, (finalText.current + ' ' + liveRef.current).trim());
    };
    rec.current = mr;
    finalText.current = '';
    liveRef.current = '';
    setLive('');
    started.current = Date.now();
    mr.start(1000);
    setState('recording');
    setSeconds(0);
    timer.current = setInterval(() => {
      const s = (Date.now() - started.current) / 1000;
      setSeconds(s);
      if (s >= MAX_SECONDS) stop();
    }, 250);

    // Live transcript, where available. Restarts itself after pauses until we stop.
    const r = getRecognition();
    if (r) {
      r.lang = navigator.language || 'en-GB';
      r.continuous = true;
      r.interimResults = true;
      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const res = e.results[i];
          if (res.isFinal) finalText.current += ' ' + res[0].transcript;
          else interim += res[0].transcript;
        }
        liveRef.current = interim;
        setLive((finalText.current + ' ' + interim).trim());
      };
      r.onend = () => {
        if (speech.current === r) {
          try { r.start(); } catch { /* already running */ }
        }
      };
      r.onerror = () => undefined;
      speech.current = r;
      try { r.start(); } catch { speech.current = null; }
    }
  }

  function stop() {
    setState('saving');
    stopAll();
  }

  async function save(blob: Blob, secs: number, transcript: string) {
    try {
      const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm';
      const name = `voice-${slideId}-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
      const target = await fetch('/api/portal/files/target', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ workshopId, name, size: blob.size, type: blob.type }),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('refused'))));
      const put =
        target.kind === 'supabase'
          ? await fetch(target.signedUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob })
          : await fetch(`/api/portal/files/local?path=${encodeURIComponent(target.path)}&workshopId=${workshopId}`, { method: 'PUT', headers, body: blob });
      if (!put.ok) throw new Error('upload');
      const file: WorkshopFile = await fetch('/api/portal/files/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: JSON.stringify({ workshopId, path: target.path, name, size: blob.size, type: blob.type, slideId, transcript, seconds: secs }),
      }).then((r) => (r.ok ? r.json() : Promise.reject(new Error('save'))));
      onChange([...notes, file]);
    } catch {
      setError('Your voice note did not save. Please try recording it again.');
    }
    setState('idle');
    setLive('');
  }

  async function remove(n: WorkshopFile) {
    if (!window.confirm('Delete this voice note?')) return;
    const r = await fetch(`/api/portal/files/${n.id}`, { method: 'DELETE', headers });
    if (r.ok) onChange(notes.filter((x) => x.id !== n.id));
  }

  return (
    <div className="ss-voice">
      {notes.map((n) => (
        <div className="ss-note" key={n.id}>
          <audio controls preload="none" src={`/api/portal/files/${n.id}?t=${encodeURIComponent(token)}`} />
          {n.transcript ? <p>{n.transcript}</p> : <p className="ss-muted">Voice note{n.seconds ? `, ${clock(n.seconds)}` : ''}</p>}
          {!disabled && <button type="button" className="pt-link" onClick={() => remove(n)}>Delete</button>}
        </div>
      ))}

      {state === 'recording' ? (
        <div className="ss-recording">
          <span className="dot rec" />
          <span className="ss-clock">{clock(seconds)}</span>
          <span className="ss-live">{live || 'Listening…'}</span>
          <button type="button" className="pt-btn pt-btn-sm" onClick={stop}>Stop and save</button>
        </div>
      ) : (
        <button type="button" className="pt-btn pt-btn-ghost pt-btn-sm" onClick={start} disabled={disabled || state === 'saving'}>
          {state === 'saving' ? 'Saving voice note…' : notes.length ? 'Record another voice note' : 'Record a voice note instead'}
        </button>
      )}
      {error && <p className="pt-error">{error}</p>}
    </div>
  );
}
