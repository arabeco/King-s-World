export const PLAY_GEM_PRODUCTS:Record<string,number>={gems_50:50,gems_100:100,gems_250:250,gems_500:500};
/** Only one unit per checkout is supported; never trust the client's amount. */
export function parsePlayGemPurchase(payload:unknown,productId:string){
 const data=payload as Record<string,unknown>;
 if(!data||typeof data!=='object'||!Object.hasOwn(PLAY_GEM_PRODUCTS,productId))throw Error('INVALID_GEM_PRODUCT');
 if(data.productId!==undefined&&data.productId!==productId)throw Error('PRODUCT_MISMATCH');
 if(data.quantity!==undefined&&data.quantity!==1)throw Error('INVALID_PURCHASE_QUANTITY');
 if(data.purchaseState===2)throw Error('PURCHASE_PENDING');
 if(data.purchaseState!==0)throw Error('PURCHASE_NOT_COMPLETED');
 if(data.consumptionState!==0&&data.consumptionState!==1)throw Error('INVALID_CONSUMPTION_STATE');
 if(data.purchaseType!==undefined&&data.purchaseType!==0)throw Error('UNSUPPORTED_PURCHASE_TYPE');
 if(data.orderId!==undefined&&(typeof data.orderId!=='string'||!data.orderId.trim()||data.orderId.length>512))throw Error('INVALID_ORDER_ID');
 return {productId,accountId:typeof data.obfuscatedExternalAccountId==='string'?data.obfuscatedExternalAccountId:null,
  orderId:typeof data.orderId==='string'?data.orderId:null,consumed:data.consumptionState===1,storeEnvironment:data.purchaseType===0?'sandbox':'production'};
}
