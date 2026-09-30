-- Run as the database administrator. Every fixture/change is rolled back.
-- Requires two existing licensed accounts without administrator privileges.
-- No email addresses, passwords, tokens or real financial values are returned.
BEGIN;
SET LOCAL statement_timeout = '15s';
DO $setup$
DECLARE users uuid[];
BEGIN
  SELECT array_agg(user_id ORDER BY user_id) INTO users FROM (
    SELECT l.user_id FROM public.licenses l
    WHERE l.status='active' AND l.expires_at > now()
      AND NOT EXISTS (SELECT 1 FROM public.admin_roles a WHERE a.user_id=l.user_id AND a.role='admin')
    ORDER BY l.user_id LIMIT 2
  ) s;
  IF cardinality(users) IS DISTINCT FROM 2 THEN RAISE EXCEPTION 'Two licensed nonadmin accounts required'; END IF;
  PERFORM set_config('finorve.test_user_a',users[1]::text,true);
  PERFORM set_config('finorve.test_user_b',users[2]::text,true);
  IF EXISTS (SELECT 1 FROM public.movements WHERE id IN (
    'fabc23ca-3514-4ca2-9022-1101eae05b40','fabc23ca-3514-4ca2-9022-1101eae05b41',
    'fabc23ca-3514-4ca2-9022-1101eae05b42','fabc23ca-3514-4ca2-9022-1101eae05b43',
    'fabc23ca-3514-4ca2-9022-1101eae05b44')) THEN RAISE EXCEPTION 'Fixture IDs already exist'; END IF;
  INSERT INTO public.movements(id,user_id,mode,kind,description,amount_minor,currency,base_currency,base_amount_minor,occurred_on)
  VALUES
    ('fabc23ca-3514-4ca2-9022-1101eae05b40',users[1],'personal','income','Isolation test A personal',100,'USD','USD',100,current_date),
    ('fabc23ca-3514-4ca2-9022-1101eae05b41',users[1],'business','sale','Isolation test A business',100,'USD','USD',100,current_date),
    ('fabc23ca-3514-4ca2-9022-1101eae05b42',users[2],'personal','income','Isolation test B personal',100,'USD','USD',100,current_date),
    ('fabc23ca-3514-4ca2-9022-1101eae05b43',users[2],'business','sale','Isolation test B business',100,'USD','USD',100,current_date);
  PERFORM set_config('request.jwt.claim.sub',users[1]::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',users[1],'role','authenticated')::text,true);
END $setup$;
SET LOCAL ROLE authenticated;
DO $test_a$
DECLARE n integer; blocked boolean;
BEGIN
  IF (SELECT count(*) FROM public.movements WHERE id IN ('fabc23ca-3514-4ca2-9022-1101eae05b40','fabc23ca-3514-4ca2-9022-1101eae05b41')) <> 2 THEN RAISE EXCEPTION 'Own movement read failed'; END IF;
  IF (SELECT count(*) FROM public.movements WHERE id IN ('fabc23ca-3514-4ca2-9022-1101eae05b40','fabc23ca-3514-4ca2-9022-1101eae05b41') AND mode='personal') <> 1 THEN RAISE EXCEPTION 'Personal filter failed'; END IF;
  IF (SELECT count(*) FROM public.movements WHERE id IN ('fabc23ca-3514-4ca2-9022-1101eae05b40','fabc23ca-3514-4ca2-9022-1101eae05b41') AND mode='business') <> 1 THEN RAISE EXCEPTION 'Business filter failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.movements WHERE user_id=current_setting('finorve.test_user_b')::uuid) THEN RAISE EXCEPTION 'Other user movements visible'; END IF;
  UPDATE public.movements SET amount_minor=200 WHERE id='fabc23ca-3514-4ca2-9022-1101eae05b42';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Other user update allowed'; END IF;
  DELETE FROM public.movements WHERE id='fabc23ca-3514-4ca2-9022-1101eae05b43';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Other user delete allowed'; END IF;
  blocked:=false;
  BEGIN
    INSERT INTO public.movements(id,user_id,mode,kind,description,amount_minor,currency,base_currency,base_amount_minor,occurred_on)
    VALUES ('fabc23ca-3514-4ca2-9022-1101eae05b44',current_setting('finorve.test_user_b')::uuid,'personal','income','Denied foreign insert',100,'USD','USD',100,current_date);
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Other user insert allowed'; END IF;
  blocked:=false;
  BEGIN
    UPDATE public.movements SET user_id=current_setting('finorve.test_user_b')::uuid WHERE id='fabc23ca-3514-4ca2-9022-1101eae05b40';
  EXCEPTION WHEN insufficient_privilege THEN blocked:=true; END;
  IF NOT blocked THEN RAISE EXCEPTION 'Ownership reassignment allowed'; END IF;
  INSERT INTO public.movements(id,user_id,mode,kind,description,amount_minor,currency,base_currency,base_amount_minor,occurred_on)
  VALUES ('fabc23ca-3514-4ca2-9022-1101eae05b44',auth.uid(),'personal','income','Allowed own insert',100,'USD','USD',100,current_date);
  UPDATE public.movements SET amount_minor=200 WHERE id='fabc23ca-3514-4ca2-9022-1101eae05b44';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Own update failed'; END IF;
  DELETE FROM public.movements WHERE id='fabc23ca-3514-4ca2-9022-1101eae05b44';
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>1 THEN RAISE EXCEPTION 'Own delete failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id=current_setting('finorve.test_user_b')::uuid) THEN RAISE EXCEPTION 'Other profile visible'; END IF;
  UPDATE public.profiles SET full_name=full_name WHERE user_id=current_setting('finorve.test_user_b')::uuid;
  GET DIAGNOSTICS n=ROW_COUNT; IF n<>0 THEN RAISE EXCEPTION 'Other profile editable'; END IF;
  IF EXISTS (SELECT 1 FROM public.licenses WHERE user_id=current_setting('finorve.test_user_b')::uuid) THEN RAISE EXCEPTION 'Other license visible'; END IF;
  IF EXISTS (SELECT 1 FROM public.payments WHERE user_id=current_setting('finorve.test_user_b')::uuid) THEN RAISE EXCEPTION 'Other payments visible'; END IF;
END $test_a$;
RESET ROLE;
DO $identity_b$
BEGIN
  PERFORM set_config('request.jwt.claim.sub',current_setting('finorve.test_user_b'),true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('finorve.test_user_b'),'role','authenticated')::text,true);
END $identity_b$;
SET LOCAL ROLE authenticated;
DO $test_b$
BEGIN
  IF (SELECT count(*) FROM public.movements WHERE id IN ('fabc23ca-3514-4ca2-9022-1101eae05b42','fabc23ca-3514-4ca2-9022-1101eae05b43')) <> 2 THEN RAISE EXCEPTION 'Second user own read failed'; END IF;
  IF EXISTS (SELECT 1 FROM public.movements WHERE user_id=current_setting('finorve.test_user_a')::uuid) THEN RAISE EXCEPTION 'First user data visible to second'; END IF;
END $test_b$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{"role":"anon"}',true);
SET LOCAL ROLE anon;
DO $test_anon$
DECLARE n integer;
BEGIN
  BEGIN
    SELECT count(*) INTO n FROM public.movements;
    IF n<>0 THEN RAISE EXCEPTION 'Anonymous movement access allowed'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $test_anon$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: two-user movement isolation, own CRUD, ownership protection, profile/license/payment reads, mode filters, anonymous denial; all changes rolled back' AS verification;
