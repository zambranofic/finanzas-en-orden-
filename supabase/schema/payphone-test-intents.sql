-- Isolated integration rehearsal: these rows can never be claimed as paid access.
create table if not exists public.payphone_test_intents (
  id uuid primary key default gen_random_uuid(),
  mode text not null default 'test' check (mode = 'test'),
  store_id uuid not null,
  amount_minor integer not null check (amount_minor = 100),
  currency text not null default 'USD' check (currency = 'USD'),
  secret_hash text not null,
  status text not null default 'created' check (status in ('created','confirming','approved','cancelled','failed','uncertain')),
  provider_transaction_id bigint unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 minutes'),
  updated_at timestamptz not null default now()
);
alter table public.payphone_test_intents enable row level security;
revoke all on public.payphone_test_intents from public, anon, authenticated;
grant select, insert, update on public.payphone_test_intents to service_role;
comment on table public.payphone_test_intents is 'Payphone integration tests only. No payment, license, claim token or account is created from these rows.';
