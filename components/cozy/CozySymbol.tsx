import CozyMapArt from "./CozyMapArt";

/** Shared decorative symbols; the containing control keeps its readable name and value. */
export default function CozySymbol({ name, size = 24 }: {
  name: "gold" | "materials" | "supplies" | "time" | "alliance";
  size?: number;
}) {
  const art = name === "materials" ? "uiMaterials" : name === "supplies" ? "uiSupplies" : name;
  return <CozyMapArt name={art} size={size}/>;
}
