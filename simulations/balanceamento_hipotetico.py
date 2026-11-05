"""Modelo hipotético de design; não executa o motor nem representa jogadores reais."""
import random, statistics, json
from collections import defaultdict

SEED=41031; N=20000
PROFILES=[('dedicado',.25,2220,180),('casual',.40,1780,200),('frequente_ruim',.20,1250,190),('negligente',.15,850,220)]
AREAS=('infraestrutura','governo','militar','conselho','conquistas')
def run(seed=SEED, luck_factor=1, damage_factor=1):
 r=random.Random(seed); records=[]
 for _ in range(N):
  u=r.random(); cumulative=0
  for name,weight,mean,sd in PROFILES:
   cumulative+=weight
   if u<cumulative: break
  # Aptidão latente contém capacidade de ação e boas decisões; não é produção real.
  target=max(0,r.gauss(mean,sd)); luck=max(-100,min(100,r.gauss(0,45)))*luck_factor
  spread=[max(.6,r.gauss(1,.14)) for _ in AREAS]; scale=sum(spread)
  target+=luck
  areas=[0.0]*5; peak=0; victory=None; snapshots={}
  losses=0
  for day in range(1,121):
   # Curva de referência, com variação por área e travas em 500.
   for j in range(5):
    gain=max(0,target*spread[j]/scale)/120
    areas[j]=min(500,areas[j]+gain)
   # Choque de crise: reduz conselho/militar, com recuperação no crescimento normal.
   if day in (45,75,105) and r.random()<(.035 if name=='dedicado' else .07 if name=='casual' else .14):
    loss=r.uniform(15,55)*damage_factor; areas[2]=max(0,areas[2]-loss*.5); areas[3]=max(0,areas[3]-loss*.5); losses+=loss
   total=sum(areas); peak=max(peak,total)
   if victory is None and total>=1500: victory=day
   if day in (30,60,90,120): snapshots[day]=round(total)
  records.append((name,round(sum(areas)),round(peak),victory,snapshots,losses))
 def group(rs):
  scores=[x[1] for x in rs]; wins=[x[3] for x in rs if x[3] is not None]
  return {'n':len(rs),'vitoria_pct':round(100*len(wins)/len(rs),1),'final_mediana':round(statistics.median(scores)),'final_p10':round(sorted(scores)[int(len(scores)*.1)]),'final_p90':round(sorted(scores)[int(len(scores)*.9)]),'vitoria_dia_mediano':round(statistics.median(wins)) if wins else None,'atingiu_2500':sum(x[2]>=2500 for x in rs),'curva_mediana':{d:round(statistics.median(x[4][d] for x in rs)) for d in (30,60,90,120)}}
 return {'total':group(records),'perfis':{p[0]:group([x for x in records if x[0]==p[0]]) for p in PROFILES}}
if __name__=='__main__':
 result={'modelo':'hipotetico, nao motor','seed':SEED,'n':N,'base':run(),'sem_sorte':run(luck_factor=0),'dobro_sorte':run(luck_factor=2),'dobro_dano':run(damage_factor=2)}
 print(json.dumps(result,ensure_ascii=False,indent=2))

