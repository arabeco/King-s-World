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
    let source = fs.readFileSync(filename, "utf8");
    // Explicit offline experiment. Production code and persisted world rules are unchanged.
    const factor = process.env.COZY_SIM_PRODUCTION_FACTOR;
    if (factor !== undefined && filename.endsWith(path.join("cozy", "engine.ts"))) {
      if (![1, 2, 4].includes(Number(factor))) throw new Error("Unsupported simulation production factor");
      const expression = "(state.progression?.balance?.expressEconomy?4:1)";
      if (!source.includes(expression)) throw new Error("Production experiment no longer matches the engine");
      source = source.replace(expression, `(state.progression?.balance?.expressEconomy?${Number(factor)}:1)`);
    }
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
