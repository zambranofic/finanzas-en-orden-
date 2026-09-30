export function renewalReturnDestination(search){
 const value=new URLSearchParams(search).get('returnTo');
 return value==='/renovar.html'?value:null;
}
