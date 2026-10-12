import { plain } from '@/components/Rich';
import { isAnswered, partsFor, selfServeWorkshop } from '@/lib/portal/selfserve';
import type { PortalWorkshop, WorkshopFile } from '@/lib/portal/types';

const clock = (s: number | null) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');

/** Every self-serve answer, slide by slide, with voice notes and their transcripts */
export function TeamAnswers({ w, voice }: { w: PortalWorkshop; voice: WorkshopFile[] }) {
  const slides = selfServeWorkshop(w).slides;
  const count = slides.filter((s) => isAnswered(s, w.answers[s.id], voice.filter((v) => v.slideId === s.id).length)).length;

  return (
    <section className="tm-card tm-answers">
      <div className="tm-row tm-answers-head">
        <h2>Answers <small className="tm-muted">{count} of {slides.length}</small></h2>
        <a className="btn" href={`/api/portal/answers/export?workshopId=${w.id}`}>Download answers (.md)</a>
      </div>
      {w.submittedAt && <p className="tm-muted tm-small">Submitted {new Date(w.submittedAt).toLocaleString('en-GB')}</p>}

      {slides.map((s) => {
        const a = w.answers[s.id];
        const notes = voice.filter((v) => v.slideId === s.id);
        const done = isAnswered(s, a, notes.length);
        return (
          <article key={s.id} className={`tm-ans ${done ? '' : 'is-empty'}`}>
            <header>
              <span className="tm-ans-id">{s.id}</span> {s.title}
            </header>
            <p className="tm-ans-q">{plain(s.question) || plain(s.sub)}</p>
            {!done && <p className="tm-muted">No answer</p>}

            {s.scales && (
              <ul className="tm-ans-list">
                {s.scales.map(([l, r], i) => {
                  const v = a?.values?.[`${s.id}.scale.${i}`];
                  return typeof v === 'number' ? <li key={l}>{l} ↔ {r}: <b>{v}/10</b></li> : null;
                })}
              </ul>
            )}
            {s.groups && (
              <ul className="tm-ans-list">
                {s.groups.map((g, i) => {
                  const v = a?.values?.[`${s.id}.q${i}`];
                  return typeof v === 'number' ? <li key={g.q}>{g.q} <b>{g.options[v]}</b></li> : null;
                })}
              </ul>
            )}
            {partsFor(s).map((p) =>
              a?.parts?.[p.key]?.trim() ? (
                <p key={p.key} className="tm-ans-text"><b>{p.label}:</b> {a.parts[p.key]}</p>
              ) : null,
            )}
            {a?.text?.trim() && <p className="tm-ans-text">{a.text}</p>}
            {a?.chat?.length ? (
              <details className="tm-chat">
                <summary>AI facilitator conversation ({a.chat.length} {a.chat.length === 1 ? "message" : "messages"})</summary>
                {a.chat.map((t, i) => (
                  <p key={i}><span className="who">{t.role === 'user' ? w.contactName.split(' ')[0] || 'Client' : 'AI'}:</span> {t.content}</p>
                ))}
              </details>
            ) : null}
            {notes.map((n) => (
              <div key={n.id} className="tm-voice">
                <audio controls preload="none" src={`/api/portal/files/${n.id}`} />
                <span className="tm-muted">{clock(n.seconds)}</span>
                <p>{n.transcript?.trim() || <span className="tm-muted">No transcript: listen to the recording.</span>}</p>
              </div>
            ))}
          </article>
        );
      })}
    </section>
  );
}
