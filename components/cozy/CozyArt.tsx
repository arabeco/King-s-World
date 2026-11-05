import Image from "next/image";

/** Existing game art, delivered at the size the control actually needs. */
export default function CozyArt({
  src,
  size = 40,
  className = "",
  priority = false,
}: {
  src: string;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={src}
      alt=""
      aria-hidden="true"
      data-game-art="true"
      width={size}
      height={size}
      priority={priority}
      className={className}
      style={{ objectFit: "contain", flexShrink: 0 }}
    />
  );
}
