import Link from "next/link";
import {Crown, Globe, Package, Store} from "lucide-react";
import styles from "./account-navigation.module.css";

const destinations = [
  {id: "worlds", label: "Mundos", href: "/lobby", Icon: Globe, image:'/icons/nav-world.png'},
  {id: "profile", label: "Perfil", href: "/profile", Icon: Crown, image:'/icons/nav-profile.png'},
  {id: "inventory", label: "Inventário", href: "/inventory", Icon: Package, image:null},
  {id: "shop", label: "Loja", href: "/premium", Icon: Store, image:null},
] as const;

export default function AccountNavigation({active}: {active: typeof destinations[number]["id"]}) {
  return (
    <nav className={styles.navigation} aria-label="Atalhos da conta">
      {destinations.map(({id, label, href, Icon,image}) => (
        <Link key={id} href={href} aria-current={id === active ? "page" : undefined}>
          {image?<img src={image} width={27} height={27} alt=""/>:<Icon size={22} aria-hidden="true"/>}
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
