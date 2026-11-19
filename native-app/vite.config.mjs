import { fileURLToPath } from "node:url";
import autoprefixer from "autoprefixer";
import tailwindcss from "tailwindcss";
import { defineConfig, loadEnv } from "vite";

import { nativeAssetPack } from "./package-assets.mjs";

const local = (path) => fileURLToPath(new URL(path, import.meta.url));
const projectRoot = local("../");

// Only public values reach the app bundle. Server secrets never do.
const PUBLIC_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_NATIVE_AUTH_DEBUG",
  "NEXT_PUBLIC_KW_SHOW_PVP",
  "KW_APP_API_URL",
  "KW_APP_DEV_AUTH",
];

export default defineConfig(({ mode }) => {
  const loaded = loadEnv(mode, projectRoot, ["NEXT_PUBLIC_", "KW_APP_"]);
  const env = { NODE_ENV: mode === "development" ? "development" : "production", NEXT_PUBLIC_KW_NATIVE_SHELL: "1" };
  for (const name of PUBLIC_ENV) {
    const value = process.env[name] ?? loaded[name];
    if (value !== undefined && value !== "") env[name] = value;
  }
  env.KW_APP_API_URL ??= "https://king-s-world-three.vercel.app";
  if (mode !== "development") delete env.KW_APP_DEV_AUTH;

  return {
    root: local("./"),
    publicDir: mode === "development" ? local("../public") : false,
    envDir: false,
    plugins: [nativeAssetPack(local("../public"))],
    esbuild: { jsx: "automatic" },
    define: { "process.env": JSON.stringify(env) },
    css: { postcss: { plugins: [tailwindcss({ config: local("../tailwind.config.js") }), autoprefixer()] } },
    resolve: {
      alias: [
        { find: /^next\/image$/, replacement: local("./shims/next-image.tsx") },
        { find: /^next\/link$/, replacement: local("./shims/next-link.tsx") },
        { find: /^next\/navigation$/, replacement: local("./shims/next-navigation.ts") },
        { find: /^@\/lib\/supabase-browser$/, replacement: local("./shims/supabase-browser.ts") },
        { find: /^@\//, replacement: projectRoot },
      ],
    },
    server: { port: 5174, host: "127.0.0.1" },
    build: {
      outDir: local("./dist"), emptyOutDir: true, target: "es2020", chunkSizeWarningLimit: 2500, sourcemap: false,
      rollupOptions: {
        onwarn(warning, warn) {
          // Next's "use client" markers are meaningless in the app bundle.
          if (warning.code === "MODULE_LEVEL_DIRECTIVE" || warning.code === "SOURCEMAP_ERROR") return;
          warn(warning);
        },
      },
    },
  };
});
