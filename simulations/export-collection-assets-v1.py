from pathlib import Path
from PIL import Image
import json,shutil
base=Path('public/collection');out=base/'catalog-v1';out.mkdir(exist_ok=True)
jobs=json.loads(Path('docs/collection-sheet-jobs-v1.json').read_text(encoding='utf-8'))
entries=[]
def save_asset(im,key,source,box=None):
 assert im.mode=='RGBA' and im.getchannel('A').getextrema()==(0,255),key
 category='avatars' if key.startswith('avatar-') else 'frames' if key=='premium-avatar-frame' else 'crests' if ('crest' in key or key.startswith(('extra-','premium-'))) and not key.startswith('item-') else 'equipment'
 # Every source and exact cell is kept; UI variants have the same transparent margins.
 target=out/(key+'.png');im.save(target)
 for size in [96,256]:im.resize((size,size),Image.Resampling.LANCZOS).save(out/(key+f'-{size}.png'))
 if category=='avatars':im.resize((128,128),Image.Resampling.LANCZOS).save(out/(key+'-128.png'))
 entries.append({'id':key,'category':category,'image':key+'.png','ui':key+'-96.png','size':list(im.size),'source':source,'crop':box,'status':'generated-review','alpha':True})
for job in jobs:
 folder=out/'sheets';folder.mkdir(exist_ok=True)
 src=Path(job['source']);shutil.copy2(src,folder/(job['id']+'.png'))
 im=Image.open(src).convert('RGBA');w,h=im.size;g=job['grid']
 for i,key in enumerate(job['names']):
  x=i%g;y=i//g;box=(round(x*w/g),round(y*h/g),round((x+1)*w/g),round((y+1)*h/g))
  tile=im.crop(box);save_asset(tile,key,'sheets/'+job['id']+'.png',box)
for src in sorted((base/'samples-v1').glob('*.png')):
 save_asset(Image.open(src).convert('RGBA'),src.stem,'../samples-v1/'+src.name)
for item in json.loads((base/'equipment-sheet-v1/manifest.json').read_text(encoding='utf-8'))['items']:
 src=base/'equipment-sheet-v1'/item['image']
 save_asset(Image.open(src).convert('RGBA'),'item-'+item['id'],'../equipment-sheet-v1/'+src.name,item['crop'])
assert len(entries)==50 and len({e['id'] for e in entries})==50
assert sum(e['category']=='avatars' for e in entries)==8
assert sum(e['category']=='equipment' for e in entries)==15
assert sum(e['category']=='crests' for e in entries)==26
assert sum(e['category']=='frames' for e in entries)==1
(out/'manifest.json').write_text(json.dumps(entries,ensure_ascii=False,indent=2),encoding='utf-8')
labels={'crests':'Brasões · 20 gratuitos e 6 extras','equipment':'Equipamentos · 15','avatars':'Avatares · 8','frames':'Moldura Premium'}
sections=''
for cat,label in labels.items():
 cards=''.join('<article><img loading="lazy" class="large" src="'+e['image']+'" alt="'+e['id']+'"><small>'+e['id']+'</small><div><img width="48" height="48" src="'+e['ui']+'" alt=""><img width="32" height="32" src="'+e['ui']+'" alt=""></div></article>' for e in entries if e['category']==cat)
 sections+='<h2>'+label+'</h2><section>'+cards+'</section>'
(out/'index.html').write_text('''<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>King’s World · Coleção completa</title><style>body{margin:0;padding:20px;background:#191a1c;color:#ecdbb6;font-family:Georgia}main{max-width:1150px;margin:auto}h1{font-size:27px}h2{font-size:22px;margin-top:32px}section{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}article{min-width:0;text-align:center;border-bottom:1px solid #ad8f5044;background:radial-gradient(ellipse at top,#66513433,transparent);padding:8px}.large{width:100%;height:170px;object-fit:contain}small{display:block;overflow-wrap:anywhere;font:11px/1.5 system-ui;color:#c6b48f}article div{display:flex;align-items:center;justify-content:center;gap:12px;margin:8px}article div img{object-fit:contain}@media(max-width:700px){section{grid-template-columns:repeat(3,minmax(0,1fr))}.large{height:135px}}@media(max-width:400px){section{grid-template-columns:repeat(2,minmax(0,1fr))}}</style><main><h1>Coleção completa · 50 artes</h1><p>Artes geradas para revisão. Equipar e desbloquear ainda dependem da integração ao jogo.</p>'''+sections+'</main></html>',encoding='utf-8')
print('PASS: 50 unique assets; 26 crests, 15 equipment, 8 avatars, 1 frame. Alpha and exports verified.')
