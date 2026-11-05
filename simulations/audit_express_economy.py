import json,statistics
from pathlib import Path
p=Path('reports/cozy');on=json.loads((p/'economy-30-90-1.json').read_text());off=json.loads((p/'economy-30-90-0.json').read_text())
rows=[]
assert len(on['results'])==len(off['results'])==36
for profile in ['diario','casual']:
 for focus in ['balanced','infrastructure','government','military','council','conquests']:
  a=[r for r in on['results'] if r['profile']==profile and r['focus']==focus];b={r['seed']:r for r in off['results'] if r['profile']==profile and r['focus']==focus}
  assert len(a)==3
  for r in a:
   assert [h['day'] for h in r['history']]==[h['day'] for h in b[r['seed']]['history']]
   assert r['score']==r['influence']['total']==sum(v for k,v in r['influence'].items() if k!='total')
   assert all(0<=v<=500 for k,v in r['influence'].items() if k!='total')
   assert all(v>=0 for x in r['ledger'] for v in x['resourcesAfter'].values())
  rows.append({'profile':profile,'focus':focus,'min':min(r['score'] for r in a),'max':max(r['score'] for r in a),'mean':round(statistics.mean(r['score'] for r in a),1),'seals':sum(r['seal'] for r in a),'military':[r['influence']['military'] for r in a],'paired_queue_gain':round(statistics.mean(r['score']-b[r['seed']]['score'] for r in a),1)})
result={'scope':'Real engine; 36 with plans and 36 matched without plans, 3 worlds per cell; descriptive, not population win rate','rows':rows}
(p/'economy-30-audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
