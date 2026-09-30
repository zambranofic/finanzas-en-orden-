-- Applied 2026-09-30. The public wrapper is SECURITY INVOKER.
-- Its service_role caller needs EXECUTE on the private implementation too.
-- Do not grant this function to anon or authenticated.
grant execute on function private.claim_paid_checkout(text,uuid,text) to service_role;

DO $check$
BEGIN
 IF NOT has_function_privilege('service_role','private.claim_paid_checkout(text,uuid,text)','EXECUTE')
 OR has_function_privilege('anon','private.claim_paid_checkout(text,uuid,text)','EXECUTE')
 OR has_function_privilege('authenticated','private.claim_paid_checkout(text,uuid,text)','EXECUTE')
 THEN RAISE EXCEPTION 'PAID_CLAIM_PERMISSIONS_INVALID'; END IF;
END $check$;
