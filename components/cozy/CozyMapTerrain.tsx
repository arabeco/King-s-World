export default function CozyMapTerrain({uid}:{uid:string}) {
  return <>
     <image id={`${uid}province`} href="/world/royal-valley-v1.webp" width="760" height="760"/>
     <pattern id={`${uid}valley`} width="1520" height="1520" patternUnits="userSpaceOnUse">
       <use href={`#${uid}province`}/>
       <use href={`#${uid}province`} transform="translate(1520 0) scale(-1 1)"/>
       <use href={`#${uid}province`} transform="translate(0 1520) scale(1 -1)"/>
       <use href={`#${uid}province`} transform="translate(1520 1520) scale(-1 -1)"/>
     </pattern>
  </>;
}
