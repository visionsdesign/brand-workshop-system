'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import type { WorkshopFile } from '@/lib/portal/types';

interface Props {
  workshopId: string;
  /** The client's private link token; omitted for the team, who use their session */
  token?: string;
  files: WorkshopFile[];
}

const size = (b: number) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Upload and list workshop files. Uploads go straight to storage, so large files never pass through our server on Netlify. */
export function Uploader({ workshopId, token, files }: Props) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [over, setOver] = useState(false);
  const headers: Record<string, string> = token ? { 'x-workshop-token': token } : {};

  async function uploadOne(file: File) {
    const target = await fetch('/api/portal/files/target', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ workshopId, name: file.name, size: file.size, type: file.type }),
    }).then(async (r) => (r.ok ? r.json() : Promise.reject(new Error((await r.json()).error ?? 'Upload refused'))));

    const put =
      target.kind === 'supabase'
        ? await fetch(target.signedUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file })
        : await fetch(`/api/portal/files/local?path=${encodeURIComponent(target.path)}&workshopId=${workshopId}`, {
            method: 'PUT',
            headers,
            body: file,
          });
    if (!put.ok) throw new Error('The upload did not finish. Please try again.');

    const done = await fetch('/api/portal/files/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ workshopId, path: target.path, name: file.name, size: file.size, type: file.type }),
    });
    if (!done.ok) throw new Error('The upload could not be saved. Please try again.');
  }

  async function upload(list: FileList | File[]) {
    setError('');
    for (const f of Array.from(list)) {
      setBusy(`Uploading ${f.name}…`);
      try {
        await uploadOne(f);
      } catch (e) {
        setError(`${f.name}: ${(e as Error).message}`);
      }
    }
    setBusy(null);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  async function remove(f: WorkshopFile) {
    if (!window.confirm(`Remove ${f.name}?`)) return;
    await fetch(`/api/portal/files/${f.id}`, { method: 'DELETE', headers });
    router.refresh();
  }

  return (
    <div className="pt-upload">
      <div
        className={`pt-drop ${over ? 'is-over' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
      >
        <p>Drop files here, or</p>
        <button type="button" className="pt-btn pt-btn-ghost" onClick={() => input.current?.click()} disabled={!!busy}>
          Choose files
        </button>
        <input ref={input} type="file" multiple hidden onChange={(e) => e.target.files && upload(e.target.files)} />
        <p className="pt-hint">Briefs, brand guidelines, logos, screenshots, decks. Up to 50 MB each.</p>
      </div>
      {busy && <p className="pt-hint" role="status">{busy}</p>}
      {error && <p className="pt-error" role="alert">{error}</p>}
      {files.length > 0 && (
        <ul className="pt-files">
          {files.map((f) => (
            <li key={f.id}>
              <a href={`/api/portal/files/${f.id}${token ? `?t=${encodeURIComponent(token)}` : ''}`}>{f.name}</a>
              <span>{size(f.size)}{!token && ` · ${f.uploadedBy === 'team' ? 'Visions' : 'Client'}`}</span>
              {(!token || f.uploadedBy === 'client') && (
                <button type="button" className="pt-link" onClick={() => remove(f)}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
