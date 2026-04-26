alter table public.users
  add column if not exists deletion_requested_at timestamptz,
  add column if not exists deletion_reason text;

alter table public.users enable row level security;

drop policy if exists "users_select_own_profile" on public.users;
create policy "users_select_own_profile"
on public.users
for select
using (auth_user_id = auth.uid());

drop policy if exists "users_update_own_profile" on public.users;
create policy "users_update_own_profile"
on public.users
for update
using (auth_user_id = auth.uid())
with check (auth_user_id = auth.uid());

create table if not exists public.user_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  provider text not null check (provider in ('google_play')),
  product_id text not null,
  purchase_token text not null,
  order_id text,
  status text not null check (status in ('active', 'grace_period', 'on_hold', 'paused', 'expired', 'canceled', 'revoked', 'pending')),
  store_environment text not null default 'production',
  started_at timestamptz,
  expires_at timestamptz,
  auto_renewing boolean not null default false,
  will_renew boolean not null default false,
  last_verified_at timestamptz not null default now(),
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_entitlements_provider_purchase_token_key
  on public.user_entitlements(provider, purchase_token);

create index if not exists user_entitlements_user_id_idx
  on public.user_entitlements(user_id);

create index if not exists user_entitlements_status_idx
  on public.user_entitlements(status);

create or replace function public.touch_user_entitlements_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_user_entitlements_updated_at on public.user_entitlements;
create trigger trg_user_entitlements_updated_at
before update on public.user_entitlements
for each row execute function public.touch_user_entitlements_updated_at();

alter table public.user_entitlements enable row level security;

drop policy if exists "user_entitlements_select_own" on public.user_entitlements;
create policy "user_entitlements_select_own"
on public.user_entitlements
for select
using (
  exists (
    select 1
    from public.users u
    where u.id = user_entitlements.user_id
      and u.auth_user_id = auth.uid()
  )
);
