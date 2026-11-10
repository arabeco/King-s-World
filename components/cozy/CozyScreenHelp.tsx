"use client";

import CozyFirstVisitHelp from "./CozyFirstVisitHelp";

const guides = {
 map: {title:"Como explorar o mundo",steps:[
  {art:"/icons/nav-world.png",title:"Encontre seu caminho",text:"Arraste com um dedo e ajuste com + e −. Mundo mostra o contorno inteiro. O botão de grade liga ou desliga a malha."},
  {art:"/icons/action-explore.png",title:"Toque para descobrir",text:"Explorar revela o caminho e a região próxima. Confira suprimentos e chegada antes de enviar. Anexar uma área conhecida é outra ação."},
  {art:"/icons/alliance-crest-v1.png",title:"Fronteiras e reservas",text:"Branco indica exploração. Cor e brasão indicam o dono. O tracejado marca reservas. Uma silhueta na névoa indica uma torre avistada."},
 ]},
 crown: {title:"Como comandar seu reino",steps:[
  {art:"/icons/nav-empire.png",title:"Sua Coroa",text:"As cinco áreas reúnem os comandos do reino. Toque nos ícones para construir, recrutar e decidir."},
  {art:"/icons/recursos.png",title:"Tudo à vista",text:"O topo mostra dias reais. Ordens e hordas mostram o tempo até a chegada e continuam enquanto você está fora."},
  {art:"/icons/nav-cities.png",title:"Seu próximo passo",text:"Toque no próximo passo para ver até três opções. Os atalhos só abrem a tela; nada é gasto até você confirmar a ação."},
 ]},
 cities: {title:"Como navegar pelas cidades",steps:[
  {art:"/icons/nav-cities.png",title:"Seu reino em cidades",text:"Cada cartão mostra os níveis dos cinco setores. Toque na cidade para escolher uma obra ou decisão."},
  {art:"/icons/status-warning.png",title:"Fique de olho",text:"Avisos indicam crises e danos. Dentro da cidade, abra Decisões para cuidar da população e das estruturas."},
 ]},
 resources: {title:"Como usar o tesouro",steps:[
  {art:"/icons/recursos.png",title:"Um tesouro do reino",text:"Todas as cidades usam os mesmos recursos. Escolha um recurso para ver o saldo e os atalhos."},
  {art:"/icons/resource-gold-v1.png",title:"Ouro e materiais",text:"Ouro paga heróis e pesquisas. Materiais pagam obras e tropas. A exploração também encontra recursos."},
  {art:"/icons/status-time-v1.png",title:"Produção contínua",text:"A produção mostra o ganho por hora real e continua enquanto você está fora. Suprimentos abastecem viagens."},
 ]},
 orders: {title:"Como acompanhar suas ordens",steps:[
  {art:"/icons/status-time-v1.png",title:"Em andamento ou na fila",text:"Uma ordem ativa já começou. Uma agendada espera sua vez e começa automaticamente, mesmo com você fora."},
  {art:"/icons/action-upgrade.png",title:"Seu destino",text:"Toque na ordem para abrir o destino. Nos planos, você pode revisar cancelamentos e devoluções antes de confirmar."},
 ]},
 reports: {title:"Como acompanhar os relatos",steps:[
  {art:"/icons/nav-intel.png",title:"As crônicas do reino",text:"Aqui chegam descobertas, batalhas e decisões. Abra um relato para ver o resultado completo."},
  {art:"/icons/action-defend.png",title:"Volte à ação",text:"Use os filtros e a busca. Os atalhos de cada relato levam ao lugar que precisa de atenção."},
 ]},
 influence: {title:"Como acompanhar sua influência",steps:[
  {art:"/icons/influencia.png",title:"Cinco caminhos",text:"Cada área chega a 500 pontos. Toque na barra para abrir seus comandos e acompanhar o progresso."},
  {art:"/icons/influence-legacy.png",title:"Seu selo",text:"Alcance 1.500 de influência para registrar o Selo de Vitória. A temporada continua até o ranking final."},
 ]},
 infrastructure: {title:"Como evoluir suas cidades",steps:[
  {art:"/icons/nav-cities.png",title:"Cada cidade conta",text:"Abra uma cidade para ver os cinco setores e escolher sua próxima obra."},
  {art:"/buildings/palacio.png",title:"Nível e cuidado",text:"Obras aumentam os níveis. As decisões da cidade cuidam da eficiência, da confiança e dos reparos."},
  {art:"/icons/influence-infrastructure.png",title:"Seu reino cresce",text:"A base inicial não dá influência. Termine obras para aumentar o reconhecimento de Infraestrutura."},
 ]},
 military: {title:"Como preparar seu exército",steps:[
  {art:"/icons/exercito.png",title:"Tropas do reino",text:"Recrute aqui. Confira os recursos, o tempo e as vagas antes de enviar uma ordem."},
  {art:"/icons/action-defend.png",title:"Prepare sua defesa",text:"A defesa contra hordas é automática. Compare a previsão na aba Defesa; tropas, danos e apoios podem mudá-la."},
  {art:"/icons/building-wall.png",title:"Fortaleça as cidades",text:"O setor Defesa e a pesquisa de fortificação protegem o reino. Derrotas podem reduzir níveis e influência; reparos recuperam integridade, e obras reconstroem os níveis."},
 ]},
 government: {title:"Como conduzir seu governo",steps:[
  {art:"/icons/influence-government.png",title:"Heróis e pesquisas",text:"Contrate heróis e avance nas pesquisas. Cada escolha mostra seu efeito, custo e tempo."},
  {art:"/buildings/palacio.png",title:"Escolha onde ajudar",text:"Atribua um herói a uma cidade para aproveitar sua especialidade. Confira o efeito de cada função."},
  {art:"/icons/status-time-v1.png",title:"Pesquise com intenção",text:"Uma pesquisa por vez. Sábios designados aceleram o trabalho. Confira efeito, custo e tempo antes de confirmar."},
 ]},
 council: {title:"Como decidir no Conselho",steps:[
  {art:"/icons/nav-intel.png",title:"Uma decisão do reino",text:"Compare as alternativas do decreto. Recursos gastos, recompensas e efeitos aparecem antes de assinar."},
  {art:"/icons/influence-society.png",title:"Cuide da confiança",text:"Suas decisões afetam as cidades. Os avisos levam você aos lugares que precisam de cuidado."},
  {art:"/icons/nav-cities.png",title:"Ouça cada cidade",text:"Decisões locais ficam dentro da cidade. Acompanhe as crises para evitar que as colônias se separem."},
 ]},
 achievements: {title:"Como acompanhar suas conquistas",steps:[
  {art:"/icons/influence-legacy.png",title:"Feitos do seu reino",text:"Complete missões, construa Maravilhas e coopere. Confira o progresso e resgate as missões concluídas."},
  {art:"/icons/action-explore.png",title:"Encontre as torres",text:"Torres oferecem desafios e benefícios temporários. Elas têm uma ajuda própria ao abrir sua seção."},
  {art:"/icons/influence-legacy.png",title:"Seu caminho à vitória",text:"A aba Vitória acompanha a influência total e o selo da temporada. Ranking mostra os outros reinos."},
 ]},
 city: {title:"Como cuidar da sua cidade",steps:[
  {art:"/icons/nav-cities.png",title:"Construa seu lugar",text:"Toque em um setor para ver seu nível, sua função e o custo da próxima obra."},
  {art:"/icons/influence-society.png",title:"Decisões da cidade",text:"Na aba Decisões, escolha como cuidar da eficiência, da confiança e da integridade das estruturas."},
  {art:"/icons/building-wall.png",title:"Acompanhe os sinais",text:"Nível e integridade são diferentes. Perder uma colônia libera sua região e suas reservas vinculadas. A capital continua protegida no Cozy."},
 ]},
 alliance: {title:"Como jogar em aliança",steps:[
  {art:"/icons/alliance-crest-v1.png",title:"Encontre sua companhia",text:"Crie uma aliança ou entre em uma existente. Cada grupo reúne até cinco reinos."},
  {art:"/icons/action-defend.png",title:"Ajuda na hora certa",text:"Veja os pedidos de ajuda e os ataques de horda. Confira o custo e o prazo antes de enviar apoio."},
  {art:"/icons/recursos.png",title:"Contribua e acompanhe",text:"Projetos mostram as metas, sua participação e o benefício. A torre pode complementar o projeto da aliança; confira o bônus total no reino."},
 ]},
} satisfies Record<string,{title:string;steps:{art:string;title:string;text:string}[]}>;

export default function CozyScreenHelp({screen,playerId,enabled=true,compact=true,inHeader=true}:{screen:keyof typeof guides;playerId:string;enabled?:boolean;compact?:boolean;inHeader?:boolean}){
 const guide=guides[screen];
 return <CozyFirstVisitHelp helpId={`${screen}:${playerId}`} enabled={enabled} compact={compact} inHeader={inHeader} title={guide.title} steps={guide.steps}/>;
}
