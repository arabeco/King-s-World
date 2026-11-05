"use client";
import {useState} from "react";
import styles from "./cosmetics.module.css";
const portraits=[{id:"founder",name:"Fundador",src:"/icons/nav-empire.png"},{id:"regent",name:"Regente",src:"/images/king-orian.jpg"},{id:"warden",name:"Guardião",src:"/images/king-corven.jpg"}];
const frames=[{id:"bronze",name:"Bronze",color:"#ae8054"},{id:"gold",name:"Ouro",color:"#f0ce78"},{id:"silver",name:"Prata",color:"#b8c9d3"}];
const banners=[{id:"forest",name:"Floresta",color:"#234b39"},{id:"wine",name:"Rubi",color:"#54252e"},{id:"night",name:"Noite",color:"#243a55"}];
export function CosmeticPreview(){
 const [tab,setTab]=useState<"portrait"|"frame"|"banner">("portrait"),[portrait,setPortrait]=useState(0),[frame,setFrame]=useState(1),[banner,setBanner]=useState(0);
 const items=tab==="portrait"?portraits:tab==="frame"?frames:banners;
 const selected=tab==="portrait"?portrait:tab==="frame"?frame:banner;
 return <section className={styles.preview} aria-label="Provador de aparência">
  <div className={styles.previewHeading}><h2>Aparência</h2><small>Prévia</small></div>
  <div className={styles.banner} style={{backgroundColor:banners[banner].color}}><img className={styles.portrait} style={{borderColor:frames[frame].color}} src={portraits[portrait].src} alt={`${portraits[portrait].name}, moldura ${frames[frame].name}, estandarte ${banners[banner].name}`}/></div>
  <div className={styles.tabs} role="group" aria-label="Categoria de aparência">{([['portrait','Retrato'],['frame','Moldura'],['banner','Estandarte']] as const).map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div>
  <div className={styles.options}>{items.map((item,index)=><button key={item.id} type="button" aria-pressed={selected===index} onClick={()=>tab==="portrait"?setPortrait(index):tab==="frame"?setFrame(index):setBanner(index)}>{'src' in item?<img src={item.src} alt=""/>:<span className={tab==="frame"?styles.frameSwatch:styles.bannerSwatch} style={{borderColor:item.color,backgroundColor:tab==="banner"?item.color:undefined}}/>}<span>{item.name}</span></button>)}</div>
  <small className={styles.subtitle}>Experimente a combinação · ainda não salva na conta</small>
 </section>;
}
