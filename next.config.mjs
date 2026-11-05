import {releaseFingerprint} from './scripts/release-fingerprint.mjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    KW_CODE_REVISION: releaseFingerprint(),
    KW_GIT_REVISION: process.env.VERCEL === '1' && /^[a-f0-9]{40}$/.test(process.env.VERCEL_GIT_COMMIT_SHA ?? '')
      ? process.env.VERCEL_GIT_COMMIT_SHA
      : '',
  },
  reactStrictMode: true,
  // Next's response adapter also normalizes loopback redirects after middleware.
  // Optimized local WebView QA needs the same protection as dev; deployed builds
  // keep Next defaults unless this explicit local-only flag is supplied.
  skipMiddlewareUrlNormalize: process.env.NODE_ENV !== 'production' || process.env.KW_LOCAL_WEBVIEW_QA === '1',
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
