import AccountNavigation from "@/components/AccountNavigation";
import {AuthSignOutButton} from "@/components/auth-signout-button";

import { LobbyWorldSelector } from "@/components/lobby-world-selector";
import LobbyAccountBanner from "@/components/LobbyAccountBanner";
import styles from "@/components/lobby.module.css";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import { listWorldSummaries } from "@/lib/world-data";

export default async function LobbyPage() {
  const appUser = await requireAuthenticatedAppUser();
  const worlds = await listWorldSummaries(appUser.id);

  return <main className={styles.page}><div className={styles.stage}>
    <h1 className={styles.brand}>KING’S WORLD</h1>
    <AccountNavigation active="worlds"/>
    <LobbyAccountBanner username={appUser.username}/>
    <LobbyWorldSelector username={appUser.username} worlds={worlds}/>
    <footer className={styles.footer}><AuthSignOutButton/></footer>
  </div></main>;
}
