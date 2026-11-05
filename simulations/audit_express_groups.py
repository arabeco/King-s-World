import json,statistics,collections,sys
from pathlib import Path
p=Path('reports/cozy');quality='--quality' in sys.argv;queue12='--queue12' in sys.argv or quality;holdout='--holdout' in sys.argv;stem='economic-groups-holdout' if holdout else 'economic-groups-final';stem=('economic-groups-queue12-holdout' if holdout else 'economic-groups-queue12-final') if queue12 else stem;stem=('economic-groups-quality-holdout' if holdout else 'economic-groups-quality-final') if quality else stem;x=json.loads((p/(stem+'.json')).read_text());rows=x['results'];worlds=x['worlds'];n=2 if holdout else 3;assert len(rows)==78*n and len(worlds)==26*n;assert {r['seed'] for r in rows}==(({88,99} if quality else {66,77} if queue12 else {44,55}) if holdout else {11,22,33})
index={(r['seed'],r['scenario'],r['groupFocus'],r['playerId']):r for r in rows}
scenarios=['independent','tower','alliance','alliance_tower'];focuses=['balanced','infrastructure','government','military','council','conquests']
summary=[];dominance=[]
for scenario in scenarios:
 for focus in focuses:
  a=[r for r in rows if r['scenario']==scenario and r['focus']==focus];assert len(a)==3*n
  for r in a:
   if queue12:assert r['balance']['plannedCapacity']==12
   if quality:assert r['balance']['infrastructureRanked']
   b=index[(r['seed'],scenario,'balanced',r['playerId'])];assert [h['day'] for h in r['history']]==[h['day'] for h in b['history']]
   assert r['score']==r['influence']['total']==sum(v for k,v in r['influence'].items() if k!='total')
   assert all(0<=v<=500 for k,v in r['influence'].items() if k!='total')
   assert all(v>=0 for action in r['ledger'] for v in action['resourcesAfter'].values())
  delta=[r['score']-index[(r['seed'],scenario,'balanced',r['playerId'])]['score'] for r in a]
  summary.append({'scenario':scenario,'focus':focus,'worlds':n,'players':3*n,'mean':round(statistics.mean(r['score'] for r in a),1),'min':min(r['score'] for r in a),'max':max(r['score'] for r in a),'seals':sum(r['seal'] for r in a),'paired_delta':round(statistics.mean(delta),1)})
for focus in focuses[1:]:
 deltas=[r['score']-index[(r['seed'],r['scenario'],'balanced',r['playerId'])]['score'] for r in rows if r['scenario'] in scenarios and r['focus']==focus]
 dominance.append({'focus':focus,'paired_n':len(deltas),'above':sum(d>0 for d in deltas),'equal':sum(d==0 for d in deltas),'below':sum(d<0 for d in deltas),'dominates_balanced_every_pair':all(d>=0 for d in deltas) and any(d>0 for d in deltas)})
coverage={'projects_completed':0,'pacts_activated':0,'accepted_support_resolved':0,'tower_pledges':0,'tower_outcomes':collections.Counter()}
for w in worlds:
 s=w['shared'];features=w['scenario'];assert all(len(a['members'])<=5 for a in s['alliances'])
 if features in ['independent','tower','mixed_independent']:assert not s['alliances'];assert not s.get('allianceProjects');assert not s['support']
 if features in ['independent','alliance']:assert not s.get('sanctuaryPacts')
 for a in s.get('areas',{}).values():assert 0<=a['reserve']['remaining']<=a['reserve']['capacity']
 for container in ['allianceProjects','sanctuaryPacts']:
  for project in s.get(container,[]) or []:
   cost={'materials':600,'supplies':400,'gold':0} if project['kind']=='defense' else {'materials':500,'gold':100,'supplies':0}
   totals={k:sum(v.get(k,0) for v in project['contributions'].values()) for k in cost}
   assert all(0<=totals[k]<=cost[k] for k in cost)
   if project['completedAt'] is not None:
    assert totals==cost;coverage['projects_completed' if container=='allianceProjects' else 'pacts_activated']+=1
   for wave in project.get('raids',{}).get('waves',[]):
    defenders=wave['defenders'];assert len({d['playerId'] for d in defenders})==len(defenders)
    assert all(d['at']<wave['arrivesAt'] for d in defenders);coverage['tower_pledges']+=len(defenders)
    if wave.get('outcome'):coverage['tower_outcomes'][wave['outcome']]+=1
 for support in s['support']:
  if support['acceptedAt'] is not None:
   assert support['acceptedAt']<support['arrivesAt'];assert support.get('resolvedAt') is not None;coverage['accepted_support_resolved']+=1
assert coverage['projects_completed'] and coverage['pacts_activated'] and coverage['accepted_support_resolved'] and coverage['tower_pledges']
report={'scope':f'Descriptive real-engine tests. {26*n} correlated/paired worlds, {78*n} player trajectories, {n} seeds; not population estimates or proof of no dominant strategy.','summary':summary,'dominance':dominance,'coverage':coverage}
(p/(('economic-groups-quality-validation-audit.json' if holdout else 'economic-groups-quality-audit.json') if quality else ('economic-groups-queue12-validation-audit.json' if holdout else 'economic-groups-queue12-audit.json') if queue12 else ('economic-groups-holdout-audit.json' if holdout else 'economic-groups-audit.json'))).write_text(json.dumps(report,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
