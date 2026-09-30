import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'supabase/functions.snapshot.json'),'utf8'));
const config=fs.readFileSync(path.join(root,'supabase/config.toml'),'utf8');
for(const fn of snapshot.functions){
 const source=fs.readFileSync(path.join(root,fn.entrypoint),'utf8');
 assert.equal(crypto.createHash('sha256').update(source).digest('hex'),fn.source_sha256,fn.slug+' source drift');
 const heading='[functions.'+fn.slug+']';
 assert(config.includes(heading),fn.slug+' missing config');
 const section=config.split(heading)[1].split('[functions.')[0];
 assert(section.includes('verify_jwt = '+fn.verify_jwt),fn.slug+' JWT drift');
}
console.log('Recovery snapshot: '+snapshot.functions.length+' source hashes and JWT configurations PASS');
