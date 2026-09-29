export async function commitProfile(current,patch,save){
  const next={...current,...patch};
  await save(next);
  return next;
}
