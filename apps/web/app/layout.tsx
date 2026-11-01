import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'AI Content Production Studio', description: 'Plan, write, produce, caption, and publish content in one workspace.' };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="id"><body>{children}</body></html>; }
