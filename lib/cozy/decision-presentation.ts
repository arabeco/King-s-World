/** Presentation only: stories never change costs, outcomes or influence. */
export function cityDecisionStory(id:string):string {
 const key=id.split(':').at(-1);
 const stories:Record<string,string>={
  crisis:'Os moradores se reúnem na praça. Uma resposta sua pode devolver a confiança.',
  repairs:'Entre pedras e telhas, os vizinhos já começaram a ajudar. Falta decidir como apoiar a obra.',
  families:'Há inquietação pelas ruas. Os representantes vieram conversar com você.',
  watch:'Os vigias voltaram da estrada. É hora de cuidar das reservas da cidade.',
  market:'As bancas abriram cedo. Os mercadores querem negociar os excedentes da cidade.',
  barter:'Uma carroça chegou à praça com ferramentas e mantimentos. O que faz mais falta por aqui?',
  workshops:'Os artesãos têm uma proposta para fazer as oficinas renderem um pouco mais.',
  caravan:'Uma caravana procura apoio. Há uma rota segura e outra que promete mais.',
  economy:'Os artesãos abriram as oficinas. Um pequeno apoio pode ajudar o trabalho do dia.',
  society:'Os vizinhos trouxeram ideias para a praça. Como você quer acolher o encontro?',
  levy:'As famílias e as oficinas precisam de apoio. Você decide a prioridade de hoje.',
  square:'A colheita chegou à praça. Como você quer repartir esse momento?',
 };
 return stories[key??'']??'Os moradores trouxeram uma questão do dia. Escolha como cuidar da cidade.';
}
