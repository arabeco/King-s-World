import roster from "@/public/collection/sovereigns-v2/roster.json";
export const SOVEREIGN_APPEARANCES=roster.map(({id,appearanceLabel,avatar,body,initialAvailable,baseStats})=>({id,label:appearanceLabel,avatar,body,available:initialAvailable,baseStats}));
export function sovereignAppearance(id?:string){return SOVEREIGN_APPEARANCES.find(item=>item.id===id)??SOVEREIGN_APPEARANCES[0];}
