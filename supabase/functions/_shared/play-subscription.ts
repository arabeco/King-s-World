type PlayLine={productId?:string;expiryTime?:string;autoRenewingPlan?:{autoRenewEnabled?:boolean};latestSuccessfulOrderId?:string};
type PlaySubscription={subscriptionState?:string;lineItems?:PlayLine[];startTime?:string;testPurchase?:unknown;acknowledgementState?:string;externalAccountIdentifiers?:{obfuscatedExternalAccountId?:string}};
const states:Record<string,string>={SUBSCRIPTION_STATE_ACTIVE:'active',SUBSCRIPTION_STATE_IN_GRACE_PERIOD:'grace_period',SUBSCRIPTION_STATE_CANCELED:'canceled',SUBSCRIPTION_STATE_ON_HOLD:'on_hold',SUBSCRIPTION_STATE_PAUSED:'paused',SUBSCRIPTION_STATE_EXPIRED:'expired',SUBSCRIPTION_STATE_PENDING:'pending',SUBSCRIPTION_STATE_PENDING_PURCHASE_CANCELED:'expired'};
/** Only exact verified products grant access; missing/malformed expiry never grants indefinite Premium. */
export function parsePlaySubscription(payload:unknown,productId:string,at=Date.now()){
 if(!payload||typeof payload!=='object')throw Error('INVALID_PLAY_RESPONSE');
 const data=payload as PlaySubscription,status=states[data.subscriptionState??''];
 if(!status)throw Error('UNKNOWN_SUBSCRIPTION_STATE');
 const line=Array.isArray(data.lineItems)?data.lineItems.filter(item=>item.productId===productId).sort((a,b)=>Date.parse(b.expiryTime??'')-Date.parse(a.expiryTime??''))[0]:undefined;
 if(!line)throw Error('PRODUCT_MISMATCH');
 const expiresAt=typeof line.expiryTime==='string'&&Number.isFinite(Date.parse(line.expiryTime))?line.expiryTime:null;
 if(['active','grace_period','canceled'].includes(status)&&!expiresAt)throw Error('INVALID_PLAY_EXPIRY');
 const active=['active','grace_period','canceled'].includes(status)&&expiresAt!==null&&Date.parse(expiresAt)>at;
 return {productId,status,active,expiresAt,startedAt:data.startTime??null,autoRenewing:line.autoRenewingPlan?.autoRenewEnabled===true,willRenew:line.autoRenewingPlan?.autoRenewEnabled===true,
  storeEnvironment:data.testPurchase?'sandbox':'production',orderId:line.latestSuccessfulOrderId??null,
  accountId:data.externalAccountIdentifiers?.obfuscatedExternalAccountId??null,
  shouldAcknowledge:active&&data.acknowledgementState==='ACKNOWLEDGEMENT_STATE_PENDING'};
}
export async function playAccountId(authUserId:string){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode('kingsworld:'+authUserId));
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
