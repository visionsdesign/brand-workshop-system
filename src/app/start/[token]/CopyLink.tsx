'use client';

import { useState } from 'react';

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pt-btn pt-btn-ghost pt-btn-sm"
      onClick={() => {
        const url = window.location.href.split('?')[0];
        navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
    >
      {copied ? 'Link copied' : 'Copy my link'}
    </button>
  );
}
