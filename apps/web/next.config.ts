import type { NextConfig } from 'next';
const basePath = process.env.GITHUB_PAGES === 'true' ? '/AI-Content-Production-Studio' : '';
const config: NextConfig = { output: 'export', trailingSlash: true, images: { unoptimized: true }, basePath, assetPrefix: basePath || undefined };
export default config;
