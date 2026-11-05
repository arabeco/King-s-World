/** Subscription cancellation stops renewal; access remains until verified expiry. */
export function premiumIsActive(status:string,expiresAt:string|null|undefined,at=Date.now()){
 return ['active','grace_period','canceled'].includes(status)&&typeof expiresAt==='string'&&Number.isFinite(Date.parse(expiresAt))&&Date.parse(expiresAt)>at;
}
