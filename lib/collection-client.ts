import type {CollectionState} from "./collection";

// A timeout on a write leaves its result uncertain; callers must reconcile or replay its receipt.
export async function collectionRequest<T=CollectionState>(url:string,options:RequestInit={}):Promise<T>{
 const controller=new AbortController();let timedOut=false;
 const abort=()=>controller.abort();
 if(options.signal?.aborted)controller.abort();else options.signal?.addEventListener('abort',abort,{once:true});
 const timeout=window.setTimeout(()=>{timedOut=true;controller.abort();},20_000);
 try{
  const response=await fetch(url,{...options,signal:controller.signal});const result=await response.json();
  if(!response.ok)throw Error(typeof result.error==='string'?result.error:'Não foi possível concluir. Tente novamente.');
  return result;
 }catch(error){if(timedOut)throw Error('A conexão demorou a responder. Tente novamente.');throw error;}
 finally{window.clearTimeout(timeout);options.signal?.removeEventListener('abort',abort);}
}

