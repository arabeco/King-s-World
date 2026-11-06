import AccountNavigation from "@/components/AccountNavigation";
import {requireAuthenticatedAppUser} from "@/lib/app-user";
import {CollectionHub} from "@/components/profile/CollectionHub";
import styles from "@/components/sovereign-page.module.css";
export default async function InventoryPage({searchParams}:{searchParams:{season?:string}}){await requireAuthenticatedAppUser();return <main className={styles.page}><div style={{maxWidth:540,margin:'auto'}}><AccountNavigation active="inventory"/><h1>Inventário</h1><CollectionHub mode="inventory" seasonId={typeof searchParams.season==='string'?searchParams.season:undefined}/></div></main>;}
