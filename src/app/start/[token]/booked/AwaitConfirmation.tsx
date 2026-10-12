'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/** While Cal.com's confirmation is on its way, refresh the page every few seconds (for up to a minute) */
export function AwaitConfirmation() {
  const router = useRouter();
  useEffect(() => {
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      router.refresh();
      if (n >= 20) clearInterval(id);
    }, 3000);
    return () => clearInterval(id);
  }, [router]);
  return null;
}
