export const PASSWORD_POLICY_MESSAGE='Usa al menos 12 caracteres con mayúscula, minúscula, número y símbolo.';
export function passwordIssues(password){
  const p=String(password||'');
  const issues=[];
  if(p.length<12)issues.push('length');
  if(!/[a-z]/.test(p))issues.push('lowercase');
  if(!/[A-Z]/.test(p))issues.push('uppercase');
  if(!/\d/.test(p))issues.push('number');
  if(!/[^A-Za-z0-9]/.test(p))issues.push('symbol');
  return issues;
}
export function validatePassword(password){
  return passwordIssues(password).length===0;
}
