export const STARTER_CRESTS=Array.from({length:20},(_,i)=>`empire-crest-${String(i+1).padStart(2,'0')}`);
const extras=['premium-griffin','extra-dragon','premium-phoenix','extra-hippocampus','extra-crowned-serpent','extra-winged-lion'];
export function isCrestId(id:unknown):id is string{return typeof id==='string'&&(STARTER_CRESTS.includes(id)||extras.includes(id));}
export function crestImage(id:unknown){return isCrestId(id)?`/collection/catalog-v1/${id}-96.png`:null;}
