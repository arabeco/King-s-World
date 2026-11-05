import type {CozyPayload} from './types';
/** Reject delayed revisions; equal revisions must carry an equally recent server timestamp. */
export function newerCozySnapshot(current:CozyPayload|null,next:CozyPayload){
 if(!current)return true;
 if(current.world.id!==next.world.id)return false;
 return next.revision>current.revision||(next.revision===current.revision&&next.serverNow>=current.serverNow);
}
