import type { CapacitorConfig } from "@capacitor/cli";

const appId = process.env.CAPACITOR_APP_ID ?? "com.kingsworld.app";
const appName = process.env.CAPACITOR_APP_NAME ?? "KingsWorld";
const serverUrl =
  process.env.CAPACITOR_SERVER_URL?.trim() ?? "https://king-s-world-three.vercel.app";

const config: CapacitorConfig = {
  appId,
  appName,
  // The game runs on server.url; package only the connection recovery page.
  webDir: "native-shell",
  android: {
    path: "android",
  },
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: serverUrl.startsWith("http://"),
        errorPath: `index.html?retry=${encodeURIComponent(serverUrl)}`,
      }
    : undefined,
};

export default config;
