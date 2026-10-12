'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

interface Props {
  token: string;
  workshopId: string;
  calLink: string;
  name: string;
  email: string;
}

type CalFn = ((...args: unknown[]) => void) & { ns?: Record<string, (...args: unknown[]) => void>; loaded?: boolean; q?: unknown[] };

/** Cal.com's official embed loader, namespaced so it can't clash with anything else on the page */
function loadCal(): CalFn {
  const w = window as unknown as { Cal?: CalFn };
  if (!w.Cal) {
    // Adapted from Cal.com's embed snippet
    (function (C: Window & { Cal?: CalFn }, A: string, L: string) {
      const p = (a: { q: unknown[] }, ar: unknown) => a.q.push(ar);
      const d = C.document;
      C.Cal = C.Cal || (function (this: unknown, ...ar: unknown[]) {
        const cal = C.Cal!;
        if (!cal.loaded) {
          cal.ns = {};
          cal.q = cal.q || [];
          d.head.appendChild(d.createElement('script')).src = A;
          cal.loaded = true;
        }
        if (ar[0] === L) {
          const api = (function (...a: unknown[]) { p(api as unknown as { q: unknown[] }, a); }) as unknown as CalFn;
          const namespace = ar[1];
          (api as unknown as { q: unknown[] }).q = (api as unknown as { q?: unknown[] }).q || [];
          if (typeof namespace === 'string') {
            cal.ns![namespace] = cal.ns![namespace] || api;
            p(cal.ns![namespace] as unknown as { q: unknown[] }, ar);
            p(cal as unknown as { q: unknown[] }, ['initNamespace', namespace]);
          } else p(cal as unknown as { q: unknown[] }, ar);
          return;
        }
        p(cal as unknown as { q: unknown[] }, ar);
      } as CalFn);
    })(window as Window & { Cal?: CalFn }, 'https://app.cal.com/embed/embed.js', 'init');
  }
  return w.Cal!;
}

/** Step 3 for guided clients: pick a slot. The booking carries the workshop ID so Cal.com's webhook can match it. */
export function CalBooking({ token, workshopId, calLink, name, email }: Props) {
  const router = useRouter();
  const box = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const Cal = loadCal();
    Cal('init', 'workshop', { origin: 'https://cal.com' });
    const ns = Cal.ns!.workshop;
    ns('inline', {
      elementOrSelector: '#cal-workshop',
      calLink,
      config: { name, email, 'metadata[workshopId]': workshopId, layout: 'month_view', theme: 'dark' },
    });
    ns('ui', { theme: 'dark', hideEventTypeDetails: false, layout: 'month_view' });

    const onBooked = async (e: { detail?: { data?: Record<string, any> } }) => {
      const d = e.detail?.data ?? {};
      const b = d.booking ?? d;
      setSaving(true);
      await fetch('/api/portal/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workshop-token': token },
        body: JSON.stringify({ uid: b.uid ?? null, start: b.startTime ?? d.startTime ?? null, end: b.endTime ?? d.endTime ?? null }),
      }).catch(() => null);
      router.refresh();
    };
    ns('on', { action: 'bookingSuccessfulV2', callback: onBooked });
    ns('on', { action: 'bookingSuccessful', callback: onBooked });
  }, [calLink, email, name, router, token, workshopId]);

  return (
    <div className="pt-cal">
      <div id="cal-workshop" ref={box} className="pt-cal-frame" />
      {saving && <p className="pt-hint" role="status">Saving your booking…</p>}
    </div>
  );
}
