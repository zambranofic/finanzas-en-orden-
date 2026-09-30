begin;
alter table public.membership_checkouts alter column user_id drop not null;
alter table public.membership_checkouts add column if not exists email text;
alter table public.membership_checkouts add constraint membership_checkout_owner_check check(user_id is not null or email is not null);
create or replace function public.prepare_payphone_claim_internal(p_checkout_id uuid,p_claim_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.membership_checkouts%rowtype; existing public.checkout_intents%rowtype;
begin
 select * into c from public.membership_checkouts where id=p_checkout_id for update;
 if not found or c.mode<>'live' or c.user_id is not null or c.status not in ('confirmed','approved') or c.transaction_id is null or c.amount_minor<>c.annual_price_minor then raise exception 'LIVE_CONFIRMED_GUEST_PAYMENT_REQUIRED';end if;
 select * into existing from public.checkout_intents where id=c.id for update;
 if existing.status='claimed' then return jsonb_build_object('claimed',true);end if;
 if existing.status in ('refunded','reversed') then raise exception 'PAYMENT_REQUIRES_REVIEW';end if;
 insert into public.checkout_intents(id,email,provider,provider_order_id,provider_capture_id,status,amount_minor,currency,offer_code,checkout_secret_hash,claim_token_hash,claim_expires_at,raw)
 values(c.id,c.email,'payphone','payphone:'||c.id,'payphone:'||c.transaction_id,'completed',c.amount_minor,c.currency,c.offer_code,c.secret_hash,p_claim_hash,now()+interval '24 hours',jsonb_build_object('mode','live'))
 on conflict(id) do update set claim_token_hash=excluded.claim_token_hash,claim_expires_at=excluded.claim_expires_at,updated_at=now();
 update public.membership_checkouts set status='approved',updated_at=now() where id=c.id;
 return jsonb_build_object('claimed',false,'email',c.email);
end $$;
revoke all on function public.prepare_payphone_claim_internal(uuid,text) from public,anon,authenticated;
grant execute on function public.prepare_payphone_claim_internal(uuid,text) to service_role;
create or replace function private.claim_paid_checkout(p_claim_hash text,p_user_id uuid,p_email text) returns void
language plpgsql security definer set search_path='' as $$
declare v public.checkout_intents%rowtype;l public.licenses%rowtype;expiry timestamptz;
begin
 select * into v from public.checkout_intents where claim_token_hash=p_claim_hash and status in ('completed','claimed') and claim_expires_at>now() for update;
 if not found then raise exception 'invalid_or_expired_claim';end if;
 if lower(v.email)<>lower(p_email) then raise exception 'email_mismatch';end if;
 if v.status='claimed' then if v.claimed_by=p_user_id then return;else raise exception 'claim_already_used';end if;end if;
 if v.provider not in ('paypal','payphone') then raise exception 'invalid_provider';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
 select * into l from public.licenses where user_id=p_user_id for update;
 if l.status in ('revoked','refunded') then raise exception 'MEMBERSHIP_REQUIRES_REVIEW';end if;
 expiry=(greatest(now(),case when l.status='active' then l.expires_at else null end) at time zone 'America/Guayaquil'+interval '1 year') at time zone 'America/Guayaquil';
 insert into public.payments(user_id,provider,provider_order_id,provider_capture_id,status,amount_minor,currency,offer_code,raw)
 values(p_user_id,v.provider,v.provider_order_id,v.provider_capture_id,'completed',v.amount_minor,v.currency,v.offer_code,v.raw)
 on conflict(provider_order_id) do update set user_id=excluded.user_id,provider_capture_id=excluded.provider_capture_id,status='completed',updated_at=now();
 insert into public.licenses(user_id,status,product_code,access_type,activated_at,expires_at,annual_price_minor,annual_currency,revoked_at,updated_at)
 values(p_user_id,'active','finanzas_en_orden','one_time',now(),expiry,v.amount_minor,v.currency,null,now())
 on conflict(user_id) do update set status='active',product_code='finanzas_en_orden',access_type='one_time',activated_at=coalesce(public.licenses.activated_at,excluded.activated_at),expires_at=excluded.expires_at,annual_price_minor=excluded.annual_price_minor,annual_currency=excluded.annual_currency,revoked_at=null,updated_at=now();
 update public.checkout_intents set status='claimed',claimed_by=p_user_id,updated_at=now() where id=v.id;
end $$;
-- Preserve the existing private/service-only claim boundary.
revoke all on function private.claim_paid_checkout(text,uuid,text) from public,anon,authenticated;
grant execute on function private.claim_paid_checkout(text,uuid,text) to service_role;
commit;
