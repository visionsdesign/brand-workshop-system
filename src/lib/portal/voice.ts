// ElevenLabs: questions read aloud, the AI facilitator's spoken replies, and
// speech-to-text for voice notes and spoken replies.
import { createHash } from 'node:crypto';
import { portalStore } from './store';

const API = 'https://api.elevenlabs.io/v1';
/** Questions are generated once and cached, so use the best-sounding model */
const QUESTION_MODEL = process.env.ELEVENLABS_QUESTION_MODEL || 'eleven_multilingual_v2';
/** Facilitator replies are spoken as they arrive, so use the fastest model */
const LIVE_MODEL = process.env.ELEVENLABS_LIVE_MODEL || 'eleven_flash_v2_5';
const STT_MODEL = 'scribe_v2';

export const voiceConfigured = () => Boolean(process.env.ELEVENLABS_API_KEY && process.env.ELEVENLABS_VOICE_ID);
const key = () => process.env.ELEVENLABS_API_KEY!;
const voiceId = () => process.env.ELEVENLABS_VOICE_ID!;

/** A calm, steady read rather than a performance */
const VOICE_SETTINGS = { stability: 0.55, similarity_boost: 0.75, style: 0.1, use_speaker_boost: true, speed: 1.0 };

async function tts(text: string, model: string): Promise<Response> {
  const res = await fetch(`${API}/text-to-speech/${voiceId()}/stream?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key(), 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model, voice_settings: VOICE_SETTINGS }),
  });
  if (!res.ok || !res.body) throw new Error(`ElevenLabs text-to-speech failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
  return res;
}

/**
 * A question read aloud. The same text always gives the same audio, so it is
 * generated once per voice, model and wording, then served from storage.
 */
export async function questionAudio(text: string): Promise<Uint8Array> {
  const hash = createHash('sha256').update(`${voiceId()}|${QUESTION_MODEL}|${text}`).digest('hex').slice(0, 32);
  const path = `tts/${hash}.mp3`;
  const store = portalStore();
  const cached = await store.readBlob(path);
  if (cached) return cached;
  const audio = new Uint8Array(await (await tts(text, QUESTION_MODEL)).arrayBuffer());
  await store.writeBlob(path, audio, 'audio/mpeg');
  return audio;
}

/** A facilitator reply, streamed back as it is generated */
export async function liveSpeech(text: string): Promise<ReadableStream<Uint8Array>> {
  return (await tts(text, LIVE_MODEL)).body!;
}

/** Transcribe a recording; returns null if ElevenLabs isn't configured or fails, so callers can fall back */
export async function transcribe(bytes: Uint8Array, type: string, name = 'audio.webm'): Promise<string | null> {
  if (!process.env.ELEVENLABS_API_KEY) return null;
  try {
    const form = new FormData();
    form.append('model_id', STT_MODEL);
    form.append('file', new Blob([Buffer.from(bytes)], { type: type || 'audio/webm' }), name);
    form.append('tag_audio_events', 'false');
    const res = await fetch(`${API}/speech-to-text`, { method: 'POST', headers: { 'xi-api-key': key() }, body: form });
    if (!res.ok) {
      console.error('ElevenLabs speech-to-text failed', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { text?: string };
    return data.text?.trim() || null;
  } catch (err) {
    console.error('ElevenLabs speech-to-text error', err);
    return null;
  }
}
