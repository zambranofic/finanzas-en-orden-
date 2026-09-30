begin;
alter table public.licenses add column if not exists annual_price_minor bigint check (annual_price_minor > 0);
alter table public.licenses add column if not exists annual_currency text check (annual_currency ~ '^[A-Z]{3}$');
update public.licenses l set annual_price_minor=coalesce((select p.amount_minor from public.payments p where p.user_id=l.user_id and p.status='completed' order by p.created_at desc limit 1),2900), annual_currency='USD' where l.annual_price_minor is null and l.activated_at is not null;
create or replace function private.snapshot_membership_price() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.activated_at is not null and new.annual_price_minor is null then
   select p.amount_minor,p.currency into new.annual_price_minor,new.annual_currency from public.payments p where p.user_id=new.user_id and p.status='completed' order by p.created_at desc limit 1;
   if new.annual_price_minor is null then select o.amount_minor,o.currency into new.annual_price_minor,new.annual_currency from public.offers o where o.code='feo_v1'; end if;
 end if;
 return new;
end $$;
revoke all on function private.snapshot_membership_price() from public,anon,authenticated;
drop trigger if exists snapshot_membership_price on public.licenses;
create trigger snapshot_membership_price before insert or update on public.licenses for each row execute function private.snapshot_membership_price();
alter table public.payments drop constraint payments_provider_check;
alter table public.payments add constraint payments_provider_check check(provider in ('paypal','payphone'));
create table if not exists public.membership_checkouts (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
 mode text not null check(mode in ('test','live')), store_id uuid not null,
 amount_minor bigint not null check(amount_minor>0), annual_price_minor bigint not null check(annual_price_minor>0), currency text not null check(currency='USD'),
 offer_code text not null references public.offers(code), secret_hash text not null,
 status text not null default 'created' check(status in ('created','confirming','confirmed','approved','cancelled','failed','uncertain')),
 transaction_id bigint unique, created_at timestamptz not null default now(), expires_at timestamptz not null default(now()+interval '30 minutes'),
 applied_expires_at timestamptz, updated_at timestamptz not null default now()
);
alter table public.membership_checkouts enable row level security;
revoke all on public.membership_checkouts from public,anon,authenticated;
grant select,insert,update on public.membership_checkouts to service_role;
create index if not exists membership_checkouts_user_idx on public.membership_checkouts(user_id,created_at desc);
create or replace function public.apply_membership_checkout_internal(p_checkout_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c public.membership_checkouts%rowtype; l public.licenses%rowtype; expiry timestamptz;
begin
 select * into c from public.membership_checkouts where id=p_checkout_id for update;
 if not found or c.mode<>'live' then raise exception 'LIVE_CONFIRMED_PAYMENT_REQUIRED'; end if;
 if c.status='approved' then return jsonb_build_object('expires_at',c.applied_expires_at,'recovered',true); end if;
 if c.status<>'confirmed' or c.transaction_id is null or c.amount_minor<>c.annual_price_minor then raise exception 'LIVE_CONFIRMED_PAYMENT_REQUIRED'; end if;
 -- Serialize different purchases for the same member, as well as duplicate confirmation requests.
 perform pg_advisory_xact_lock(hashtextextended(c.user_id::text,0));
 select * into l from public.licenses where user_id=c.user_id for update;
 if l.status in ('revoked','refunded') then raise exception 'MEMBERSHIP_REQUIRES_REVIEW'; end if;
 expiry=(greatest(now(),case when l.status='active' then l.expires_at else null end) at time zone 'America/Guayaquil' + interval '1 year') at time zone 'America/Guayaquil';
 insert into public.payments(user_id,provider,provider_order_id,provider_capture_id,status,amount_minor,currency,offer_code,raw)
 values(c.user_id,'payphone','payphone:'||c.id,'payphone:'||c.transaction_id,'completed',c.amount_minor,c.currency,c.offer_code,jsonb_build_object('mode','live','checkout_id',c.id));
 insert into public.licenses(user_id,status,product_code,access_type,activated_at,expires_at,annual_price_minor,annual_currency,revoked_at,updated_at)
 values(c.user_id,'active','finanzas_en_orden','one_time',now(),expiry,c.annual_price_minor,c.currency,null,now())
 on conflict(user_id) do update set status='active',expires_at=excluded.expires_at,annual_price_minor=excluded.annual_price_minor,annual_currency=excluded.annual_currency,revoked_at=null,activated_at=coalesce(public.licenses.activated_at,excluded.activated_at),updated_at=now();
 update public.membership_checkouts set status='approved',applied_expires_at=expiry,updated_at=now() where id=c.id;
 return jsonb_build_object('expires_at',expiry,'recovered',false);
end $$;
revoke all on function public.apply_membership_checkout_internal(uuid) from public,anon,authenticated;
grant execute on function public.apply_membership_checkout_internal(uuid) to service_role;
create table if not exists public.membership_reminders (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 expires_at timestamptz not null, threshold_days integer not null check(threshold_days in (30,15,7,0)),
 status text not null default 'queued' check(status in ('queued','sending','sent','failed','uncertain','obsolete')),
 provider_id text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,expires_at,threshold_days)
);
alter table public.membership_reminders enable row level security;
revoke all on public.membership_reminders from public,anon,authenticated;
grant select,insert,update on public.membership_reminders to service_role;
create index if not exists membership_reminders_queue_idx on public.membership_reminders(status,created_at);
create or replace function private.queue_membership_reminders() returns void language sql security invoker set search_path='' as $$
 insert into public.membership_reminders(user_id,expires_at,threshold_days)
 select l.user_id,l.expires_at,t.days from public.licenses l cross join (values(30),(15),(7),(0)) as t(days)
 where l.status='active' and l.expires_at is not null and
 (l.expires_at at time zone 'America/Guayaquil')::date-(now() at time zone 'America/Guayaquil')::date=t.days
 on conflict(user_id,expires_at,threshold_days) do nothing;
 update public.membership_reminders r set status='obsolete',updated_at=now() where r.status='queued' and not exists(select 1 from public.licenses l where l.user_id=r.user_id and l.status='active' and l.expires_at=r.expires_at);
$$;
revoke all on function private.queue_membership_reminders() from public,anon,authenticated;
grant execute on function private.queue_membership_reminders() to service_role;
create or replace function public.claim_membership_reminders_internal() returns table(id uuid,email text,expires_at timestamptz,threshold_days integer)
language sql security invoker set search_path='' as $$
 with picked as (select r.id from public.membership_reminders r join public.licenses l on l.user_id=r.user_id and l.expires_at=r.expires_at and l.status='active'
 where r.status='queued' and r.created_at>now()-interval '2 days' order by r.created_at limit 20 for update of r skip locked),
 claimed as (update public.membership_reminders r set status='sending',updated_at=now() from picked where r.id=picked.id returning r.*)
 select c.id,u.email,c.expires_at,c.threshold_days from claimed c join auth.users u on u.id=c.user_id where u.email is not null;
$$;
revoke all on function public.claim_membership_reminders_internal() from public,anon,authenticated;
grant execute on function public.claim_membership_reminders_internal() to service_role;
select cron.schedule('finorve-membership-reminders','0 14 * * *','select private.queue_membership_reminders();');
select cron.schedule('finorve-membership-email-delivery','5 14 * * *', $cron$
 select net.http_post(url:='https://euqhrqsatbhnxgohbild.supabase.co/functions/v1/membership-email-reminders',headers:=jsonb_build_object('Content-Type','application/json','apikey','sb_publishable_Ltn-8m11gMlS2AY14k8nfA_hcJ3Izjl'),body:='{}'::jsonb,timeout_milliseconds:=5000);
$cron$);
commit;
