import {copyFile, mkdir, readdir, readFile, writeFile} from "node:fs/promises";
import {dirname, extname, join} from "node:path";
import sharp from "sharp";

// These files are art references and contact sheets, outside the local game UI.
const draftFolders = new Set([
  "previews", "collection/samples-v1", "collection/equipment-sheet-v1",
  "collection/catalog-v1/sheets", "collection/sovereigns-v2/alternatives",
]);
const legacyWorldArt = new Set([
  "first.png", "lobby.png", "lobby23.png", "main-map.png", "main-map0.png", "terrain-clean-v1.png",
]);
const rasterExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const staticExtensions = new Set([...rasterExtensions, ".svg", ".gif", ".woff2"]);

async function gameFiles(source, prefix = "") {
  const results = [];
  for (const entry of await readdir(join(source, prefix), {withFileTypes: true})) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (!draftFolders.has(path)) results.push(...await gameFiles(source, path));
    } else if (entry.isFile() && staticExtensions.has(extname(path).toLowerCase())) {
      if (prefix === "world" && legacyWorldArt.has(entry.name)) continue;
      if (prefix === "collection/sovereigns-v2" && entry.name.endsWith("-sheet.png")) continue;
      results.push(path);
    }
  }
  return results;
}

// Limits follow the actual use of the artwork, with larger budgets for zoom and full scenes.
function pixels(path) {
  if (path.startsWith("icons/")) return 192;
  if (path.startsWith("buildings/") || path.startsWith("rewards/")) return 256;
  if (path.startsWith("landmarks/")) return 720;
  if (path.startsWith("cities/")) return path.includes("-icon.") ? 256 : 640;
  if (path.startsWith("collection/")) {
    if (/-body(?:-\d+)?\./.test(path)) return 720;
    return path.includes("crest") ? 320 : 288;
  }
  if (path.startsWith("world/")) return path.includes("royal-valley") ? 1280 : 1120;
  return 1000;
}

async function optimize(path, original) {
  const limit = pixels(path);
  const image = sharp(original).resize({width: limit, height: limit, fit: "inside", withoutEnlargement: true});
  switch (extname(path).toLowerCase()) {
    case ".png":
      // Keep alpha transparency and the original URL/format for SVG sprites and CSS.
      return image.png({palette: true, quality: 85, dither: .75, effort: 7}).toBuffer();
    case ".webp":
      return image.webp({quality: 86, alphaQuality: 94, effort: 5}).toBuffer();
    default:
      return image.jpeg({quality: 82, mozjpeg: true}).toBuffer();
  }
}

export function nativeAssetPack(source) {
  return {
    name: "kingsworld-app-assets",
    apply: "build",
    async writeBundle({dir}) {
      const files = await gameFiles(source);
      let originalBytes = 0;
      let packagedBytes = 0;
      // Bound concurrent decodes so the artwork build doesn't load the whole catalog into memory.
      for (let i = 0; i < files.length; i += 4) {
        await Promise.all(files.slice(i, i + 4).map(async path => {
          const from = join(source, path);
          const to = join(dir, path);
          await mkdir(dirname(to), {recursive: true});
          if (!rasterExtensions.has(extname(path).toLowerCase())) {
            await copyFile(from, to);
            return;
          }
          const original = await readFile(from);
          const compressed = await optimize(path, original);
          const packaged = compressed.length < original.length ? compressed : original;
          await writeFile(to, packaged);
          originalBytes += original.length;
          packagedBytes += packaged.length;
        }));
      }
      const mib = bytes => `${(bytes / 2 ** 20).toFixed(1)} MiB`;
      this.info(`${files.length} assets de jogo · imagens ${mib(originalBytes)} → ${mib(packagedBytes)}`);
    },
  };
}
