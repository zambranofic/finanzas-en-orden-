export function ensureSyncId(snapshot,idFactory){
  if(snapshot?.syncId)return snapshot;
  const makeId=idFactory||(()=>crypto.randomUUID());
  return {...snapshot,syncId:makeId()};
}
export function samePendingSnapshot(pending,snapshot){
  return !!pending?.syncId&&!!snapshot?.syncId&&pending.syncId===snapshot.syncId;
}
