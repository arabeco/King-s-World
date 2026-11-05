"""Audit artifacts from real engine runs; never manufactures scores."""
import json,collections
from pathlib import Path
p=Path('reports/cozy');x=json.loads((p/'integrated-bots.json').read_text())
assert len(x['results'])==24
summary=[]
for mode in ['classic','express']:
 for coop in [False,True]:
  rows=[r for r in x['results'] if r['mode']==mode and r['coop']==coop]
  for r in rows:
   score=r['influence'];assert score['total']==sum(v for k,v in score.items() if k!='total')
   assert all(0<=v<=500 for k,v in score.items() if k!='total')
   assert r['score']==score['total']
   for a in r['ledger']:
    assert all(v>=0 for v in a['resourcesAfter'].values())
  summary.append(dict(mode=mode,coop=coop,n=len(rows),minimum=min(r['score'] for r in rows),maximum=max(r['score'] for r in rows),seals=sum(r['seal'] for r in rows)))
coverage={}
for key in ['projects','pacts','support']:
 rows=[r for w in x['worlds'] for r in w.get(key,[]) or []]
 coverage[key]={'created':len(rows),'completed':sum(r.get('completedAt') is not None for r in rows),'resolved':sum(r.get('resolvedAt') is not None for r in rows)}
assert coverage['projects']['completed']>0 and coverage['pacts']['completed']>0 and coverage['support']['resolved']>0
out={'scope':'artifact consistency and coverage; not a win-rate or balance proof','summary':summary,'coverage':coverage}
(p/'integrated-audit.json').write_text(json.dumps(out,indent=2))
print(json.dumps(out,indent=2))
