'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authClient } from '../../lib/auth-client';

type Workspace = { id: string; name: string; slug: string; role: string; created_at: string };
type Project = { id: string; workspace_id: string; title: string; description: string | null; status: string; created_at: string };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

export default function StudioPage() {
  const [userEmail, setUserEmail] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const request = useCallback(async (path: string, init: RequestInit = {}) => {
    if (!authClient) throw new Error('Konfigurasi Neon Auth belum tersedia.');
    if (!apiBase) throw new Error('Konfigurasi NEXT_PUBLIC_API_BASE_URL belum tersedia.');
    const tokenResult = await authClient.token();
    if (tokenResult.error || !tokenResult.data?.token) throw new Error('Sesi tidak valid. Silakan masuk kembali.');
    const response = await fetch(apiBase + path, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenResult.data.token, ...init.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || 'Permintaan gagal (' + response.status + ').');
    return body;
  }, []);

  const loadWorkspaces = useCallback(async () => {
    const body = await request('/api/v1/workspaces');
    const items = (body.data ?? []) as Workspace[];
    setWorkspaces(items);
    setSelectedWorkspace(current => current && items.some(item => item.id === current) ? current : items[0]?.id ?? '');
  }, [request]);

  const loadProjects = useCallback(async (workspaceId: string) => {
    if (!workspaceId) { setProjects([]); return; }
    const body = await request('/api/v1/projects?workspaceId=' + encodeURIComponent(workspaceId));
    setProjects((body.data ?? []) as Project[]);
  }, [request]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (!authClient) throw new Error('Konfigurasi Neon Auth belum tersedia.');
        const session = await authClient.getSession();
        if (!session.data?.user) {
          window.location.assign('../auth/');
          return;
        }
        if (active) {
          setUserEmail(session.data.user.email ?? '');
          await loadWorkspaces();
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Gagal memuat workspace.');
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    return () => { active = false; };
  }, [loadWorkspaces]);

  useEffect(() => {
    if (!selectedWorkspace) return;
    void loadProjects(selectedWorkspace).catch(cause => setError(cause instanceof Error ? cause.message : 'Gagal memuat proyek.'));
  }, [selectedWorkspace, loadProjects]);

  async function createWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      await request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify({ name: workspaceName }) });
      setWorkspaceName('');
      await loadWorkspaces();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal membuat workspace.'); }
    finally { setBusy(false); }
  }

  async function createProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWorkspace) return;
    setBusy(true); setError('');
    try {
      await request('/api/v1/projects', { method: 'POST', body: JSON.stringify({ workspaceId: selectedWorkspace, title: projectTitle, language: 'id', platforms: [] }) });
      setProjectTitle('');
      await loadProjects(selectedWorkspace);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal membuat proyek.'); }
    finally { setBusy(false); }
  }

  async function signOut() {
    await authClient?.signOut();
    window.location.assign('../auth/');
  }

  if (!ready) return <main className="studio-shell"><p className="eyebrow">CONTENT STUDIO</p><h1>Memuat workspace…</h1></main>;

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="brand"><span className="mark">✦</span><span>CONTENT STUDIO</span></Link>
        <div className="studio-user"><span>{userEmail}</span><button type="button" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="studio-heading"><p className="eyebrow">CREATOR WORKSPACE</p><h1>Ruang produksi Anda.</h1><p>Mulai dengan workspace, lalu buat proyek konten pertama Anda.</p></section>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <section className="studio-columns">
        <div className="studio-panel">
          <p className="eyebrow">WORKSPACES</p><h2>Tim & ruang kerja</h2>
          <form onSubmit={createWorkspace} className="inline-form">
            <input aria-label="Nama workspace baru" placeholder="Nama workspace baru" value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} required minLength={2} maxLength={100} />
            <button type="submit" disabled={busy}>Buat</button>
          </form>
          <div className="workspace-list">
            {workspaces.map(workspace => <button key={workspace.id} type="button" className={selectedWorkspace === workspace.id ? 'workspace-item selected' : 'workspace-item'} onClick={() => setSelectedWorkspace(workspace.id)}><span>{workspace.name}</span><small>{workspace.role}</small></button>)}
            {workspaces.length === 0 && <p className="empty-state">Belum ada workspace. Buat ruang kerja pertama Anda.</p>}
          </div>
        </div>
        <div className="studio-panel">
          <p className="eyebrow">PROJECTS</p><h2>Proyek konten</h2>
          <form onSubmit={createProject} className="inline-form">
            <input aria-label="Judul proyek baru" placeholder="Judul proyek baru" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} required minLength={1} maxLength={160} disabled={!selectedWorkspace} />
            <button type="submit" disabled={busy || !selectedWorkspace}>Buat</button>
          </form>
          <div className="project-list">
            {projects.map(project => <article className="project-item" key={project.id}><strong>{project.title}</strong><span>{project.status}</span></article>)}
            {selectedWorkspace && projects.length === 0 && <p className="empty-state">Belum ada proyek di workspace ini.</p>}
            {!selectedWorkspace && <p className="empty-state">Pilih atau buat workspace untuk mulai membuat proyek.</p>}
          </div>
        </div>
      </section>
      <footer><span>AI CONTENT PRODUCTION STUDIO</span><span>Data workspace tersimpan pada Neon development.</span></footer>
    </main>
  );
}
