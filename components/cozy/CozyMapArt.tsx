import assets from "@/lib/cozy/map-assets.json";

/** Crop transparent padding at render time; preserve original PNG files. */
export default function CozyMapArt({ name, size = 30 }: {
  name: keyof typeof assets;
  size?: number;
}) {
  const art = assets[name];
  const [left, top, right, bottom] = art.bounds;
  const source=(name==="construction"||name.startsWith("cityConstruction")||name==="cityCompleted"||name==="capital"||["gold","time","alliance","uiMaterials","uiSupplies"].includes(name))?`/_next/image?url=${encodeURIComponent(art.src)}&w=${size<=48?128:256}&q=85`:art.src;
  const padding = Math.max(right - left, bottom - top) * .05;
  return (
    <svg data-map-art={name} width={size} height={size} aria-hidden="true" focusable="false"
      viewBox={`${left - padding} ${top - padding} ${right - left + padding * 2} ${bottom - top + padding * 2}`}
      style={{ overflow: "hidden", flexShrink: 0 }}>
      <image href={source} width={art.width} height={art.height} />
    </svg>
  );
}
