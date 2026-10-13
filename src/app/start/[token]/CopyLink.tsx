'use client';

import { useEffect, useState } from 'react';

const pageUrl = () => window.location.href.split('?')[0];

export function CopyLink() {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="pt-btn pt-btn-ghost pt-btn-sm"
      onClick={() => navigator.clipboard.writeText(pageUrl()).then(() => setCopied(true))}
    >
      {copied ? 'Link copied' : 'Copy my link'}
    </button>
  );
}

/**
 * The private link, shown big until the intake is done: it's the only way
 * back to this page. "Email it to me" opens their own mail app with the link
 * filled in, so it works without us sending email.
 */
export function KeepLink({ email, paid }: { email: string; paid: boolean }) {
  const [url, setUrl] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => setUrl(pageUrl()), []);

  const mailto = url
    ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('My Visions brand workshop link')}&body=${encodeURIComponent(
        `My private link to the Visions Design brand workshop page:\n\n${url}\n\nAnyone with this link can see and edit my answers, so keep it private.`,
      )}`
    : undefined;

  return (
    <section className="pt-keeplink" aria-labelledby="keeplink-title">
      {paid && <p className="pt-keeplink-paid">Payment received, thank you. Your VAT invoice is on its way by email.</p>}
      <h2 id="keeplink-title">Save your private link first</h2>
      <p>
        This link is the only way back to this page. Bookmark it, or email it to yourself. Anyone with the link can see
        and edit your answers, so keep it private.
      </p>
      <div className="pt-keeplink-row">
        <input readOnly value={url} aria-label="Your private link" onFocus={(e) => e.currentTarget.select()} />
        <button
          type="button"
          className="pt-btn"
          disabled={!url}
          onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}
        >
          {copied ? 'Copied' : 'Copy link'}
        </button>
        <a className="pt-btn pt-btn-ghost" href={mailto}>
          Email it to me
        </a>
      </div>
    </section>
  );
}
