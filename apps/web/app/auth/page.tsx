'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '../../lib/auth-client';

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!authClient) {
      setError('Konfigurasi Neon Auth belum tersedia. Atur NEXT_PUBLIC_AUTH_BASE_URL pada environment build.');
      return;
    }
    setBusy(true);
    try {
      const result = mode === 'signup'
        ? await authClient.signUp.email({ name: name.trim(), email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message || 'Autentikasi gagal.');
      if (mode === 'signup') {
        const session = await authClient.getSession();
        if (session.data?.user) {
          router.push('/studio/');
          return;
        }
        setMode('signin');
        setNotice('Akun berhasil dibuat. Silakan masuk dengan email dan kata sandi Anda.');
      } else {
        router.push('/studio/');
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan autentikasi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <Link href="/" className="auth-back">← Kembali ke beranda</Link>
      <section className="auth-card">
        <div className="brand"><span className="mark">✦</span><span>CONTENT STUDIO</span></div>
        <p className="eyebrow">YOUR CREATIVE WORKSPACE</p>
        <h1>{mode === 'signin' ? 'Selamat datang kembali.' : 'Mulai berkarya.'}</h1>
        <p className="auth-copy">Masuk ke ruang produksi konten Anda atau buat akun baru untuk memulai.</p>
        <div className="auth-tabs">
          <button type="button" className={mode === 'signin' ? 'active' : ''} onClick={() => { setMode('signin'); setError(''); setNotice(''); }}>Masuk</button>
          <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setError(''); setNotice(''); }}>Daftar</button>
        </div>
        <form onSubmit={submit}>
          {mode === 'signup' && <label>Nama<input autoComplete="name" value={name} onChange={e => setName(e.target.value)} required minLength={2} maxLength={100} /></label>}
          <label>Email<input type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required /></label>
          <label>Kata sandi<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={e => setPassword(e.target.value)} required minLength={8} /></label>
          {error && <p className="auth-error" role="alert">{error}</p>}
          {notice && <p className="auth-notice" role="status">{notice}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? 'Memproses…' : mode === 'signin' ? 'Masuk ke workspace' : 'Buat akun'}</button>
        </form>
        <p className="auth-footnote">Akun dan sesi dikelola oleh Neon Auth. Jangan gunakan kata sandi yang dipakai pada layanan lain.</p>
      </section>
    </main>
  );
}
