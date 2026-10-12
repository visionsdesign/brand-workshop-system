'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import type { DriveFile } from '@/lib/portal/drive';

interface Listing {
  configured?: boolean;
  account?: string;
  root?: string;
  folder?: { id: string; name: string };
  files?: DriveFile[];
  error?: string;
}

const kind = (f: DriveFile) => {
  if (f.isFolder) return 'Folder';
  if (f.mimeType.includes('document')) return 'Doc';
  if (f.mimeType.includes('spreadsheet')) return 'Sheet';
  if (f.mimeType.includes('presentation')) return 'Slides';
  if (f.mimeType === 'application/pdf') return 'PDF';
  if (f.mimeType.startsWith('image/')) return 'Image';
  return 'File';
};
const size = (b: number | null) => (b === null ? '' : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** The workshop's Google Drive folder: browse it, open files in Drive, or import them into the workshop files */
export function DriveFiles({ workshopId, folderUrl }: { workshopId: string; folderUrl: string }) {
  const router = useRouter();
  const [trail, setTrail] = useState<{ id: string; name: string }[]>([]);
  const [data, setData] = useState<Listing | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async (folder?: string) => {
    setData(null);
    const q = new URLSearchParams({ workshopId, ...(folder ? { folder } : {}) });
    const res: Listing = await fetch(`/api/team/drive?${q}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ error: 'Could not load the folder.' }));
    setData(res);
    if (res.folder) {
      setTrail((t) => {
        const at = t.findIndex((x) => x.id === res.folder!.id);
        return at >= 0 ? t.slice(0, at + 1) : res.folder!.id === res.root ? [res.folder!] : [...t, res.folder!];
      });
    }
  }, [workshopId]);

  useEffect(() => {
    setTrail([]);
    load();
  }, [load, folderUrl]);

  async function importFile(f: DriveFile) {
    setBusy(f.id);
    setMsg('');
    const r = await fetch('/api/team/drive/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workshopId, fileId: f.id }),
    });
    const res = await r.json().catch(() => null);
    setBusy(null);
    if (!r.ok) setMsg(res?.error ?? 'The import did not work.');
    else {
      setMsg(`Imported ${res.name}`);
      router.refresh();
    }
  }

  if (data && data.configured === false) {
    return (
      <p className="tm-muted tm-small">
        Google Drive isn&apos;t connected yet. <a href={folderUrl} target="_blank" rel="noreferrer">Open the folder in Drive ↗</a>
      </p>
    );
  }

  return (
    <div className="tm-drive-box">
      <div className="tm-drive-head">
        <span className="tm-drive-trail">
          {trail.map((t, i) => (
            <span key={t.id}>
              {i > 0 && ' / '}
              {i < trail.length - 1 ? <button className="pt-link" onClick={() => load(t.id)}>{t.name}</button> : <b>{t.name}</b>}
            </span>
          ))}
        </span>
        <a href={folderUrl} target="_blank" rel="noreferrer">Open in Drive ↗</a>
      </div>

      {!data && <p className="tm-muted tm-small">Loading Drive folder…</p>}
      {data?.error && <p className="pt-error tm-small">{data.error}</p>}
      {data?.files && data.files.length === 0 && <p className="tm-muted tm-small">This folder is empty.</p>}

      {data?.files && data.files.length > 0 && (
        <ul className="tm-drive-list">
          {data.files.map((f) => (
            <li key={f.id}>
              <span className="tm-drive-kind">{kind(f)}</span>
              {f.isFolder ? (
                <button className="pt-link tm-drive-name" onClick={() => load(f.id)}>{f.name}</button>
              ) : (
                <a className="tm-drive-name" href={f.webViewLink} target="_blank" rel="noreferrer">{f.name}</a>
              )}
              <span className="tm-muted">{size(f.size)}</span>
              {!f.isFolder && (
                <button className="btn" disabled={busy !== null} onClick={() => importFile(f)}>
                  {busy === f.id ? 'Importing…' : 'Import'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {msg && <p className="tm-small" role="status">{msg}</p>}
    </div>
  );
}
