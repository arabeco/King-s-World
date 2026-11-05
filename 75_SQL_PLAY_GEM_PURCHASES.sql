begin;
alter table public.kw_player_wallet add column if not exists gem_debt integer not null default 0 check(gem_debt>=0);
create table if not exists public.kw_play_gem_purchases(
 purchase_token text primary key, user_id uuid not null references public.users(id) on delete cascade,
 product_id text not null check(product_id in ('gems_50','gems_100','gems_250','gems_500')),
 gems integer not null check(gems in (50,100,250,500)),order_id text unique,
 store_environment text not null check(store_environment in ('sandbox','production')),
 status text not null default 'granted' check(status in ('granted','refunded')),
 granted_at timestamptz not null default now(),refunded_at timestamptz
);
-- Keep a tombstone even when a refund notification beats the first grant.
create table if not exists public.kw_play_gem_revocations(purchase_token text primary key,revoked_at timestamptz not null default now());
alter table public.kw_play_gem_purchases enable row level security;
alter table public.kw_play_gem_revocations enable row level security;
revoke all on public.kw_play_gem_purchases,public.kw_play_gem_revocations from public,anon,authenticated;
grant select on public.kw_play_gem_purchases,public.kw_play_gem_revocations to service_role;

-- Every later credit, including season prizes, pays only the outstanding refund
-- balance first. Never remove heroes/items or change an active world's stats.
create or replace function public.kw_wallet_refund_offset() returns trigger language plpgsql set search_path=public,pg_temp as $$
declare paid integer;
begin
 if new.gems>old.gems and old.gem_debt>0 then
  paid:=least(new.gems-old.gems,old.gem_debt);
  new.gems:=new.gems-paid;new.gem_debt:=old.gem_debt-paid;
 end if;
 return new;
end $$;
drop trigger if exists kw_wallet_refund_offset on public.kw_player_wallet;
create trigger kw_wallet_refund_offset before update of gems on public.kw_player_wallet for each row execute function public.kw_wallet_refund_offset();

create or replace function public.kw_grant_play_gems(p_user_id uuid,p_product_id text,p_purchase_token text,p_order_id text,p_store_environment text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare amount integer;saved public.kw_play_gem_purchases%rowtype;wallet public.kw_player_wallet%rowtype;debt_before integer;
begin
 if not exists(select 1 from public.users u where id=p_user_id and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null) then raise exception 'APP_USER_REQUIRED';end if;
 amount:=case p_product_id when 'gems_50' then 50 when 'gems_100' then 100 when 'gems_250' then 250 when 'gems_500' then 500 else null end;
 if amount is null then raise exception 'INVALID_GEM_PRODUCT';end if;
 if nullif(btrim(p_purchase_token),'') is null or length(p_purchase_token)>8192 or p_purchase_token<>btrim(p_purchase_token) then raise exception 'INVALID_PURCHASE_TOKEN';end if;
 if p_store_environment is null or p_store_environment not in ('sandbox','production') then raise exception 'INVALID_ENVIRONMENT';end if;
 if p_order_id is not null and (length(p_order_id)>512 or nullif(btrim(p_order_id),'') is null) then raise exception 'INVALID_ORDER_ID';end if;
 perform pg_advisory_xact_lock(hashtextextended('kw_play_gems:'||p_purchase_token,0));
 if exists(select 1 from public.kw_play_gem_revocations where purchase_token=p_purchase_token) then raise exception 'PURCHASE_REVOKED';end if;
 select * into saved from public.kw_play_gem_purchases where purchase_token=p_purchase_token for update;
 if found then
  if saved.user_id<>p_user_id then raise exception 'PURCHASE_ACCOUNT_MISMATCH';end if;
  if saved.product_id<>p_product_id or saved.order_id is distinct from p_order_id or saved.store_environment<>p_store_environment then raise exception 'PURCHASE_CONFLICT';end if;
  if saved.status<>'granted' then raise exception 'PURCHASE_REVOKED';end if;
  select * into wallet from public.kw_player_wallet where user_id=p_user_id;
  return jsonb_build_object('duplicate',true,'credited',0,'gems',wallet.gems,'gemDebt',wallet.gem_debt);
 end if;
 insert into public.kw_play_gem_purchases(purchase_token,user_id,product_id,gems,order_id,store_environment) values(p_purchase_token,p_user_id,p_product_id,amount,p_order_id,p_store_environment);
 perform public.kw_collection_bootstrap(p_user_id);
 select * into wallet from public.kw_player_wallet where user_id=p_user_id for update;debt_before:=wallet.gem_debt;
 update public.kw_player_wallet set gems=gems+amount where user_id=p_user_id returning * into wallet;
 return jsonb_build_object('duplicate',false,'credited',amount,'gems',wallet.gems,'gemDebt',wallet.gem_debt,'refundOffset',debt_before-wallet.gem_debt);
end $$;

-- Service-only: call after verifying a Google refund/void, never from a client
-- claim. The revocation prevents a stale verification from re-crediting later.
create or replace function public.kw_refund_play_gems(p_purchase_token text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.kw_play_gem_purchases%rowtype;wallet public.kw_player_wallet%rowtype;reclaimed integer;
begin
 if nullif(btrim(p_purchase_token),'') is null or length(p_purchase_token)>8192 then raise exception 'INVALID_PURCHASE_TOKEN';end if;
 perform pg_advisory_xact_lock(hashtextextended('kw_play_gems:'||p_purchase_token,0));
 insert into public.kw_play_gem_revocations(purchase_token) values(p_purchase_token) on conflict do nothing;
 select * into saved from public.kw_play_gem_purchases where purchase_token=p_purchase_token for update;
 if not found then return jsonb_build_object('found',false,'duplicate',false);end if;
 if saved.status='refunded' then return jsonb_build_object('found',true,'duplicate',true);end if;
 select * into wallet from public.kw_player_wallet where user_id=saved.user_id for update;
 reclaimed:=least(wallet.gems,saved.gems);
 update public.kw_player_wallet set gems=gems-reclaimed,gem_debt=gem_debt+saved.gems-reclaimed where user_id=saved.user_id returning * into wallet;
 update public.kw_play_gem_purchases set status='refunded',refunded_at=now() where purchase_token=p_purchase_token;
 return jsonb_build_object('found',true,'duplicate',false,'reclaimed',reclaimed,'gems',wallet.gems,'gemDebt',wallet.gem_debt);
end $$;
revoke all on function public.kw_wallet_refund_offset(),public.kw_grant_play_gems(uuid,text,text,text,text),public.kw_refund_play_gems(text) from public,anon,authenticated;
grant execute on function public.kw_grant_play_gems(uuid,text,text,text,text),public.kw_refund_play_gems(text) to service_role;
create or replace function public.kw_collection_read(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.kw_collection_bootstrap(p_user_id);
 return jsonb_build_object('seasonRewards',coalesce((select jsonb_agg(to_jsonb(a)) from (select r.world_id as "worldId",w.name as "worldName",r.gems,r.product_ids as "productIds",r.awarded_at as "awardedAt",r.place,r.participants,r.rarity,r.participation_gems as "participationGems",r.victory_gems as "victoryGems",r.placement_gems as "placementGems",r.conversion_gems as "conversionGems",r.king_xp as "kingXp",r.xp_percent as "xpPercent",r.rules_version as "rulesVersion" from public.kw_collection_season_rewards r join public.worlds w on w.id=r.world_id where r.user_id=p_user_id order by r.awarded_at desc limit 10) a),'[]'::jsonb),'gemDebt',(select gem_debt from public.kw_player_wallet where user_id=p_user_id),'gems',(select gems from public.kw_player_wallet where user_id=p_user_id),'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'xp',i.xp,'source',i.source,'added',jsonb_build_object('administration',i.added_ad,'command',i.added_cm,'exploration',i.added_ex),'statRevision',i.stat_revision)) from public.kw_player_inventory i where i.user_id=p_user_id),'[]'::jsonb),'selectedId',coalesce((select appearance_id from public.kw_account_appearance where user_id=p_user_id),'sovereign-01'));
end $$;
revoke all on function public.kw_collection_read(uuid) from public,anon,authenticated;
grant execute on function public.kw_collection_read(uuid) to service_role;
commit;
