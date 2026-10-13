'use client';

import { useState } from 'react';
import { GuideChat } from '@/components/portal/GuideChat';
import { INTAKE_FIELDS } from '@/lib/portal/intake';
import type { ChatTurn, Intake } from '@/lib/portal/types';
import { IntakeForm } from './IntakeForm';

const KEYS = INTAKE_FIELDS.map((f) => f.key);
const NAMES = Object.fromEntries(INTAKE_FIELDS.map((f) => [f.key, f.label]));

interface Props {
  token: string;
  intake: Intake;
  done: boolean;
  /** The AI is switched on (server has a Claude API key) */
  ai: boolean;
  voice: boolean;
  chat: ChatTurn[];
}

/**
 * Step 1: a short conversation with the AI instead of a long form. "Fill in my
 * details" turns it into the intake fields, which the client checks and saves.
 * The form is always there for anyone who prefers it.
 */
export function IntakeStep({ token, intake, done, ai, voice, chat }: Props) {
  const [mode, setMode] = useState<'chat' | 'form'>(ai && !done ? 'chat' : 'form');
  const [values, setValues] = useState<Intake>(intake);
  const [filled, setFilled] = useState(false);
  const [version, setVersion] = useState(0);

  if (mode === 'chat') {
    return (
      <div className="pt-intake-chat">
        <GuideChat
          token={token}
          slideId="INTAKE"
          initial={chat}
          partLabels={KEYS}
          partNames={NAMES}
          voice={voice}
          autoStart
          labels={{
            title: 'Tell us about your brand',
            draft: 'Fill in my details',
            drafting: 'Filling in…',
            draftHeading: 'Here’s what we have so far',
            use: 'Use these details',
            useHint: 'You can check and change them before saving.',
          }}
          onUseDraft={(d) => {
            const picked = Object.fromEntries(Object.entries(d.parts).filter(([k, v]) => KEYS.includes(k as never) && v.trim()));
            setValues((old) => ({ ...old, ...picked }));
            setFilled(true);
            setVersion((v) => v + 1);
            setMode('form');
          }}
        />
        <button type="button" className="pt-link pt-intake-switch" onClick={() => setMode('form')}>
          Prefer a form? Fill it in yourself
        </button>
      </div>
    );
  }

  return (
    <>
      {filled && (
        <p className="pt-intake-filled" role="status">
          We&apos;ve filled this in from your conversation. Check it, change anything that&apos;s not quite right, then save.
        </p>
      )}
      <IntakeForm key={version} token={token} intake={values} done={done} />
      {ai && !done && (
        <button type="button" className="pt-link pt-intake-switch" onClick={() => setMode('chat')}>
          {filled ? 'Back to the conversation' : 'Rather chat? Tell us in a conversation instead'}
        </button>
      )}
    </>
  );
}
