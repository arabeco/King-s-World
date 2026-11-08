import type { CozyPayload } from "@/lib/cozy/types";
import type { CozyCommand } from "./useCozyWorld";

/** Called only for a command whose server receipt was returned successfully. */
export function commandFeedback(
  action: CozyCommand,
  data: CozyPayload,
): string {
  switch (action.type) {
    case "attack_player":return "Investida enviada. O confronto será resolvido na chegada.";
    case "capital_choose":return `${data.state.cities.find(city=>city.id===action.cityId)?.name??'A cidade'} foi confirmada como capital.`;
    case "city_class":return "Especialização da cidade confirmada.";
    case "plan_upgrade":return "Fila de obras confirmada. Custos reservados e início automático.";
    case "plan_research":return "Fila de pesquisas confirmada. Custos reservados e início automático.";
    case "cancel_plan":return "Plano cancelado. Reservas das etapas não iniciadas foram devolvidas.";
    case "recruit":
      return "Recrutamento concluído. Suas tropas estão prontas.";
    case "upgrade":
      return `Obra iniciada em ${data.state.cities.find((city) => city.id === action.cityId)?.name || "sua cidade"}.`;
    case "research":
      return "Pesquisa iniciada. Acompanhe a conclusão em Governo.";
    case "hire":
      return "Um novo herói se juntou ao reino.";
    case "assign":
      return action.cityId
        ? "Herói designado para a cidade."
        : "Herói disponível na reserva.";
    case "rename_city":
      return `A cidade agora se chama ${action.name}.`;
    case "counselor":
      return "Conselheiro escolhido. Sua cadeira está pronta.";
    case "decree":
      return "Decisão assinada. O resultado está nos relatos.";
    case "sanctuary_pact_defend":return "Apoio à torre confirmado. A defesa será resolvida na chegada da horda, sem deslocar tropas.";
    case "sanctuary_pact_challenge":return "Exército enviado aos guardiões. O resultado será calculado na chegada.";
    case "sanctuary_pact_start":return "Pacto iniciado. Os recursos entram como reserva até completar a meta.";
    case "sanctuary_pact_contribute":return "Contribuição da torre confirmada. Confira as metas e o estado da sintonia.";
    case "sanctuary_pact_cancel":return "Pacto cancelado. As reservas serão devolvidas aos contribuintes uma única vez.";
    case "sanctuary_explore":return "Expedição enviada à torre. O reconhecimento será registrado na chegada.";
    case "explore":
      return "Exploração enviada. A descoberta chegará nos relatos.";
    case "found_city":return "Expedição de fundação enviada. A cidade será criada na chegada.";
    case "attack":
    case "annex":
      return "Ordem enviada. Acompanhe a chegada nas ordens do reino.";
    case "collect":
      return "Coleta enviada. Os recursos chegam com a expedição.";
    case "wonder":
      return "Maravilha construída. Um novo marco para o reino.";
    case "quest":
      return "Conquista recebida. Seu legado cresceu.";
    case "king_choose":
      return "Reinado iniciado com o rei preparado na sua coleção.";
    case "city_decision":
      return "Decisão aplicada nesta cidade. Confira seus indicadores.";
    case "area_annex":
      return "Área anexada. O território permanece após o esgotamento.";
    case "portal":
      return "Selo de Vitória registrado. Seu reino alcançou 1.500 de influência.";
    case "alliance_create":
      return "Aliança criada. Seu reino tem um novo ponto de encontro.";
    case "alliance_join":
      return "Você entrou na aliança.";
    case "alliance_invite":return "Convite enviado. O jogador decide se quer entrar.";
    case "alliance_request":return "Pedido enviado ao líder da aliança.";
    case "alliance_respond":return action.accept?"Entrada aprovada. O jogador já pode aceitar o convite.":"Pedido recusado.";
    case "alliance_decline":return "Convite ou pedido retirado.";
    case "alliance_settings":return "Forma de entrada atualizada.";
    case "alliance_project_start":return "Projeto iniciado. Os aliados já podem contribuir.";
    case "alliance_project_contribute":return data.shared.allianceProjects?.find(p=>p.id===action.projectId)?.completedAt!=null?"Projeto concluído! O bônus coletivo está ativo e sua participação foi registrada.":"Contribuição registrada. Recursos reservados para este projeto.";
    case "alliance_leave":
      return "Você saiu da aliança.";
    case "support_request":
      return "Pedido de apoio enviado aos aliados.";
    case "support_send":
      return "Apoio enviado. Seu aliado conta com você.";
    case "read_reports":
      return "Relatos marcados como lidos.";
    case "start_world":
      return "Os portões se abriram. Sua temporada começou!";
  }
  const unhandled:never=action;
  return unhandled;
}
