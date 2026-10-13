import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server';
import { resolveAccess } from '@/lib/portal/access';
import {
  anthropic, chatSystem, chatTurnsUsed, draftSchema, draftSystem, FALLBACK, guideAvailable, LIMITS, MODEL, toMessages,
} from '@/lib/portal/guide';
import { markStarted, partsFor, selfServeWorkshop } from '@/lib/portal/selfserve';
import { portalStore } from '@/lib/portal/store';
import type { ChatTurn } from '@/lib/portal/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SORRY = "Sorry, I can't help with that one. You can type your answer in the box instead.";

/**
 * AI-guided self-serve, client only.
 *  mode "chat":  streams the facilitator's next message as plain text and saves the transcript
 *  mode "draft": returns { text, parts } drafted from the transcript
 */
export async function POST(req: Request) {
  if (!guideAvailable()) return NextResponse.json({ error: 'The AI facilitator is not switched on.' }, { status: 404 });
  const access = await resolveAccess({ token: req.headers.get('x-workshop-token') });
  if (!access || access.by !== 'client') return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  const w = access.workshop;
  if (w.tier !== 'self_serve' || w.status === 'complete') {
    return NextResponse.json({ error: 'The AI facilitator is not available for this workshop.' }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const slide = selfServeWorkshop(w).slides.find((s) => s.id === body?.slideId);
  if (!slide) return NextResponse.json({ error: 'unknown slide' }, { status: 400 });

  // The transcript comes from the client: check its shape strictly before it goes anywhere near the model
  const raw: unknown[] = Array.isArray(body?.turns) ? body.turns : [];
  const turns: ChatTurn[] = [];
  for (const [i, t] of raw.entries()) {
    const role = i % 2 === 0 ? 'assistant' : 'user'; // the facilitator always speaks first
    const content = (t as ChatTurn)?.content;
    if ((t as ChatTurn)?.role !== role || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'bad transcript' }, { status: 400 });
    }
    turns.push({ role, content: content.slice(0, LIMITS.charsPerMessage) });
  }
  if (turns.length > LIMITS.turnsPerQuestion) {
    return NextResponse.json({ error: 'This conversation is long enough. Press "Draft my answer", or type your answer in the box.' }, { status: 429 });
  }
  if (chatTurnsUsed(w) - (w.answers[slide.id]?.chat?.length ?? 0) + turns.length > LIMITS.turnsPerWorkshop) {
    return NextResponse.json({ error: 'You have reached the limit for AI conversations on this workshop. Please type your answers.' }, { status: 429 });
  }
  const store = portalStore();

  if (body?.mode === 'draft') {
    if (!turns.some((t) => t.role === 'user')) return NextResponse.json({ error: 'Reply at least once first.' }, { status: 400 });
    try {
      const res = await anthropic().beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        ...FALLBACK,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: draftSchema(slide) } },
        system: draftSystem(w, slide),
        messages: [
          ...toMessages(turns),
          { role: 'user', content: '[The client pressed "Draft my answer". Write their answer now.]' },
        ],
      });
      if (res.stop_reason === 'refusal') return NextResponse.json({ error: SORRY }, { status: 422 });
      const text = res.content.find((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')?.text ?? '';
      const parsed = JSON.parse(text) as { text?: string; parts?: Record<string, string> };
      const allowed = new Set(partsFor(slide).map((p) => p.key));
      return NextResponse.json({
        text: String(parsed.text ?? '').slice(0, 8000),
        parts: Object.fromEntries(Object.entries(parsed.parts ?? {}).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, String(v).slice(0, 8000)])),
      });
    } catch (err) {
      console.error('guide draft failed', err);
      return NextResponse.json({ error: 'The draft did not work this time. Please try again.' }, { status: 502 });
    }
  }

  // Chat: the transcript must end with the client's message (or be empty, to open the conversation)
  if (turns.length && turns[turns.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'bad transcript' }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // The visitor can close the chat mid-reply; after that, sending more must not throw
      let open = true;
      const send = (text: string) => {
        if (!open) return;
        try { controller.enqueue(encoder.encode(text)); } catch { open = false; }
      };
      const finish = () => {
        if (!open) return;
        open = false;
        try { controller.close(); } catch { /* already closed */ }
      };
      let reply = '';
      try {
        const s = anthropic().beta.messages.stream({
          model: MODEL,
          max_tokens: 8000,
          ...FALLBACK,
          output_config: { effort: 'low' },
          cache_control: { type: 'ephemeral' },
          system: chatSystem(w, slide),
          messages: toMessages(turns),
        });
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            reply += event.delta.text;
            send(event.delta.text);
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === 'refusal') {
          const note = reply ? `\n\n${SORRY}` : SORRY;
          reply += note;
          send(note);
        }
      } catch (err) {
        console.error('guide chat failed', err);
        const note = reply ? '\n\n(The connection dropped. Send your message again.)' : 'Sorry, something went wrong. Please try again in a moment.';
        send(note);
        finish();
        return; // don't save a broken turn
      }
      if (reply.trim()) {
        await store.mergeAnswer(w.id, slide.id, { chat: [...turns, { role: 'assistant', content: reply.trim() }] });
        await markStarted(w);
      }
      finish();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
