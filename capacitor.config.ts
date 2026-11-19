import type { CapacitorConfig } from "@capacitor/cli";

const appId = process.env.CAPACITOR_APP_ID ?? "com.kingsworld.app";
const appName = process.env.CAPACITOR_APP_NAME ?? "KingsWorld";
// Debug only: load the screens from a running site instead of the bundled app.
const remoteUrl = process.env.KW_REMOTE_SHELL_URL?.trim();

const config: CapacitorConfig = {
  appId,
  appName,
  // The game screens and art ship inside the app (npm run app:build).
  // They talk to the game server (KW_APP_API_URL) only to validate and save.
  webDir: "native-app/dist",
  android: {
    path: "android",
  },
  server: remoteUrl
    ? { url: remoteUrl, cleartext: remoteUrl.startsWith("http://") }
    : { androidScheme: "https", hostname: "localhost" },
};

export default config;
