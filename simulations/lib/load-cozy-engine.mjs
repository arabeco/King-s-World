import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
const cache = new Map();
export function loadCozyEngine(moduleName = "engine") {
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const module = { exports: {} };
    cache.set(filename, module);
    const source = fs.readFileSync(filename, "utf8");
    const code = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    new Function("require", "module", "exports", code)(
      (name) => load(path.resolve(path.dirname(filename), name + ".ts")),
      module,
      module.exports,
    );
    return module.exports;
  }
  return load(
    fileURLToPath(new URL(`../../lib/cozy/${moduleName}.ts`, import.meta.url)),
  );
}
