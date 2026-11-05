"use client";
import styles from './world-loading-screen.module.css';
export function WorldLoadingScreen({progress}:{progress?:number}){
 const value=progress===undefined?undefined:Math.max(0,Math.min(100,Math.round(progress)));
 return <section className={styles.screen} role="status" aria-label="Carregando reino" aria-live="polite"><div className={styles.content}><img src="/icons/nav-empire.png" width={66} height={66} alt=""/><span className={styles.brand}>KING’S WORLD</span><h1>Abrindo os portões</h1><div className={styles.track} role="progressbar" aria-label="Entrada no reino" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} data-indeterminate={value===undefined||undefined}><span style={value===undefined?undefined:{width:`${value}%`}}/></div><small>Seu reino está a caminho</small></div></section>;
}
