'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authClient } from '../../lib/auth-client';

type Workspace = { id: string; name: string; slug: string; role: string; created_at: string };
type Project = { id: string; workspace_id: string; title: string; description: string | null; status: string; created_at: string };
type Script = { id: string; project_id: string; title: string; hook: string | null; body: string; status: string; version: number; updated_at: string };

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');

export default function StudioPage() {
  const [userEmail, setUserEmail] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [projectTitle, setProjectTitle] = useState('');
  const [scriptTitle, setScriptTitle] = useState('');
  const [scriptBody, setScriptBody] = useState('');
  const [editingScriptId, setEditingScriptId] = useState('');
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
    if (!workspaceId) { setProjects([]); setSelectedProject(''); return; }
    const body = await request('/api/v1/projects?workspaceId=' + encodeURIComponent(workspaceId));
    const items = (body.data ?? []) as Project[];
    setProjects(items);
    setSelectedProject(current => current && items.some(item => item.id === current) ? current : items[0]?.id ?? '');
  }, [request]);

  const loadScripts = useCallback(async (projectId: string) => {
    if (!projectId) { setScripts([]); return; }
    const body = await request('/api/v1/projects/' + encodeURIComponent(projectId) + '/scripts');
    setScripts((body.data ?? []) as Script[]);
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

  useEffect(() => {
    if (!selectedProject) { setScripts([]); return; }
    void loadScripts(selectedProject).catch(cause => setError(cause instanceof Error ? cause.message : 'Gagal memuat naskah.'));
  }, [selectedProject, loadScripts]);

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

  async function saveScript(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    setBusy(true); setError('');
    try {
      const payload = { title: scriptTitle, body: scriptBody, language: 'id', outline: [] };
      if (editingScriptId) {
        await request('/api/v1/scripts/' + editingScriptId, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        await request('/api/v1/projects/' + selectedProject + '/scripts', { method: 'POST', body: JSON.stringify(payload) });
      }
      setScriptTitle(''); setScriptBody(''); setEditingScriptId('');
      await loadScripts(selectedProject);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan naskah.'); }
    finally { setBusy(false); }
  }

  function editScript(script: Script) {
    setEditingScriptId(script.id);
    setScriptTitle(script.title);
    setScriptBody(script.body);
  }

  function cancelEdit() {
    setEditingScriptId('');
    setScriptTitle('');
    setScriptBody('');
  }

  async function signOut() {
    await authClient?.signOut();
    window.location.assign('../auth/');
  }

  const selectedRole = workspaces.find(item => item.id === selectedWorkspace)?.role ?? '';
  const canEdit = ['owner', 'admin', 'editor'].includes(selectedRole);

  if (!ready) return <main className="studio-shell"><p className="eyebrow">CONTENT STUDIO</p><h1>Memuat workspace…</h1></main>;

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link href="/" className="brand"><span className="mark">✦</span><span>CONTENT STUDIO</span></Link>
        <div className="studio-user"><span>{userEmail}</span><button type="button" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="studio-heading"><p className="eyebrow">CREATOR WORKSPACE</p><h1>Ruang produksi Anda.</h1><p>Kelola workspace, proyek, dan draf naskah dalam satu alur kerja.</p></section>
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
            <input aria-label="Judul proyek baru" placeholder="Judul proyek baru" value={projectTitle} onChange={e => setProjectTitle(e.target.value)} required minLength={1} maxLength={160} disabled={!selectedWorkspace || !canEdit} />
            <button type="submit" disabled={busy || !selectedWorkspace || !canEdit}>Buat</button>
          </form>
          <div className="project-list">
            {projects.map(project => <button type="button" className={selectedProject === project.id ? 'project-item selected' : 'project-item'} key={project.id} onClick={() => setSelectedProject(project.id)}><strong>{project.title}</strong><span>{project.status}</span></button>)}
            {selectedWorkspace && projects.length === 0 && <p className="empty-state">Belum ada proyek di workspace ini.</p>}
            {!selectedWorkspace && <p className="empty-state">Pilih atau buat workspace untuk mulai membuat proyek.</p>}
          </div>
          <div className="script-editor">
            <p className="eyebrow">SCRIPT STUDIO</p><h2>{editingScriptId ? 'Edit draf naskah' : 'Naskah baru'}</h2>
            <form onSubmit={saveScript} className="script-form">
              <input aria-label="Judul naskah" placeholder="Judul naskah" value={scriptTitle} onChange={e => setScriptTitle(e.target.value)} required minLength={1} maxLength={160} disabled={!selectedProject || !canEdit} />
              <textarea aria-label="Isi naskah" placeholder="Tulis hook, alur cerita, isi, dan ajakan bertindak…" value={scriptBody} onChange={e => setScriptBody(e.target.value)} rows={7} maxLength={100000} disabled={!selectedProject || !canEdit} />
              <div className="script-actions">
                <button type="submit" disabled={busy || !selectedProject || !canEdit}>{editingScriptId ? 'Simpan perubahan' : 'Simpan draf'}</button>
                {editingScriptId && <button type="button" className="cancel-edit" onClick={cancelEdit}>Batal</button>}
              </div>
            </form>
            <div className="script-list">
              {scripts.map(script => <article className="script-item" key={script.id}><div><strong>{script.title}</strong><small>{script.status} · v{script.version}</small></div><button type="button" onClick={() => editScript(script)} disabled={!canEdit}>Edit</button></article>)}
              {selectedProject && scripts.length === 0 && <p className="empty-state">Belum ada naskah untuk proyek ini.</p>}
              {!selectedProject && <p className="empty-state">Pilih proyek untuk mulai menulis naskah.</p>}
            </div>
          </div>
        </div>
      </section>
      <footer><span>AI CONTENT PRODUCTION STUDIO</span><span>Data tersimpan pada Neon development.</span></footer>
    </main>
  );
}
