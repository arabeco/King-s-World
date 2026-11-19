import {ASCENSION_MEDALS, ASCENSION_MEDAL_ART, type CozyAscensionHistory} from "@/lib/cozy/ascension-preview";
import CozyArt from "./CozyArt";
import styles from "./cozy-ascension-medals.module.css";

export default function CozyAscensionMedals({medals}: {medals: CozyAscensionHistory["medals"]}) {
  const earned = ASCENSION_MEDALS.filter(medal => (medals[medal.id] ?? 0) > 0);
  if (!earned.length) return null;

  return <ul className={styles.medals} aria-label="Medalhas conquistadas">
    {earned.map(medal => <li key={medal.id} data-medal={medal.id}>
      <span className={styles.medalArt}>
        <CozyArt src={ASCENSION_MEDAL_ART[medal.id]} size={56}/>
        {(medals[medal.id] ?? 0) > 1 && <b>×{medals[medal.id]}</b>}
      </span>
      <span>{medal.label}</span>
    </li>)}
  </ul>;
}
