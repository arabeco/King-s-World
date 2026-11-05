from pathlib import Path
from PIL import Image
import json,shutil,html
base=Path('public/collection/sovereigns-v2')
roster=json.loads((base/'roster.json').read_text(encoding='utf-8'))
manifest=json.loads((base/'manifest.json').read_text(encoding='utf-8'))
manifest=[e for e in manifest if e['id'] in {r['id'] for r in roster[:8]}]
jobs=json.loads(Path('docs/sovereign-unlock-generation-v1.json').read_text(encoding='utf-8'))
# Face centers in each 512x768 cell, chosen after visual inspection of the source sheets.
centers=[(255,115),(255,110),(250,110),(250,110),(250,115),(265,115),(255,115),(270,205),(245,115),(250,115),(255,120),(260,115)]
for job in jobs:
 src=Path(job['source']);shutil.copy2(src,base/(job['id']+'-sheet.png'))
 im=Image.open(src).convert('RGBA');w,h=im.size
 for i,key in enumerate(job['names']):
  x=i%2;y=i//2;box=(x*w//2,y*h//2,(x+1)*w//2,(y+1)*h//2);tile=im.crop(box)
  assert tile.getchannel('A').getextrema()[0]==0 and tile.getchannel('A').getextrema()[1]>200
  tile.save(base/(key+'-body.png'));tile.resize((256,384),Image.Resampling.LANCZOS).save(base/(key+'-body-384.png'))
  idx=int(key.split('-')[-1])-9;cx,cy=centers[idx];size=240
  left=max(0,min(tile.width-size,round(cx*tile.width/512-size/2)))
  top=max(0,min(tile.height-size,round(cy*tile.height/768-size/2)))
  facebox=(left,top,left+size,top+size);avatar=tile.crop(facebox)
  avatar.save(base/(key+'-avatar.png'))
  for edge in [96,128,256]:avatar.resize((edge,edge),Image.Resampling.LANCZOS).save(base/(key+f'-avatar-{edge}.png'))
  entry=next(e for e in roster if e['id']==key)
  entry.update(artStatus='generated',avatar='/collection/sovereigns-v2/'+key+'-avatar.png',body='/collection/sovereigns-v2/'+key+'-body.png')
  manifest.append({**entry,'avatar':key+'-avatar.png','body':key+'-body.png','source':job['id']+'-sheet.png','crop':box,'avatarCrop':facebox,'status':'visual-review'})
(base/'roster.json').write_text(json.dumps(roster,ensure_ascii=False,indent=2),encoding='utf-8')
(base/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
s=(base/'index.html').read_text(encoding='utf-8');prefix=s.split('<main>')[0]
sections=''
for label,items in [('Oito aparências iniciais',roster[:8]),('Doze aparências desbloqueáveis',roster[8:])]:
 cards=''
 for e in items:
  n=e['npcIdentity'];tag='Disponível inicialmente' if e['initialAvailable'] else e['rarity']+' · desbloqueável'
  cards+=f'''<article><img loading="lazy" class="avatar" src="{e['id']}-avatar.png" alt="Avatar — {e['appearanceLabel']}"><img loading="lazy" class="body" src="{e['id']}-body.png" alt="Corpo inteiro — {e['appearanceLabel']}"><h2>{e['appearanceLabel']}</h2><p class="nickname">Seu nickname</p><small>{tag}</small><details><summary>Identidade para NPC</summary><h3>{n['name']}, {n['title']}</h3><p>{n['description']}</p></details></article>'''
 sections+='<h2>'+label+'</h2><section>'+cards+'</section>'
(base/'index.html').write_text(prefix+'<main><h1>Vinte aparências do soberano</h1><p>O jogador usa o próprio nickname. Os nomes e perfis narrativos ficam reservados aos NPCs. Artes disponíveis para revisão; escolha e desbloqueio ainda dependem da integração ao jogo.</p>'+sections+'</main></html>',encoding='utf-8')
assert len(manifest)==20 and len({e['id'] for e in manifest})==20
assert all((base/(e['id']+'-body.png')).exists() and (base/(e['id']+'-avatar.png')).exists() for e in roster)
print('PASS: all 20 appearances have paired avatar and full body; 8 initial, 12 unlockable; alpha and unique IDs checked.')
