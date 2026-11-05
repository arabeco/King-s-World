begin;
alter table public.kw_collection_catalog add column if not exists rarity text check(rarity in ('common','uncommon','rare','epic'));
update public.kw_collection_catalog set rarity='common' where product_id='item-craft-ledger';
update public.kw_collection_catalog set rarity='common' where product_id='item-guard-crest';
update public.kw_collection_catalog set rarity='common' where product_id='item-travel-compass';
update public.kw_collection_catalog set rarity='common' where product_id='item-seed-sack';
update public.kw_collection_catalog set rarity='common' where product_id='item-master-hammer';
update public.kw_collection_catalog set rarity='uncommon' where product_id='item-watch-standard';
update public.kw_collection_catalog set rarity='uncommon' where product_id='item-road-map';
update public.kw_collection_catalog set rarity='uncommon' where product_id='item-granary-seal';
update public.kw_collection_catalog set rarity='uncommon' where product_id='item-patrol-horn';
update public.kw_collection_catalog set rarity='uncommon' where product_id='item-steward-ledger';
update public.kw_collection_catalog set rarity='rare' where product_id='item-cartographer-divider';
update public.kw_collection_catalog set rarity='rare' where product_id='item-frontier-shield';
update public.kw_collection_catalog set rarity='rare' where product_id='item-builder-tools';
update public.kw_collection_catalog set rarity='rare' where product_id='item-harvest-coffer';
update public.kw_collection_catalog set rarity='epic' where product_id='item-journey-crown';
-- Durable receipt: one award per human and world, independent of read/claim retries.
create table if not exists public.kw_collection_season_rewards(
 world_id uuid not null references public.worlds(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,
 gems integer not null check(gems>=0),product_ids text[] not null default array[]::text[] check(cardinality(product_ids)<=1),
 awarded_at timestamptz not null default now(),primary key(world_id,user_id)
);
alter table public.kw_collection_season_rewards enable row level security;
revoke all on public.kw_collection_season_rewards from public,anon,authenticated;
grant select,insert on public.kw_collection_season_rewards to service_role;

create or replace function public.kw_collection_award_season(p_world uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.worlds%rowtype;r public.kw_cozy_rewards%rowtype;amount integer;weight integer;humans integer;place integer;tier text;reward_items text[];inserted integer;
begin
 select * into w from public.worlds where id=p_world;
 if not found or w.status<>'finalized' or w.rules_version<>2 then return;end if;
 weight:=case when w.season_mode='express' then 1 else 4 end;
 -- No short, manually finalized worlds may mint collection currency.
 if w.starts_at is null or now()<(w.starts_at+(case when weight=1 then interval '30 days' else interval '120 days' end)) then return;end if;
 select * into r from public.kw_cozy_rewards where world_id=p_world and user_id=p_user and finished;
 if not found or r.final_score is null or (r.final_score<500 and r.portal_crossed_at is null) then return;end if;
 if not exists(select 1 from public.world_players where id=r.world_player_id and world_id=p_world and user_id=p_user and not is_ai) then return;end if;
 if not exists(select 1 from public.users where id=p_user and coalesce(to_jsonb(users)->>'account_status','active')='active' and to_jsonb(users)->>'deletion_requested_at' is null) then return;end if;
 perform public.kw_collection_bootstrap(p_user);
 -- Serialize rewards from simultaneous worlds with purchases and other awards.
 perform 1 from public.kw_player_wallet where user_id=p_user for update;
 if exists(select 1 from public.kw_collection_season_rewards where world_id=p_world and user_id=p_user) then return;end if;
 amount:=5*weight;reward_items:=array[]::text[];
 if r.portal_crossed_at is not null then
  amount:=amount+10*weight;
  -- Rank among participating humans, not NPCs or inactive accounts.
  select count(*),1+count(*) filter(where other.final_rank<r.final_rank) into humans,place
   from public.kw_cozy_rewards other join public.world_players p on p.id=other.world_player_id
   where other.world_id=p_world and other.finished and not p.is_ai and (other.final_score>=500 or other.portal_crossed_at is not null);
  if humans>=5 and place between 1 and 3 then amount:=amount+(4-place)*weight;end if;
  tier:=case when humans>=10 and place=1 then 'epic'
   when humans>=5 and (place=1 or place::numeric/humans<=0.25) then 'rare'
   when humans>=5 and place::numeric/humans<=0.60 then 'uncommon' else 'common' end;
  select coalesce(array_agg(chosen.product_id),array[]::text[]) into reward_items from (
   select c.product_id from public.kw_collection_catalog c
   where c.kind='equipment' and c.rarity=tier and not c.starter
    and not exists(select 1 from public.kw_player_inventory i where i.user_id=p_user and i.product_id=c.product_id)
   order by md5(p_world::text||p_user::text||c.product_id),c.product_id limit 1) chosen;
  -- One item maximum in either calendar. Exhausted rarity converts to currency.
  if cardinality(reward_items)=0 then amount:=amount+2;end if;
 end if;
 insert into public.kw_collection_season_rewards(world_id,user_id,gems,product_ids) values(p_world,p_user,amount,reward_items) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return;end if;
 update public.kw_player_wallet set gems=gems+amount where user_id=p_user;
 insert into public.kw_player_inventory(user_id,product_id,source) select p_user,id,'season:'||p_world from unnest(reward_items) id on conflict do nothing;
end $$;

create or replace function public.kw_collection_season_closed() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare participant record;
begin
 if tg_table_name='worlds' then
  if new.status='finalized' and old.status is distinct from 'finalized' then
   for participant in select user_id from public.kw_cozy_rewards where world_id=new.id and finished order by user_id loop
    perform public.kw_collection_award_season(new.id,participant.user_id);
   end loop;
  end if;
 else
  if new.finished then perform public.kw_collection_award_season(new.world_id,new.user_id);end if;
 end if;
 return new;
end $$;
drop trigger if exists kw_collection_world_closed on public.worlds;
create trigger kw_collection_world_closed after update of status on public.worlds for each row execute function public.kw_collection_season_closed();
drop trigger if exists kw_collection_result_closed on public.kw_cozy_rewards;
create trigger kw_collection_result_closed after insert or update of finished on public.kw_cozy_rewards for each row execute function public.kw_collection_season_closed();
revoke all on function public.kw_collection_award_season(uuid,uuid),public.kw_collection_season_closed() from public,anon,authenticated;
create or replace function public.kw_collection_read(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.kw_collection_bootstrap(p_user_id);
 return jsonb_build_object('seasonRewards',coalesce((select jsonb_agg(to_jsonb(a)) from (select r.world_id as "worldId",w.name as "worldName",r.gems,r.product_ids as "productIds",r.awarded_at as "awardedAt" from public.kw_collection_season_rewards r join public.worlds w on w.id=r.world_id where r.user_id=p_user_id order by r.awarded_at desc limit 10) a),'[]'::jsonb),'gems',(select gems from public.kw_player_wallet where user_id=p_user_id),'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'xp',i.xp,'source',i.source,'added',jsonb_build_object('administration',i.added_ad,'command',i.added_cm,'exploration',i.added_ex),'statRevision',i.stat_revision)) from public.kw_player_inventory i where i.user_id=p_user_id),'[]'::jsonb),'selectedId',coalesce((select appearance_id from public.kw_account_appearance where user_id=p_user_id),'sovereign-01'));
end $$;

-- No historical backfill: only newly completed seasons receive awards.
commit;
