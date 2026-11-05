"""Audit production-engine trajectories; these are correlated bots, not people."""
import argparse
import collections
import json
import statistics as st
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('label')
parser.add_argument('--holdout', action='store_true')
parser.add_argument('--specialists', action='store_true')
parser.add_argument('--controlled', action='store_true')
parser.add_argument('--closure', action='store_true')
parser.add_argument('--control-focus', action='store_true')
parser.add_argument('--focus-pair', action='store_true')
args = parser.parse_args()
folder = Path('reports/cozy')
stem = f'economic-groups-{args.label}-' + ('holdout' if args.holdout else 'final')
data = json.loads((folder / (stem + '.json')).read_text())
rows, worlds = data['results'], data['worlds']
seeds = data['seeds']
assert len(seeds) == len(set(seeds)) and set(seeds) == {r['seed'] for r in rows}
assert len(rows) == len(seeds) * (24 if args.focus_pair else 20 if args.control_focus else 30 if args.controlled else 20 if args.specialists else 78)
assert len(worlds) == len(seeds) * (8 if args.focus_pair else 4 if args.control_focus else 6 if args.controlled else 4 if args.specialists else 26)
areas = dict(infrastructure='infrastructure', government='government', military='military', council='society', conquests='legacy')
coverage = collections.Counter()
for row in rows:
    assert row['score'] == row['influence']['total'] == sum(row['influence'][k] for k in areas.values())
    assert all(0 <= row['influence'][k] <= 500 for k in areas.values())
    assert row['balance']['councilSourceCaps'] == (dict(decree=160, local=140, stable=200) if args.closure else dict(decree=260, local=160, stable=80))
    assert row['balance']['infrastructureWeights'] == [150,100,70,50,35,25,20,20,15,15]
    assert row['balance']['plannedCapacity'] == 12
    if args.closure:
        assert row['balance']['constructionGrowth'] == 1.36 and row['balance']['councilMeaningfulDecrees'] and row['balance'].get('councilContinuity')
        assert row['balance']['councilMerit'] == dict(decree=4,local=6,stable=8)
    sources = row['council'].get('sources', {})
    assert all(0 <= sources.get(k, 0) <= cap for k, cap in row['balance']['councilSourceCaps'].items())
    assert sum(sources.values()) == row['council']['merit']
    assert all(v >= 0 for action in row['ledger'] for v in action['resourcesAfter'].values())
    assert all(0 <= action['day'] <= 30 for action in row['ledger'])
for world in worlds:
    shared = world['shared']
    assert all(len(a['members']) <= 5 for a in shared['alliances'])
    if 'independent' in world['scenario'] or world['scenario'] == 'tower':
        assert not shared['alliances'] and not shared['support'] and not shared.get('allianceProjects')
    if world['scenario'] in ['independent', 'alliance']:
        assert not shared.get('sanctuaryPacts')
    for area in shared.get('areas', {}).values():
        assert 0 <= area['reserve']['remaining'] <= area['reserve']['capacity']
    for container in ['allianceProjects', 'sanctuaryPacts']:
        for project in shared.get(container, []) or []:
            cost = dict(materials=600, supplies=400, gold=0) if project['kind'] == 'defense' else dict(materials=500, supplies=0, gold=100)
            total = {k: sum(v.get(k, 0) for v in project['contributions'].values()) for k in cost}
            assert all(0 <= total[k] <= cost[k] for k in cost)
            if project['completedAt'] is not None:
                assert total == cost
                coverage[container + '_completed'] += 1
            for wave in project.get('raids', {}).get('waves', []):
                defenders = wave['defenders']
                assert len({d['playerId'] for d in defenders}) == len(defenders)
                assert all(d['at'] < wave['arrivesAt'] for d in defenders)
                coverage['tower_defenses'] += len(defenders)
                if wave.get('outcome'):
                    coverage['tower_' + wave['outcome']] += 1
    for support in shared['support']:
        if support['acceptedAt'] is not None:
            assert support['acceptedAt'] < support['arrivesAt'] and support.get('resolvedAt') is not None
            coverage['resolved_support'] += 1
assert coverage['allianceProjects_completed'] and coverage['sanctuaryPacts_completed'] and coverage['tower_defenses']

index = {(r['seed'], r['scenario'], r['groupFocus'], r['playerId']): r for r in rows}
summary, focus_comparison = [], []
for scenario, focus in sorted({(r['scenario'], r['groupFocus']) for r in rows}):
    selected = [r for r in rows if (r['scenario'], r['groupFocus']) == (scenario, focus)]
    summary.append(dict(scenario=scenario, focus=focus, n=len(selected), mean=round(st.mean(r['score'] for r in selected),1), minimum=min(r['score'] for r in selected), maximum=max(r['score'] for r in selected), seals=sum(r['seal'] for r in selected), areas={k:round(st.mean(r['influence'][k] for r in selected),1) for k in areas.values()}))
for focus, area in areas.items():
    selected = [r for r in rows if r['focus'] == focus and (not args.controlled or r['groupFocus']==focus)]
    if not selected:
        continue
    pairs = []
    for row in selected:
        scenario = row['scenario'].rsplit('_',1)[0]+'_balanced' if args.controlled else row['scenario'].replace('specialist', 'balanced') if args.specialists else row['scenario']
        base = index[row['seed'], scenario, 'balanced', row['playerId']]
        assert [h['day'] for h in row['history']] == [h['day'] for h in base['history']]
        pairs.append((row, base))
    deltas = [r['score'] - b['score'] for r,b in pairs]
    own = [r['influence'][area] - b['influence'][area] for r,b in pairs]
    focus_comparison.append(dict(focus=focus,n=len(pairs),mean_delta=round(st.mean(deltas),1),own_area_delta=round(st.mean(own),1),above=sum(d>0 for d in deltas),below=sum(d<0 for d in deltas),dominates_all=all(d>=0 for d in deltas) and any(d>0 for d in deltas),within_100_points=abs(st.mean(deltas))<=100,own_area_improves=st.mean(own)>0))
report = dict(status='PASS_INVARIANTS',scope='Paired, correlated bot trajectories; no human population estimate or proof against untested strategies.',seeds=seeds,trajectories=len(rows),worlds=len(worlds),summary=summary,focus_comparison=focus_comparison,coverage=dict(coverage))
(folder / (stem + '-audit.json')).write_text(json.dumps(report,indent=2))
print(json.dumps({k:v for k,v in report.items() if k!='summary'},indent=2))
