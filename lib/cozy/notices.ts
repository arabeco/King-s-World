import type {CozyAlliance,CozyComputed,CozyReport,CozyShared,CozyState} from "./types";

export const councilNotice = (id: string) => `council:${id}`;
export const cityNotice = (id: string) => `city:${id}`;
export const reportNotice = (id: string) => `report:${id}`;
export const supportNotice = (id: string) => `support:${id}`;
export const invitationNotice = (alliance: CozyAlliance, playerId: string) =>
  `invite:${alliance.invitationEvents?.[playerId] ?? `${alliance.id}:${playerId}`}`;
export const entryNotice = (alliance: CozyAlliance, playerId: string) =>
  `entry:${alliance.requestEvents?.[playerId] ?? `${alliance.id}:${playerId}`}`;

export function isNewNotice(state: CozyState, id: string) {
  return !state.seenNotices?.includes(id);
}

export function isUnreadReport(state: CozyState, report: CozyReport, persistent?: boolean) {
  return report.at > state.readAt && (!persistent || isNewNotice(state, reportNotice(report.id)));
}

export function unreadAllianceGifts(state: CozyState) {
  return state.reports.filter(report=>report.allianceGift?.direction==="received" && isUnreadReport(state,report,true));
}

export function allianceNoticeIds(state: CozyState, shared: CozyShared, now: number) {
  const alliance = shared.alliances.find(group => group.id === state.allianceId && group.members.includes(state.playerId));
  if (!alliance) return shared.alliances.filter(group => group.invitations?.includes(state.playerId))
    .map(group => invitationNotice(group, state.playerId));
  return [
    ...shared.support.filter(request => request.allianceId === alliance.id && request.arrivesAt > now &&
      request.supporterId === null && request.requesterId !== state.playerId).map(request => supportNotice(request.id)),
    ...(alliance.founderId === state.playerId ? (alliance.requests ?? []).map(id => entryNotice(alliance, id)) : []),
  ];
}

export function activeNoticeIds(state: CozyState, shared: CozyShared, computed: CozyComputed, now: number) {
  return [
    ...(computed.decree ? [councilNotice(computed.decree.id)] : []),
    ...Object.values(computed.cityLife).flatMap(({decision}) => decision ? [cityNotice(decision.id)] : []),
    ...state.reports.filter(report => report.at > state.readAt).map(report => reportNotice(report.id)),
    ...allianceNoticeIds(state, shared, now),
  ];
}
