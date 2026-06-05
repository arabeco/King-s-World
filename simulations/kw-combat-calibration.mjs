// =============================================================
// KingsWorld — Simulador do COMBATE NOVO (porta a fórmula do kw_resolve_attack)
// Rodar: node simulations/kw-combat-calibration.mjs
// Mede: (1) justiça/anti-wipe, (2) custo de conquistar por tamanho -> custo de
// fundar (~30%), (3) mini-mundo (NPCs + abandonadas) p/ ver conquistas/eliminação.
// Constantes espelham os SQLs 41/42/48 (teto 50% 2 lados, garrison 2, saque 25%).
// =============================================================
const C_ATT_LOSS_CAP = 0.5;
const C_DEF_LOSS_CAP = 0.5;
const C_GARRISON = 2;
const LOOT = 0.25;

const classMult = (c) => (c === "bastiao" ? 1.6 : c === "posto_avancado" ? 1.2 : 1.0);
const abandonedDef = (size, c) => (60 + size * 150) * classMult(c);

// espelha kw_resolve_attack (militia-only p/ clareza; coef milícia=1)
function resolveAttack({ attMilitia, attSkill = 1, defMilitia = 0, citySize = 0, cityClass = "neutral", abandoned = false, defSkill = 1 }) {
  const attPower = attMilitia * attSkill;
  if (attPower <= 0) return { code: "no_army" };
  const defPower = abandoned
    ? abandonedDef(citySize, cityClass)
    : (defMilitia * classMult(cityClass) * defSkill) + 30;
  const winner = attPower >= defPower ? "attacker" : "defender";
  const attLoss = Math.min(C_ATT_LOSS_CAP, (defPower / attPower) * 0.5);
  const defLoss = Math.min(C_DEF_LOSS_CAP, (attPower / Math.max(defPower, 1)) * 0.5);
  const attSurv = attMilitia * (1 - attLoss);
  const defRemain = Math.floor(defMilitia * (1 - defLoss));
  const occupied = winner === "attacker" && attSurv >= Math.max(1, citySize * C_GARRISON);
  return { code: occupied ? (abandoned ? "claimed" : "conquered") : winner, winner, attLoss, defLoss, attSurv, defRemain, attPower, defPower };
}

const pct = (x) => `${(x * 100).toFixed(0)}%`;
const line = (s = "") => console.log(s);

// ---------- (1) JUSTIÇA / ANTI-WIPE ----------
line("══════ (1) JUSTIÇA: ninguém é zerado num golpe? quantos golpes p/ cercar? ══════");
for (const ratio of [1.2, 2, 4]) {
  const def0 = 1000;
  const att = Math.round(def0 * ratio);
  let def = def0, hits = 0;
  const first = resolveAttack({ attMilitia: att, defMilitia: def });
  while (def > 0 && hits < 50) { const r = resolveAttack({ attMilitia: att, defMilitia: def }); def = r.defRemain; hits++; }
  line(`atacante ${ratio}× (${att} vs ${def0}): 1º golpe tira ${pct(first.defLoss)} do defensor (resta ${first.defRemain}); ` +
       `cercar até zerar = ${hits} ataques. atacante perde ${pct(first.attLoss)}/golpe.`);
}
line("→ teto 50% garante que nenhum golpe elimina; derrubar exige pressão repetida (cerco). ✔");
line();

// ---------- (2) CUSTO DE CONQUISTAR -> CUSTO DE FUNDAR (~30%) ----------
line("══════ (2) Custo de conquistar por tamanho → recomendação de FUNDAR (~30%) ══════");
const tiers = [{ s: 5, c: "neutral", nome: "pequena" }, { s: 18, c: "posto_avancado", nome: "média" }, { s: 38, c: "bastiao", nome: "fortaleza" }];
for (const t of tiers) {
  // menor exército de milícia que VENCE e ocupa (sobrevive >= 2*tamanho)
  let need = 1;
  while (need < 1e7) {
    const r = resolveAttack({ attMilitia: need, citySize: t.s, cityClass: t.c, abandoned: true });
    if (r.code === "claimed") break;
    need = Math.ceil(need * 1.02) + 1;
  }
  const r = resolveAttack({ attMilitia: need, citySize: t.s, cityClass: t.c, abandoned: true });
  const lost = Math.round(need * r.attLoss);
  const foundCost = Math.round(need * 0.30);
  line(`${t.nome} (tam ${t.s}, def ${Math.round(abandonedDef(t.s, t.c))}): precisa ~${need} milícia, perde ~${lost} no ataque. ` +
       `→ FUNDAR equivalente deve custar ~${foundCost} de esforço (30%), começando do 0.`);
}
line("→ conquistar = caro mas pronto; fundar = ~30% da entrada, mas vazio (paga o resto em obra). ✔");
line();

// ---------- (3) MINI-MUNDO: NPCs + abandonadas ----------
line("══════ (3) Mini-mundo: 26 NPCs + 25 abandonadas, 300 ticks ══════");
let rng = 12345; const rnd = () => (rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const npcs = Array.from({ length: 26 }, (_, i) => ({ id: i, militia: 200 + Math.floor(rnd() * 6000), skill: 0.7 + rnd() * 0.7, aggr: 0.05 + rnd() * 0.30, alive: true, cities: 1 }));
const aband = Array.from({ length: 25 }, (_, i) => ({ id: i, size: 3, cls: i < 15 ? "neutral" : i < 22 ? "posto_avancado" : "bastiao", cap: i < 15 ? 8 : i < 22 ? 18 : 40, owner: null }));
let conquests = 0, claims = 0, elim = 0, raids = 0;
for (let tick = 0; tick < 300; tick++) {
  // crescer abandonadas devagar
  for (const a of aband) if (a.owner === null && a.size < a.cap && rnd() < 0.15) a.size++;
  // crescer NPCs
  for (const n of npcs) if (n.alive) n.militia += Math.round((10 + rnd() * 40) * n.skill);
  // decidir ataques
  for (const n of npcs) {
    if (!n.alive || n.militia < 80 || rnd() >= n.aggr) continue;
    const power = n.militia * 0.95;
    let target = null;
    if (rnd() < 0.10) { // expansão
      const viable = aband.filter((a) => a.owner === null && abandonedDef(a.size, a.cls) <= power * 0.85).sort((x, y) => abandonedDef(y.size, y.cls) - abandonedDef(x.size, x.cls));
      if (viable[0]) target = { kind: "ab", ref: viable[0] };
    }
    if (!target) { const weak = npcs.filter((m) => m.alive && m.id !== n.id).sort((a, b) => a.militia - b.militia)[0]; if (weak) target = { kind: "npc", ref: weak }; }
    if (!target) continue;
    const send = Math.floor(n.militia * (target.kind === "ab" ? 0.95 : 0.6));
    if (target.kind === "ab") {
      const r = resolveAttack({ attMilitia: send, attSkill: n.skill, citySize: target.ref.size, cityClass: target.ref.cls, abandoned: true });
      n.militia -= Math.round(send * r.attLoss);
      if (r.code === "claimed") { claims++; target.ref.owner = n.id; n.cities++; }
    } else {
      const d = target.ref;
      const r = resolveAttack({ attMilitia: send, attSkill: n.skill, defMilitia: d.militia, defSkill: d.skill });
      n.militia -= Math.round(send * r.attLoss); d.militia = r.defRemain; raids++;
      // conquista vs NPC: precisa herói (simplifica: 50% têm) + sobreviventes>=2*tamanho(=cidade ~10)
      if (r.winner === "attacker" && rnd() < 0.5 && send * (1 - r.attLoss) >= 10 * C_GARRISON && d.cities <= 1) {
        if (d.militia < 50) { conquests++; d.alive = false; elim++; n.cities++; }
      }
    }
  }
}
const alive = npcs.filter((n) => n.alive).length;
line(`claims (abandonadas ocupadas): ${claims}/25   conquistas NPC-vs-NPC: ${conquests}   eliminações: ${elim}`);
line(`raides: ${raids}   NPCs vivos no fim: ${alive}/26   (se 0 vivos -> guerra total demais; se 26 -> passivo demais)`);
line(`abandonadas restantes neutras: ${aband.filter((a) => a.owner === null).length}/25`);
line();
line("Leitura: claims subindo devagar + maioria dos NPCs viva = mundo vivo SEM all-in. Ajustar garrison/teto/agressão e re-rodar.");
