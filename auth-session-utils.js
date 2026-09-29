export function shouldRefreshSession(session,nowSeconds=Math.floor(Date.now()/1000),skewSeconds=30){
  return !!session?.refresh_token && Number(session.expires_at||0)<=nowSeconds+skewSeconds;
}
export function createSingleFlight(fn){
  let pending=null;
  return async (...args)=>{
    if(pending)return pending;
    pending=Promise.resolve().then(()=>fn(...args));
    try{return await pending}finally{pending=null}
  };
}
