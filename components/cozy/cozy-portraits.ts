import type {CozyHeroRole} from "@/lib/cozy/types";

export const counselorPortraits: Record<string,string> = {
  helena:"/herois/hero-helena-draven.jpg", tomas:"/herois/hero-tomas-ferrocorte.jpg",
  ines:"/herois/hero-maelis-verdan.jpg", bento:"/herois/hero-boris-ardheim.jpg",
};

export const heroPortraits: Record<CozyHeroRole,string> = {
  general:"/herois/hero-gareth-valkren.jpg",
  engineer:"/herois/hero-karl-ponteiro.jpg",
  administrator:"/herois/hero-elara-voss.jpg",
  explorer:"/herois/hero-lyra-morn.jpg",
  sage:"/herois/hero-aldebaran-velorian.jpg",
};
