import Link from 'next/link';

const modules = [
  ['Research Desk', 'Riset topik, sumber, audiens, dan kata kunci.'],
  ['Script Studio', 'Susun hook, outline, naskah, narasi, dan CTA.'],
  ['Media Workshop', 'Kelola footage, gambar, audio, dan aset proyek.'],
  ['Clip & Caption', 'Pilih segmen, buat subtitle, dan siapkan format vertikal.'],
  ['SEO & Publishing', 'Optimalkan metadata dan kelola rencana publikasi.'],
  ['Usage & Cost', 'Pantau pemakaian, kuota, dan estimasi biaya provider.'],
];

export default function Home() {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="mark">✦</span><span>CONTENT STUDIO</span></div>
        <span className="status">DEVELOPMENT · EARLY ACCESS</span>
      </header>
      <section className="hero">
        <p className="eyebrow">YOUR CREATIVE OPERATING SYSTEM</p>
        <h1>From idea to<br/><em>published story.</em></h1>
        <p className="intro">Satu ruang kerja untuk riset, penulisan, produksi media, subtitle, optimasi, dan distribusi konten. AI bersifat opsional — alur kerja inti tetap dapat digunakan tanpa API berbayar.</p>
        <div className="actions">
          <Link href="/auth/" className="primary">Masuk / Buat akun <span>↗</span></Link>
          <Link href="/studio/" className="secondary">Buka workspace <span>↗</span></Link>
          <span className="subtle">Provider-agnostic · Export-first · Cost-aware</span>
        </div>
      </section>
      <section id="modules" className="module-section">
        <div className="section-head">
          <div><p className="eyebrow">WORKSPACE MODULES</p><h2>Production, in one flow.</h2></div>
          <span className="count">06 MODULES</span>
        </div>
        <div className="grid">
          {modules.map(([title, description], i) => (
            <article className="module" key={title}>
              <span className="number">0{i + 1}</span><h3>{title}</h3><p>{description}</p><span className="arrow">↗</span>
            </article>
          ))}
        </div>
      </section>
      <footer><span>AI CONTENT PRODUCTION STUDIO</span><span>Built for creators. Designed around control.</span></footer>
    </main>
  );
}
