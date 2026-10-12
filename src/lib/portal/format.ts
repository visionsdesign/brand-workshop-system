import type { Booking } from './types';

const LONDON = { timeZone: 'Europe/London' } as const;

/** "Tuesday 20 October 2026" / "10:00 to 12:00 BST", in UK time */
export function sessionWhen(b: Booking | null): { date: string; time: string } | null {
  if (!b?.start) return null;
  const start = new Date(b.start);
  const date = start
    .toLocaleDateString('en-GB', { ...LONDON, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    .replace(',', ''); // "Tuesday 20 October 2026", not "Tuesday, 20 October 2026"
  const t = (d: Date) => d.toLocaleTimeString('en-GB', { ...LONDON, hour: '2-digit', minute: '2-digit' });
  const zone = start.toLocaleTimeString('en-GB', { ...LONDON, timeZoneName: 'short' }).split(' ').pop();
  const time = b.end ? `${t(start)} to ${t(new Date(b.end))} ${zone}` : `${t(start)} ${zone}`;
  return { date, time };
}
