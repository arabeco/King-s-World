import styles from "./sovereign-stats.module.css";
export type SovereignStatValues={administration:number;command:number;exploration:number};
const stats=[['administration','Administração','/icons/building-government.png'],['command','Comando','/icons/action-defend.png'],['exploration','Exploração','/icons/action-explore.png']] as const;
export function SovereignStats({values,label='Stats',compact=false}:{values:SovereignStatValues;label?:string;compact?:boolean}){
 return <span className={styles.root} data-compact={compact||undefined} role="group" aria-label={label}>{stats.map(([key,name,icon])=><span className={styles.stat} data-stat={key} key={key} title={`${name}: ${values[key]}%`} aria-label={`${name}: ${values[key]}%`}><img src={icon} alt=""/>{!compact&&<span className={styles.name}>{name}</span>}<span className={styles.track} role="meter" aria-label={name} aria-valuemin={0} aria-valuemax={10} aria-valuenow={Math.max(0,Math.min(10,values[key]))} aria-valuetext={`${values[key]}%`}><span style={{width:`${Math.max(0,Math.min(10,values[key]))*10}%`}}/></span><strong>{values[key]}%</strong></span>)}</span>;
}
