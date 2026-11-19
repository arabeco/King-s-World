import Image from "next/image";
import styles from "./cozy-scene.module.css";

export default function CozyScene({src, position}: {src: string; position?: string}) {
  return (
    <span className={styles.scene} aria-hidden="true">
      <Image src={src} alt="" fill sizes="(max-width: 520px) 100vw, 520px" style={{objectPosition: position}} />
    </span>
  );
}
