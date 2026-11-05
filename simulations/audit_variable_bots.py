"""Summarize real-engine behavior trials without manufacturing influence."""
import json,statistics,collections,sys
from pathlib import Path
p=Path('reports/cozy');refined='--refined' in sys.argv;stem='variable-bots-refined' if refined else 'variable-bots';x=json.loads((p/(stem+'.json')).read_text())
keys=['balanced','infrastructure','government','military','council','conquests'];out=[]
for mode in ['classic','express']:
 for profile in ['diario','casual']:
  group=[r for r in x['results'] if r['mode']==mode and r['profile']==profile]
  baseline={r['seed']:r for r in group if r['focus']=='balanced'}
  for focus in keys:
   rows=[r for r in group if r['focus']==focus];assert len(rows)==3
   for r in rows:
    assert [h['day'] for h in r['history']]==[h['day'] for h in baseline[r['seed']]['history']], 'Unmatched visit calendars'
    assert r['score']==r['influence']['total']
    assert sum(v for k,v in r['influence'].items() if k!='total')==r['score']
    assert all(0<=v<=500 for k,v in r['influence'].items() if k!='total')
    assert all(v>=0 for a in r['ledger'] for v in a['resourcesAfter'].values())
   area={'council':'society','conquests':'legacy'}.get(focus,focus)
   out.append({'mode':mode,'profile':profile,'focus':focus,'mean':round(statistics.mean(r['score'] for r in rows),1),'min':min(r['score'] for r in rows),'max':max(r['score'] for r in rows),'seals':sum(r['seal'] for r in rows),'paired_total_delta':round(statistics.mean(r['score']-baseline[r['seed']]['score'] for r in rows),1),'paired_focus_delta':None if focus=='balanced' else round(statistics.mean(r['influence'][area]-baseline[r['seed']]['influence'][area] for r in rows),1)})
assert len(x['results'])==72
summary={'scope':'72 real-engine trajectories, only 3 paired worlds per cell; descriptive, no population win-rate claim','rows':out}
(p/(stem+'-audit.json')).write_text(json.dumps(summary,indent=2))
lines=['# Bots variáveis — resultados observados','',summary['scope'],'','Os focos compartilham menus, recursos iniciais, sementes de visitas e limites de ações. Variação muda comparecimento, número de decisões e prioridade, não concede pontos aleatórios. O expresso testado usa 2× como candidato local.','', '| Modo | Rotina | Foco | Média | Mín–máx | Selos | Δ total vs equilibrado | Δ área focada |','|---|---|---|---:|---|---|---:|---:|']
for r in out:lines.append(f"| {r['mode']} | {r['profile']} | {r['focus']} | {r['mean']} | {r['min']}–{r['max']} | {r['seals']}/3 | {r['paired_total_delta']} | {r['paired_focus_delta']} |")
lines+=['','Limites: só três mundos por célula; atores sempre solo, torre opcional; sem PvP, população real ou perfis de má decisão. Aleatoriedade é comportamento dos bots; não demonstra sorte de cartas no jogo. O simulador ainda tenta alternativas rejeitadas sem consumir uma ação efetivada; sessões não medem tempo humano. Não inferir 65% de vencedores nem ausência de estratégia dominante. Nenhuma fórmula foi ajustada automaticamente para fazer os resultados convergirem.','', 'Dados: reports/cozy/variable-bots.json; auditoria: reports/cozy/variable-bots-audit.json.']
Path('docs/BALANCEAMENTO_VARIAVEL_RESULTADOS'+('_REFINADO' if refined else '')+'.md').write_text('\n'.join(lines),encoding='utf-8')
print(json.dumps(summary,ensure_ascii=False,indent=2))
