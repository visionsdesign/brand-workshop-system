'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/** Scales a 1920 × 1080 slide to fit its container, letterboxed and centred. */
export function SlideFrame({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(el.clientWidth / 1920, el.clientHeight / 1080));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={box} className={`slide-frame ${className ?? ''}`}>
      <div
        className="slide-frame-inner"
        style={{ width: 1920 * scale, height: 1080 * scale, visibility: scale ? 'visible' : 'hidden' }}
      >
        <div style={{ transform: `scale(${scale})`, transformOrigin: '0 0' }}>{children}</div>
      </div>
    </div>
  );
}
