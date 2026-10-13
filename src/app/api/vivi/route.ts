import { NextResponse } from 'next/server';
import { anthropic, FALLBACK, MODEL } from '@/lib/portal/guide';
import { hit, visitorId } from '@/lib/portal/ratelimit';
import { VIVI_LIMITS, viviSystem } from '@/lib/portal/vivi-chat';
import { describePage, isConversationId, saveConversation } from '@/lib/portal/vivi-log';
import type { ChatTurn } from '@/lib/portal/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const BUSY = "Sorry, I can't chat any more just now. You can reach the team through the full ViVi conversation.";

/**
 * ViVi chat on the public pages. Anyone can use it, so: strict transcript
 * checks, short messages, and per-visitor and daily limits. Streams plain text.
 */
export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ViVi is not available.' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.turns) ? body.turns : [];
  if (!raw.length || raw.length > VIVI_LIMITS.messagesPerConversation) {
    return NextResponse.json({ error: 'This conversation is long enough. For anything else, ask the team through the full ViVi conversation.' }, { status: 400 });
  }
  const turns: ChatTurn[] = [];
  for (const [i, t] of raw.entries()) {
    const role = i % 2 === 0 ? 'user' : 'assistant'; // the visitor always speaks first
    const content = (t as ChatTurn)?.content;
    if ((t as ChatTurn)?.role !== role || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'bad conversation' }, { status: 400 });
    }
    // Earlier answers can be long (the sample answers); the visitor's own messages are capped
    if (role === 'user' && content.length > VIVI_LIMITS.charsPerMessage) {
      return NextResponse.json({ error: `Please keep questions under ${VIVI_LIMITS.charsPerMessage} characters.` }, { status: 413 });
    }
    turns.push({ role, content: content.slice(0, 4000) });
  }
  if (turns[turns.length - 1].role !== 'user') return NextResponse.json({ error: 'bad conversation' }, { status: 400 });

  const visitor = visitorId(req);
  const hour = new Date().toISOString().slice(0, 13);
  const [mine, today] = await Promise.all([
    hit(`v:${visitor}:${hour}`),
    hit(`day:${hour.slice(0, 10)}`),
  ]);
  if (mine > VIVI_LIMITS.perVisitorPerHour || today > VIVI_LIMITS.perDay) {
    return NextResponse.json({ error: BUSY }, { status: 429 });
  }

  // Saved for the team area once ViVi has replied
  const conversationId = isConversationId(body?.conversationId) ? body.conversationId : null;
  const where = conversationId ? await describePage(body?.page) : null;

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
      try {
        const s = anthropic().beta.messages.stream({
          model: MODEL,
          max_tokens: 4000,
          ...FALLBACK,
          output_config: { effort: 'low' },
          cache_control: { type: 'ephemeral' },
          system: viviSystem(),
          messages: turns.map((t) => ({ role: t.role, content: t.content })),
        });
        let said = '';
        for await (const event of s) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            said += event.delta.text;
            send(event.delta.text);
          }
        }
        const final = await s.finalMessage();
        if (final.stop_reason === 'refusal' || !said.trim()) {
          const note = (said ? '\n\n' : '') + "Sorry, I can't help with that one. The team can, through the full ViVi conversation.";
          said += note;
          send(note);
        }
        if (conversationId && where) {
          await saveConversation({
            id: conversationId, visitor, page: where.page, workshopId: where.workshopId,
            turns: [...turns, { role: 'assistant', content: said.trim() }],
          }).catch((err) => console.error('saving ViVi conversation failed', err));
        }
      } catch (err) {
        console.error('vivi chat failed', err);
        send('Sorry, something went wrong. Please try again in a moment.');
      }
      finish();
    },
  });
  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
}
