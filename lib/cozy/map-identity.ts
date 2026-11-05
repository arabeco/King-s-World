/** Stable presentation identity, independent of roster ordering or discovery. */
export function mapIdentity(id:string){
 let hash=2166136261;
 for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
 return {code:hash.toString(36).toUpperCase().padStart(7,'0').slice(-4),shape:hash%4,color:['#98c2c9','#c3a6cb','#d5b984','#a7c69c','#ca9e89'][hash%5]};
}
