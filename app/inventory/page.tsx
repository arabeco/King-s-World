import AccountNavigation from "@/components/AccountNavigation";
import Link from "next/link";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {CollectionHub} from "@/components/profile/CollectionHub";
import styles from "@/components/sovereign-page.module.css";
export default async function InventoryPage({searchParams}:{searchParams:{season?:string}}) {
  await requireAuthenticatedAppUser();
  return <main className={styles.page}><div className={styles.stage}>
    <AccountNavigation active="inventory"/>
    <h1>Inventário</h1>
    {process.env.KW_COZY_PERSISTENT_PREVIEW!=="0" && <Link className={styles.legacyLink} href="/inventory/legacy">Legado</Link>}
    <CollectionHub mode="inventory" seasonId={typeof searchParams.season==='string'?searchParams.season:undefined}/>
  </div></main>;
}
