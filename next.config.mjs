import {releaseFingerprint} from './scripts/release-fingerprint.mjs';
/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {KW_CODE_REVISION:releaseFingerprint()},
  reactStrictMode: true,
  // Next's response adapter also normalizes loopback redirects after middleware.
  // Optimized local WebView QA needs the same protection as dev; deployed builds
  // keep Next defaults unless this explicit local-only flag is supplied.
  skipMiddlewareUrlNormalize: process.env.NODE_ENV !== 'production' || process.env.KW_LOCAL_WEBVIEW_QA === '1',
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
