export function checkoutCancelPayload(checkoutId,cancelToken='',legacySecret=''){
  const checkout_id=String(checkoutId||'');
  if(!checkout_id)throw new Error('MISSING_CHECKOUT_ID');
  if(cancelToken)return {checkout_id,cancel_token:String(cancelToken)};
  if(legacySecret)return {checkout_id,checkout_secret:String(legacySecret)};
  throw new Error('MISSING_CANCEL_TOKEN');
}
