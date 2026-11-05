import type {CozyAction,CozyAllianceProject,CozyAllianceProjectKind,CozyResources,CozyShared,CozyState} from './types';

// Functional starting values; seasonal calibration remains a separate step.
export const ALLIANCE_LIMIT=5;
export const ALLIANCE_PROJECTS={
 defense:{name:'Bastião dos aliados',description:'Preparar a defesa conjunta contra as hordas.',cost:{materials:600,supplies:400,gold:0},bonus:.10,days:7},
 provisions:{name:'Rotas de abastecimento',description:'Organizar o abastecimento dos reinos aliados.',cost:{materials:500,supplies:0,gold:100},bonus:.10,days:7},
} as const;
export class AllianceRuleError extends Error {}
function requireRule(value:unknown,message:string):asserts value {if(!value)throw new AllianceRuleError(message);}
export function projectTotals(project:Pick<CozyAllianceProject,"contributions">):CozyResources {
 const totals={gold:0,materials:0,supplies:0};
 for(const contribution of Object.values(project.contributions))for(const resource of Object.keys(totals) as (keyof CozyResources)[])totals[resource]+=contribution[resource]??0;
 return totals;
}
export function allianceBonus(state:CozyState,kind:CozyAllianceProjectKind,at:number){
 return state.allianceBenefits?.some(b=>b.allianceId===state.allianceId&&b.kind===kind&&b.from<=at&&at<b.until)?ALLIANCE_PROJECTS[kind].bonus:0;
}
/** Sync before chronological accrual; receipts survive departure and dissolved groups. */
export function syncAllianceProjects(state:CozyState,shared:CozyShared,at:number,onReport:(title:string,body:string)=>void){
 const projects=shared.allianceProjects??[];
 state.allianceBenefits=projects.filter(p=>p.allianceId===state.allianceId&&p.completedAt!==null&&p.until!==null).map(p=>({projectId:p.id,allianceId:p.allianceId,kind:p.kind,from:p.completedAt!,until:p.until!}));
 for(const project of projects){
  const mine=project.contributions[state.playerId];
  if(!mine||state.allianceProjectReceipts?.[project.id])continue;
  if(project.canceledAt!==undefined&&project.canceledAt<=at){
   for(const resource of ['gold','materials','supplies'] as const)state.resources[resource]+=mine[resource]??0;
   (state.allianceProjectReceipts??={})[project.id]='refunded';
   onReport('Reserva devolvida',`A aliança foi encerrada antes de concluir ${ALLIANCE_PROJECTS[project.kind].name}. Sua contribuição foi devolvida.`);
  }else if(project.completedAt!==null&&project.completedAt<=at){
   (state.allianceProjectReceipts??={})[project.id]='completed';
   if(state.progression){const feats=state.progression.feats;(feats.projects??=[]).push(project.id);}
   onReport('Projeto da aliança concluído',`Sua contribuição foi utilizada em ${ALLIANCE_PROJECTS[project.kind].name}. A participação permanece no seu histórico. O bônus coletivo vale por ${ALLIANCE_PROJECTS[project.kind].days} dias de jogo para os membros da aliança.`);
  }
 }
}
export function applyAllianceAction(state:CozyState,shared:CozyShared,action:CozyAction,now:number,dayMs:number,nextId:(prefix:string)=>string){
 const me=state.playerId;
 const current=()=>{const group=shared.alliances.find(a=>a.id===state.allianceId&&a.members.includes(me));requireRule(group,'Você precisa pertencer a uma aliança.');return group;};
 const clearPending=()=>{for(const group of shared.alliances){group.invitations=group.invitations?.filter(id=>id!==me);group.requests=group.requests?.filter(id=>id!==me);}};
 const known=(id:string)=>Object.values(shared.claims).some(c=>c.playerId===id);
 switch(action.type){
 case 'alliance_create':{
  requireRule(state.allianceId===null,'Você já pertence a uma aliança.');
  requireRule(typeof action.name==='string'&&action.name.trim().length>=3&&action.name.trim().length<=32,'Use um nome de aliança entre 3 e 32 caracteres.');
  const name=action.name.trim();requireRule(!shared.alliances.some(a=>a.name.toLocaleLowerCase()===name.toLocaleLowerCase()),'Já existe uma aliança com esse nome.');
  clearPending();const id=nextId('alliance');shared.alliances.push({id,name,founderId:me,members:[me],createdAt:now,admission:'open',invitations:[],requests:[]});state.allianceId=id;return;
 }
 case 'alliance_join':{
  requireRule(state.allianceId===null,'Saia da sua aliança antes de entrar em outra.');
  const group=shared.alliances.find(a=>a.id===action.allianceId);requireRule(group,'Aliança não encontrada.');
  requireRule(group.members.length<ALLIANCE_LIMIT,'Essa aliança chegou a 5 membros.');
  requireRule(group.admission!=='approval'||group.invitations?.includes(me),'Envie um pedido de entrada ou aceite um convite da aliança.');
  clearPending();if(!group.members.includes(me))group.members.push(me);state.allianceId=group.id;return;
 }
 case 'alliance_leave':{
  const group=current();group.members=group.members.filter(id=>id!==me);if(group.founderId===me)group.founderId=group.members[0]??'';
  if(!group.members.length){for(const project of shared.allianceProjects??[])if(project.allianceId===group.id&&project.completedAt===null&&project.canceledAt===undefined)project.canceledAt=now;}
  shared.alliances=shared.alliances.filter(a=>a.members.length>0);
  shared.support=shared.support.filter(s=>s.requesterId!==me||s.acceptedAt!==null);state.allianceId=null;return;
 }
 case 'alliance_settings':{
  const group=current();requireRule(group.founderId===me,'Só o líder pode definir a entrada.');requireRule(['open','approval'].includes(action.admission),'Escolha uma forma de entrada válida.');group.admission=action.admission;return;
 }
 case 'alliance_invite':{
  const group=current();requireRule(group.members.length<ALLIANCE_LIMIT,'Essa aliança chegou a 5 membros.');
  requireRule(typeof action.playerId==='string'&&known(action.playerId)&&!shared.alliances.some(a=>a.members.includes(action.playerId)),'Convide um jogador deste mundo que esteja sem aliança.');
  requireRule(!group.invitations?.includes(action.playerId),'Esse jogador já recebeu um convite.');(group.invitations??=[]).push(action.playerId);return;
 }
 case 'alliance_request':{
  requireRule(state.allianceId===null,'Você já pertence a uma aliança.');const group=shared.alliances.find(a=>a.id===action.allianceId);requireRule(group,'Aliança não encontrada.');
  requireRule(group.members.length<ALLIANCE_LIMIT,'Essa aliança chegou a 5 membros.');requireRule(group.admission==='approval','Esta aliança aceita entrada livre.');
  requireRule(!group.requests?.includes(me)&&!group.invitations?.includes(me),'Sua entrada já está pendente.');(group.requests??=[]).push(me);return;
 }
 case 'alliance_respond':{
  const group=current();requireRule(group.founderId===me,'Só o líder pode responder aos pedidos.');requireRule(typeof action.accept==='boolean'&&group.requests?.includes(action.playerId),'Pedido de entrada não encontrado.');
  if(action.accept){requireRule(group.members.length<ALLIANCE_LIMIT,'Essa aliança chegou a 5 membros.');requireRule(!shared.alliances.some(a=>a.members.includes(action.playerId)),'Esse jogador já entrou em outra aliança.');if(!group.invitations?.includes(action.playerId))(group.invitations??=[]).push(action.playerId);}
  group.requests=group.requests!.filter(id=>id!==action.playerId);return;
 }
 case 'alliance_decline':{
  const group=shared.alliances.find(a=>a.id===action.allianceId);requireRule(group?.invitations?.includes(me)||group?.requests?.includes(me),'Nenhum convite ou pedido pendente.');group.invitations=group.invitations?.filter(id=>id!==me);group.requests=group.requests?.filter(id=>id!==me);return;
 }
 case 'alliance_project_start':{
  const group=current();requireRule(group.founderId===me,'Só o líder pode escolher o projeto.');requireRule(Object.hasOwn(ALLIANCE_PROJECTS,action.kind),'Projeto inválido.');
  requireRule(!(shared.allianceProjects??[]).some(p=>p.allianceId===group.id&&p.completedAt===null&&p.canceledAt===undefined),'Conclua o projeto atual antes de iniciar outro.');
  requireRule(!(shared.allianceProjects??[]).some(p=>p.allianceId===group.id&&p.kind===action.kind&&(p.until??0)>now),'Este bônus já está ativo.');
  (shared.allianceProjects??=[]).push({id:nextId('alliance-project'),allianceId:group.id,kind:action.kind,createdAt:now,contributions:{},completedAt:null,until:null});return;
 }
 case 'alliance_project_contribute':{
  const group=current(),project=shared.allianceProjects?.find(p=>p.id===action.projectId&&p.allianceId===group.id);
  requireRule(project&&project.completedAt===null&&project.canceledAt===undefined,'Este projeto já foi concluído ou encerrado.');
  requireRule(['gold','materials','supplies'].includes(action.resource)&&[50,100,'max'].includes(action.amount),'Escolha uma contribuição válida.');
  const cost=ALLIANCE_PROJECTS[project.kind].cost,resource=action.resource,remaining=cost[resource]-projectTotals(project)[resource];
  const amount=Math.min(remaining,action.amount==='max'?Math.floor(state.resources[resource]):action.amount);
  requireRule(amount>0&&Number.isFinite(amount)&&state.resources[resource]>=amount,'Recursos insuficientes ou meta desse recurso já atendida.');
  state.resources[resource]-=amount;const mine=(project.contributions[me]??={});mine[resource]=(mine[resource]??0)+amount;
  const totals=projectTotals(project);if((['gold','materials','supplies'] as const).every(r=>totals[r]>=cost[r])){project.completedAt=now;project.until=now+ALLIANCE_PROJECTS[project.kind].days*dayMs;}return;
 }
 default:throw new AllianceRuleError('Ação de aliança desconhecida.');
 }
}
