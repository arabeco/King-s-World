import Link from "next/link";
import {Crown, Globe, Package, Store} from "lucide-react";
import styles from "./account-navigation.module.css";

const destinations = [
  {id: "worlds", label: "Mundos", href: "/lobby", Icon: Globe},
  {id: "profile", label: "Perfil", href: "/profile", Icon: Crown},
  {id: "inventory", label: "Inventário", href: "/inventory", Icon: Package},
  {id: "shop", label: "Loja", href: "/premium", Icon: Store},
] as const;

export default function AccountNavigation({active}: {active: typeof destinations[number]["id"]}) {
  return (
    <nav className={styles.navigation} aria-label="Atalhos da conta">
      {destinations.map(({id, label, href, Icon}) => (
        <Link key={id} href={href} aria-current={id === active ? "page" : undefined}>
          <Icon size={19} aria-hidden="true"/>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
