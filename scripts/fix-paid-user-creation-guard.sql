-- Applied to Supabase on 2026-09-30.
-- Auth admin createUser inserts first, then writes app_metadata in the same transaction.
-- Validate the final row at commit; require trusted metadata and captured payment.
begin;
create or replace function private.enforce_paid_user_creation()
returns trigger language plpgsql security definer set search_path='' as $function$
declare v_email text; v_paid boolean;
begin
  select email,coalesce(raw_app_meta_data->>'paid_checkout','false')='true'
    into v_email,v_paid from auth.users where id=new.id;
  if not found then return new; end if;
  if v_paid is not true or not exists(
    select 1 from public.checkout_intents
    where lower(email)=lower(v_email) and status='completed'
      and provider_capture_id is not null and claim_expires_at>now()
  ) then raise exception 'PAID_CHECKOUT_REQUIRED'; end if;
  return new;
end $function$;
drop trigger enforce_paid_user_creation on auth.users;
create constraint trigger enforce_paid_user_creation
after insert on auth.users deferrable initially deferred
for each row execute function private.enforce_paid_user_creation();
commit;
