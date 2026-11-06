import AccountNavigation from "@/components/AccountNavigation";
import {CollectionHub} from "@/components/profile/CollectionHub";
import { PremiumPaywallCard } from "@/components/premium-paywall-card";
import { requireAuthenticatedAppUser } from "@/lib/app-user";
import styles from "@/components/sovereign-page.module.css";
export default async function PremiumPage(){
 await requireAuthenticatedAppUser();
 return <main className={styles.page}><AccountNavigation active="shop"/><CollectionHub mode="shop"/><PremiumPaywallCard/></main>;
}
