'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { authClient } from '../../../lib/auth-client';

type Source = {
  id: string; title: string; url: string | null; source_type: string; excerpt: string | null;
  license_status: string; rights_notes: string | null; source_domain: string | null; created_at: string;
};
type Report = {
  id: string; topic: string; audience: string | null; language: string; status: string;
  report: { summary?: string; keyFindings?: string[]; recommendations?: string[]; sourceIds?: string[]; limitations?: string };
  created_at: string;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
const licenseOptions = [
  ['unknown', 'Belum diverifikasi'],
  ['public_domain', 'Public domain'],
  ['cc0', 'CC0'],
  ['cc_by', 'CC BY'],
  ['cc_by_sa', 'CC BY-SA'],
  ['licensed', 'Lisensi/izin tersedia'],
  ['permission_required', 'Perlu izin'],
  ['restricted', 'Dilarang digunakan'],
];

export default function ResearchDeskPage() {
  const [projectId, setProjectId] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('url');
  const [licenseStatus, setLicenseStatus] = useState('unknown');
  const [sourceExcerpt, setSourceExcerpt] = useState('');
  const [rightsNotes, setRightsNotes] = useState('');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [summary, setSummary] = useState('');
  const [findings, setFindings] = useState('');
  const [recommendations, setRecommendations] = useState('');
  const [limitations, setLimitations] = useState('');
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
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

  const loadData = useCallback(async (id: string) => {
    const [sourceBody, reportBody] = await Promise.all([
      request('/api/v1/projects/' + encodeURIComponent(id) + '/research-sources'),
      request('/api/v1/projects/' + encodeURIComponent(id) + '/research-reports'),
    ]);
    setSources((sourceBody.data ?? []) as Source[]);
    setReports((reportBody.data ?? []) as Report[]);
    setCanEdit(['owner', 'admin', 'editor'].includes(sourceBody.role));
  }, [request]);

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        if (!authClient) throw new Error('Konfigurasi Neon Auth belum tersedia.');
        const session = await authClient.getSession();
        if (!session.data?.user) {
          window.location.assign('../../auth/');
          return;
        }
        const id = new URLSearchParams(window.location.search).get('projectId') ?? '';
        if (!id) throw new Error('Project ID tidak ditemukan. Buka Research Desk dari dashboard proyek.');
        if (active) {
          setUserEmail(session.data.user.email ?? '');
          setProjectId(id);
          await loadData(id);
        }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Gagal memuat Research Desk.');
      } finally {
        if (active) setReady(true);
      }
    }
    void init();
    return () => { active = false; };
  }, [loadData]);

  async function addSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    setBusy(true); setError('');
    try {
      await request('/api/v1/projects/' + projectId + '/research-sources', {
        method: 'POST',
        body: JSON.stringify({
          title: sourceTitle, url: sourceUrl.trim() || null, sourceType, licenseStatus,
          excerpt: sourceExcerpt || null, rightsNotes: rightsNotes || null,
        }),
      });
      setSourceTitle(''); setSourceUrl(''); setSourceExcerpt(''); setRightsNotes('');
      await loadData(projectId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan sumber.'); }
    finally { setBusy(false); }
  }

  async function addReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!projectId) return;
    setBusy(true); setError('');
    try {
      await request('/api/v1/projects/' + projectId + '/research-reports', {
        method: 'POST',
        body: JSON.stringify({
          topic, audience: audience || null, language: 'id',
          report: {
            summary,
            keyFindings: findings.split('\n').map(item => item.trim()).filter(Boolean),
            recommendations: recommendations.split('\n').map(item => item.trim()).filter(Boolean),
            sourceIds: selectedSourceIds,
            limitations,
          },
        }),
      });
      setTopic(''); setAudience(''); setSummary(''); setFindings(''); setRecommendations(''); setLimitations(''); setSelectedSourceIds([]);
      await loadData(projectId);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Gagal menyimpan laporan.'); }
    finally { setBusy(false); }
  }

  function toggleSource(id: string, checked: boolean) {
    setSelectedSourceIds(current => checked ? [...current, id] : current.filter(item => item !== id));
  }

  async function signOut() {
    await authClient?.signOut();
    window.location.assign('../../auth/');
  }

  if (!ready) return <main className="studio-shell"><p className="eyebrow">RESEARCH DESK</p><h1>Memuat data riset…</h1></main>;

  return (
    <main className="studio-shell">
      <header className="studio-topbar">
        <Link href="/studio/" className="brand"><span className="mark">✦</span><span>CONTENT STUDIO</span></Link>
        <div className="studio-user"><span>{userEmail}</span><button type="button" onClick={signOut}>Keluar</button></div>
      </header>
      <section className="studio-heading"><p className="eyebrow">RESEARCH DESK · PROJECT {projectId.slice(0, 8)}</p><h1>Riset dengan jejak sumber.</h1><p>Catat sumber, status hak penggunaan, temuan, rekomendasi, dan batasan riset. Sumber tidak otomatis dianggap bebas digunakan.</p></section>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!canEdit && <p className="auth-notice">Akses baca saja: hanya owner, admin, dan editor yang dapat menambahkan sumber atau laporan.</p>}
      <section className="research-grid">
        <div className="studio-panel">
          <p className="eyebrow">SOURCE REGISTER</p><h2>Daftarkan sumber</h2>
          <form onSubmit={addSource} className="research-form">
            <label>Judul sumber<input value={sourceTitle} onChange={e => setSourceTitle(e.target.value)} disabled={!canEdit} required minLength={2} maxLength={300} placeholder="Judul artikel, dataset, laporan…" /></label>
            <label>URL (opsional)<input type="url" value={sourceUrl} onChange={e => setSourceUrl(e.target.value)} disabled={!canEdit} placeholder="https://…" /></label>
            <div className="research-form-row">
              <label>Jenis sumber<select value={sourceType} onChange={e => setSourceType(e.target.value)} disabled={!canEdit}><option value="url">URL</option><option value="article">Artikel</option><option value="report">Laporan</option><option value="dataset">Dataset</option><option value="manual">Catatan manual</option><option value="other">Lainnya</option></select></label>
              <label>Status lisensi<select value={licenseStatus} onChange={e => setLicenseStatus(e.target.value)} disabled={!canEdit}>{licenseOptions.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            <label>Kutipan/catatan isi<textarea value={sourceExcerpt} onChange={e => setSourceExcerpt(e.target.value)} disabled={!canEdit} rows={4} maxLength={20000} placeholder="Ringkasan faktual atau kutipan singkat dengan konteks…" /></label>
            <label>Catatan hak penggunaan<textarea value={rightsNotes} onChange={e => setRightsNotes(e.target.value)} disabled={!canEdit} rows={3} maxLength={4000} placeholder="Pemilik hak, atribusi, batas penggunaan, bukti izin…" /></label>
            <button type="submit" disabled={busy || !canEdit}>Simpan sumber</button>
          </form>
          <div className="research-list">
            <h3>Sumber terdaftar <span>{sources.length}</span></h3>
            {sources.map(source => <article className="research-source" key={source.id}><strong>{source.title}</strong><small>{source.source_domain ?? source.source_type} · {licenseOptions.find(([value]) => value === source.license_status)?.[1] ?? source.license_status}</small>{source.url && <a href={source.url} target="_blank" rel="noreferrer">Buka sumber ↗</a>}{source.rights_notes && <p>{source.rights_notes}</p>}</article>)}
            {sources.length === 0 && <p className="empty-state">Belum ada sumber. Catat URL atau sumber manual terlebih dahulu.</p>}
          </div>
        </div>
        <div className="studio-panel">
          <p className="eyebrow">RESEARCH REPORT</p><h2>Susun laporan riset</h2>
          <form onSubmit={addReport} className="research-form">
            <label>Topik<input value={topic} onChange={e => setTopic(e.target.value)} disabled={!canEdit} required minLength={2} maxLength={300} placeholder="Topik riset" /></label>
            <label>Audiens sasaran<input value={audience} onChange={e => setAudience(e.target.value)} disabled={!canEdit} maxLength={300} placeholder="Contoh: pemilik UMKM Indonesia" /></label>
            <label>Ringkasan<textarea value={summary} onChange={e => setSummary(e.target.value)} disabled={!canEdit} rows={4} maxLength={20000} placeholder="Ringkasan riset…" /></label>
            <label>Temuan utama <span className="field-hint">Satu temuan per baris</span><textarea value={findings} onChange={e => setFindings(e.target.value)} disabled={!canEdit} rows={5} maxLength={20000} placeholder="Temuan 1&#10;Temuan 2" /></label>
            <label>Rekomendasi <span className="field-hint">Satu rekomendasi per baris</span><textarea value={recommendations} onChange={e => setRecommendations(e.target.value)} disabled={!canEdit} rows={4} maxLength={20000} placeholder="Rekomendasi 1&#10;Rekomendasi 2" /></label>
            <label>Batasan/hal yang belum terverifikasi<textarea value={limitations} onChange={e => setLimitations(e.target.value)} disabled={!canEdit} rows={3} maxLength={5000} placeholder="Celah data, asumsi, tanggal kedaluwarsa, bias…" /></label>
            <div className="source-picker"><strong>Hubungkan sumber pendukung</strong>{sources.map(source => <label key={source.id} className="source-check"><input type="checkbox" checked={selectedSourceIds.includes(source.id)} onChange={e => toggleSource(source.id, e.target.checked)} disabled={!canEdit} /><span>{source.title}</span></label>)}{sources.length === 0 && <p className="empty-state">Daftarkan sumber terlebih dahulu agar dapat ditautkan ke laporan.</p>}</div>
            <button type="submit" disabled={busy || !canEdit}>Simpan laporan</button>
          </form>
          <div className="research-list">
            <h3>Laporan tersimpan <span>{reports.length}</span></h3>
            {reports.map(report => <article className="research-report" key={report.id}><strong>{report.topic}</strong><small>{report.status} · {report.language}</small>{report.report.summary && <p>{report.report.summary}</p>}<small>{report.report.sourceIds?.length ?? 0} sumber ditautkan</small></article>)}
            {reports.length === 0 && <p className="empty-state">Belum ada laporan riset.</p>}
          </div>
        </div>
      </section>
      <footer><span>AI CONTENT PRODUCTION STUDIO</span><span>Riset manual terstruktur · Lisensi dicatat · Tidak ada klaim bebas pakai otomatis.</span></footer>
    </main>
  );
}
