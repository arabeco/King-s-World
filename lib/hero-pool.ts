import type { HeroSpecialistId } from "@/lib/council";

export type HeroProfileId =
  | "iele_varr"
  | "tomas_ferrocorte"
  | "karl_avenor"
  | "varyn_korr"
  | "helena_draven"
  | "gareth_valkren"
  | "boris_ardheim"
  | "corven_nalto"
  | "talia_vael"
  | "lyra_morn"
  | "silas_varyn"
  | "salen_ordo"
  | "mira_valessa"
  | "victor_caelmont"
  | "elara_voss"
  | "maelis_verdan"
  | "aldebaran_velorian"
  | "nia_ervain";

export type HeroProfile = {
  id: HeroProfileId;
  specialistId: HeroSpecialistId;
  name: string;
  title: string;
  imageSrc: string;
  role: string;
  influenceValue: 50;
  portraitPrompt: string;
};

export const HERO_POOL: HeroProfile[] = [
  {
    id: "iele_varr",
    specialistId: "engineer",
    name: "Iele Varr",
    title: "Engenheira de Cerco",
    imageSrc: "/herois/hero-iele-varr.jpg",
    role: "Obras, muralhas e cidade 100/100.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Iele Varr, engenheira de cerco jovem adulta, pele morena clara, cabelo curto castanho preso por faixa de couro, olhar concentrado, casaco de couro reforcado, luvas de trabalho, ferramentas no cinto, fundo de muralha em construcao com andaimes e luz dourada de forja, fantasia medieval sombria, pintura digital cinematografica.",
  },
  {
    id: "tomas_ferrocorte",
    specialistId: "engineer",
    name: "Tomas Ferrocorte",
    title: "Mestre Construtor",
    imageSrc: "/herois/hero-tomas-ferrocorte.jpg",
    role: "Infraestrutura pesada, acabamento e reparo.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Tomas Ferrocorte, mestre construtor veterano, homem forte de barba grisalha curta, avental de couro sobre armadura simples, martelo de engenharia na mao, fundo com guindaste medieval, blocos de pedra e brasas, fantasia medieval realista.",
  },
  {
    id: "karl_avenor",
    specialistId: "engineer",
    name: "Karl Avenor",
    title: "Engenheiro Civil",
    imageSrc: "/herois/hero-karl-avenor.jpg",
    role: "Pontes, obras civis e conexao de territorios.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Karl Avenor, engenheiro civil veterano, barba branca e oculos, avental de couro sobre camisa, segurando compasso e planta arquitetonica, fundo com ponte de pedra em construcao, fantasia medieval realista, luz de canteiro de obras.",
  },
  {
    id: "varyn_korr",
    specialistId: "marshal",
    name: "Varyn Korr",
    title: "General de Campo",
    imageSrc: "/herois/hero-varyn-korr.jpg",
    role: "Ataque, moral e conquista.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Varyn Korr, general de campo severo, pele clara marcada pelo sol, cabelo preto com fios grisalhos, barba curta, armadura escura com detalhes vermelhos, capa militar rasgada, espada baixa em primeiro plano, fundo de campo de batalha enevoado.",
  },
  {
    id: "helena_draven",
    specialistId: "marshal",
    name: "Helena Draven",
    title: "Comandante da Vanguarda",
    imageSrc: "/herois/hero-helena-draven.jpg",
    role: "Choque, disciplina e pressao militar.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Helena Draven, comandante da vanguarda, mulher adulta de olhar frio, cabelo ruivo escuro preso em tranca, armadura lamelar negra e bronze, manto curto de campanha, segurando elmo, fundo com portao de fortaleza e soldados em marcha.",
  },
  {
    id: "gareth_valkren",
    specialistId: "marshal",
    name: "Gareth Valkren",
    title: "Comandante de Cavalaria",
    imageSrc: "/herois/hero-gareth-valkren.jpg",
    role: "Cavalaria, iniciativa e perseguicao.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Gareth Valkren, comandante de cavalaria experiente, cabelo grisalho, armadura de escamas e placas com detalhes avermelhados, segurando lanca e berrante, fundo com acampamento militar e cavaleiros prontos para marcha.",
  },
  {
    id: "boris_ardheim",
    specialistId: "marshal",
    name: "Boris Ardheim",
    title: "Capitao da Infantaria Pesada",
    imageSrc: "/herois/hero-boris-ardheim.jpg",
    role: "Linha de frente, impacto e defesa de choque.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Boris Ardheim, capitao da infantaria pesada, homem robusto, armadura de placas completas de aco escuro, segurando um martelo de guerra, fundo com fileiras de soldados com escudos, fantasia medieval sombria.",
  },
  {
    id: "corven_nalto",
    specialistId: "navigator",
    name: "Corven Nalto",
    title: "Explorador Real",
    imageSrc: "/herois/hero-corven-nalto.jpg",
    role: "Mapa, territorio conhecido e rotas.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Corven Nalto, explorador real, homem magro de pele oliva, cabelo castanho longo preso, capa verde escura, broche de bussola, mapa enrolado e adaga, fundo de vale montanhoso com nevoa e trilha iluminada.",
  },
  {
    id: "talia_vael",
    specialistId: "navigator",
    name: "Talia Vael",
    title: "Batedora das Fronteiras",
    imageSrc: "/herois/hero-talia-vael.jpg",
    role: "Reconhecimento, risco e deslocamento.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Talia Vael, batedora das fronteiras, pele bronzeada, cabelo negro cacheado preso, capa cinza-esverdeada, arco curto nas costas, fundo de floresta escura abrindo para territorio desconhecido.",
  },
  {
    id: "lyra_morn",
    specialistId: "navigator",
    name: "Lyra Morn",
    title: "Exploradora Subterranea",
    imageSrc: "/herois/hero-lyra-morn.jpg",
    role: "Cavernas, ruinas e ameacas escondidas.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Lyra Morn, exploradora subterranea, jovem mulher com jaqueta de couro reforcada, segurando lampiao aceso e minerio bruto, fundo de caverna escura com escoras de madeira, atmosfera de descoberta perigosa.",
  },
  {
    id: "silas_varyn",
    specialistId: "navigator",
    name: "Silas Varyn",
    title: "Mestre Navegador",
    imageSrc: "/herois/hero-silas-varyn.jpg",
    role: "Rotas longas, costa e deslocamento estrategico.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Silas Varyn, mestre navegador, homem maduro com barba grisalha e cicatrizes, casaco azul naval grosso, segurando um sextante, fundo com fortaleza costeira e um navio no mar.",
  },
  {
    id: "salen_ordo",
    specialistId: "intendente",
    name: "Salen Ordo",
    title: "Administrador Imperial",
    imageSrc: "/herois/hero-salen-ordo.jpg",
    role: "Suprimentos, comboios e fluxo interno.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Salen Ordo, administrador imperial, pele escura, cabelo raspado, roupas nobres praticas em azul petroleo e ouro envelhecido, segurando livro-caixa e sinete, fundo com armazens, carrocas e guardas de suprimento.",
  },
  {
    id: "mira_valessa",
    specialistId: "intendente",
    name: "Mira Valessa",
    title: "Mestra dos Comboios",
    imageSrc: "/herois/hero-mira-valessa.jpg",
    role: "Expansao, abastecimento e sustentacao.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Mira Valessa, mestra dos comboios, mulher adulta robusta, sardas, cabelo loiro escuro em coque baixo, casaco de viagem com placas leves, chaveiro de armazem, fundo com estrada lamacenta e carrocas.",
  },
  {
    id: "victor_caelmont",
    specialistId: "intendente",
    name: "Victor Caelmont",
    title: "Mestre da Moeda",
    imageSrc: "/herois/hero-victor-caelmont.jpg",
    role: "Tesouro, custo, compra e manutencao.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Victor Caelmont, mestre da moeda do reino, homem adulto serio, roupas escuras nobres com grossa corrente de ouro, segurando balanca e cofrinho, fundo de tesouraria com pilhas de barras de ouro.",
  },
  {
    id: "elara_voss",
    specialistId: "intendente",
    name: "Elara Voss",
    title: "Mestra dos Registros",
    imageSrc: "/herois/hero-elara-voss.jpg",
    role: "Administracao, arquivos e controle do reino.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Elara Voss, mestra dos registros, senhora de expressao severa, cabelos grisalhos presos, vestido pratico com chaves pesadas no cinto, segurando pergaminhos, fundo de biblioteca classica iluminada.",
  },
  {
    id: "maelis_verdan",
    specialistId: "erudite",
    name: "Maelis Verdan",
    title: "Sabia da Corte",
    imageSrc: "/herois/hero-maelis-verdan.jpg",
    role: "Pesquisa, doutrina, quests e legado.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Maelis Verdan, sabia da corte, mulher idosa elegante, cabelo branco longo parcialmente coberto por veu azul profundo, robe bordado com simbolos astronomicos, segurando livro antigo, fundo de biblioteca real com vitrais.",
  },
  {
    id: "aldebaran_velorian",
    specialistId: "erudite",
    name: "Aldebaran Velorian",
    title: "Astrologo Real",
    imageSrc: "/herois/hero-aldebaran-velorian.jpg",
    role: "Astronomia, pressagios e leitura de era.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Aldebaran Velorian, astrologo real, idoso de barba branca majestosa, tunica roxa profunda com detalhes dourados, segurando astrolabio e grimorio, fundo de observatorio de vidro com ceu estrelado.",
  },
  {
    id: "nia_ervain",
    specialistId: "erudite",
    name: "Nia Ervain",
    title: "Alquimista Botanica",
    imageSrc: "/herois/hero-nia-ervain.jpg",
    role: "Alquimia, cura, estudo e sociedade.",
    influenceValue: 50,
    portraitPrompt:
      "Retrato vertical de Nia Ervain, alquimista e botanica, jovem mulher com avental claro de trabalho, segurando pilao e um frasco com pocao verde brilhante, fundo de laboratorio com ervas secas e vidrarias.",
  },
];

export const HERO_POOL_BY_ID = Object.fromEntries(HERO_POOL.map((hero) => [hero.id, hero])) as Record<HeroProfileId, HeroProfile>;

export function getHeroPoolBySpecialist(specialistId: HeroSpecialistId): HeroProfile[] {
  return HERO_POOL.filter((hero) => hero.specialistId === specialistId);
}
