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
    // Offline experiments change only the initial balance of newly created worlds.
    if(filename.endsWith(path.join('cozy','progression.ts'))){
      for(const [env,key,base,allowed] of [
        ['COZY_SIM_PRODUCTION_FACTOR','materialsProductionMultiplier',4,[1,2,3,4]],
        ['COZY_SIM_SUPPLIES_FACTOR','suppliesProductionMultiplier',1,[1,2,3,4]],
        ['COZY_SIM_MILITARY_DIVISOR','militaryDivisor',75,[45,60,75,90]],
      ]){
        const value=process.env[env];if(value===undefined)continue;
        if(!allowed.includes(Number(value)))throw new Error('Unsupported experiment: '+env);
        const expression=key+':'+base;
        if(!source.includes(expression))throw new Error('Experiment no longer matches progression: '+key);
        source=source.replace(expression,key+':'+Number(value));
      }
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
