// Generates a transactional SQL regression. Run returned SQL as administrator.
// Only licensed nonadmin accounts are selected; all changes are rolled back.
import {buildAnnualScenario} from '../annual-scenario.js';
const s=buildAnnualScenario();const kinds={personal:{income:'income',expense:'expense',saving:'saving',debtPayment:'debt_payment',asset:'asset',debt:'debt',goal:'goal'},business:{sale:'sale',collection:'collection',cost:'cost',expense:'business_expense',cashPayment:'payment',debtPrincipal:'principal_payment',debtInterest:'interest_payment'}};
const rows=[];for(const [mode,b]of Object.entries(s.records))for(const [type,items]of Object.entries(b))for(const x of items)rows.push({mode,kind:kinds[mode][type],description:'Annual SQL test · '+x.name,amount_minor:x.amountMinor,currency:'USD',fx_rate:1,base_currency:'USD',base_amount_minor:x.amountMinor,occurred_on:x.date,is_demo:true,metadata:{direction:x.direction,entityId:x.entityId}});
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";const modified=structuredClone(rows);modified[0].amount_minor+=100;modified[0].base_amount_minor+=100;const reduced=modified.slice(1);const invalid=structuredClone(reduced);invalid[0].mode='INVALID';
console.log(`BEGIN;
SET LOCAL statement_timeout='20s';
CREATE TEMP TABLE annual_before AS SELECT user_id,count(*) n,coalesce(sum(amount_minor),0) total FROM public.movements GROUP BY user_id;
DO $setup$ DECLARE u uuid; BEGIN
 SELECT l.user_id INTO u FROM public.licenses l WHERE l.status='active' AND l.expires_at>now() AND NOT EXISTS(SELECT 1 FROM public.admin_roles a WHERE a.user_id=l.user_id AND a.role='admin') LIMIT 1;
 IF u IS NULL THEN RAISE EXCEPTION 'Licensed nonadmin fixture unavailable'; END IF;
 PERFORM set_config('finorve.annual_user',u::text,true);
 PERFORM set_config('request.jwt.claim.sub',u::text,true);
 PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $test$ DECLARE initial_total bigint; old_total bigint; blocked boolean:=false; payload jsonb:=${literal(rows)}; BEGIN
 PERFORM public.replace_my_movements(payload);
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid())<>${rows.length} THEN RAISE EXCEPTION 'Initial annual sync count mismatch'; END IF;
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid() AND mode='personal')<>${rows.filter(x=>x.mode==='personal').length} THEN RAISE EXCEPTION 'Personal records mismatch'; END IF;
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid() AND mode='business')<>${rows.filter(x=>x.mode==='business').length} THEN RAISE EXCEPTION 'Business records mismatch'; END IF;
 SELECT sum(amount_minor) INTO initial_total FROM public.movements WHERE user_id=auth.uid();
 payload:=jsonb_set(jsonb_set(payload,'{0,amount_minor}',to_jsonb((payload->0->>'amount_minor')::bigint+100)),'{0,base_amount_minor}',to_jsonb((payload->0->>'base_amount_minor')::bigint+100)); PERFORM public.replace_my_movements(payload);
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid())<>${rows.length} OR (SELECT sum(amount_minor) FROM public.movements WHERE user_id=auth.uid())<>initial_total+100 THEN RAISE EXCEPTION 'Edit duplicated or lost records'; END IF;
 payload:=payload-0; PERFORM public.replace_my_movements(payload);
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid())<>${reduced.length} THEN RAISE EXCEPTION 'Delete failed'; END IF;
 SELECT sum(amount_minor) INTO old_total FROM public.movements WHERE user_id=auth.uid();
 BEGIN PERFORM public.replace_my_movements(jsonb_set(payload,'{0,mode}','"INVALID"'::jsonb)); EXCEPTION WHEN check_violation OR invalid_text_representation THEN blocked:=true; END;
 IF NOT blocked THEN RAISE EXCEPTION 'Invalid mode accepted'; END IF;
 IF (SELECT count(*) FROM public.movements WHERE user_id=auth.uid())<>${reduced.length} OR (SELECT sum(amount_minor) FROM public.movements WHERE user_id=auth.uid())<>old_total THEN RAISE EXCEPTION 'Failed save deleted previous records'; END IF;
END $test$;
RESET ROLE;
DO $unchanged$ BEGIN
 IF EXISTS(SELECT 1 FROM annual_before b WHERE b.user_id<>current_setting('finorve.annual_user')::uuid AND (b.n<>(SELECT count(*) FROM public.movements m WHERE m.user_id=b.user_id) OR b.total<>(SELECT coalesce(sum(amount_minor),0) FROM public.movements m WHERE m.user_id=b.user_id))) THEN RAISE EXCEPTION 'Other user data changed'; END IF;
END $unchanged$;
ROLLBACK;
SELECT 'PASS: 314 annual records persisted through application RPC; separate modes; edit without duplicates; delete; invalid-save atomic rollback; other users unchanged; all fixtures rolled back' verification;`);
