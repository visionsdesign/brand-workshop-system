import { Fragment, type ReactNode } from 'react';

/**
 * Renders slide copy marks: **strong** (full white) and ((muted)) (40%).
 * "\n\n" starts a new paragraph, "\n" is a line break.
 */
export function Rich({ text }: { text?: string }) {
  if (!text) return null;
  const paras = text.split('\n\n');
  return (
    <>
      {paras.map((p, i) => (
        <span key={i} className="rich-p">
          {p.split('\n').map((line, j) => (
            <Fragment key={j}>
              {j > 0 && <br />}
              {marks(line)}
            </Fragment>
          ))}
        </span>
      ))}
    </>
  );
}

function marks(line: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\(\((.+?)\)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push(line.slice(last, m.index));
    out.push(
      m[1] !== undefined
        ? <span key={m.index} className="rich-strong">{m[1]}</span>
        : <span key={m.index} className="rich-muted">{m[2]}</span>,
    );
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push(line.slice(last));
  return out;
}

/** Plain text version for lists and notes */
export const plain = (text?: string) => (text ?? '').replace(/\*\*(.+?)\*\*|\(\((.+?)\)\)/g, '$1$2').replace(/\n+/g, ' ');
