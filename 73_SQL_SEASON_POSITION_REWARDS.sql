begin;
-- Additive v2 prize receipts. Existing grants are preserved; no retroactive rank XP.
alter table public.kw_collection_season_rewards
 add column if not exists place integer check(place>0),
 add column if not exists participants integer check(participants>0),
 add column if not exists rarity text check(rarity in ('common','uncommon','rare','epic')),
 add column if not exists participation_gems integer not null default 0 check(participation_gems>=0),
 add column if not exists victory_gems integer not null default 0 check(victory_gems>=0),
 add column if not exists placement_gems integer not null default 0 check(placement_gems>=0),
 add column if not exists conversion_gems integer not null default 0 check(conversion_gems>=0),
 add column if not exists king_xp jsonb not null default '{}'::jsonb check(jsonb_typeof(king_xp)='object'),
 add column if not exists xp_percent integer not null default 0 check(xp_percent in (0,5,10)),
 add column if not exists rules_version integer not null default 1 check(rules_version in (1,2));
create or replace function public.kw_collection_award_season(p_world uuid,p_user uuid) returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.worlds%rowtype;r public.kw_cozy_rewards%rowtype;amount integer;weight integer;humans integer;place integer;tier text;reward_items text[];inserted integer;participation integer;victory integer:=0;placement integer:=0;conversion integer:=0;xp_percent integer:=0;xp_awards jsonb:='{}'::jsonb;earned record;bonus integer;
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
 -- Never freeze a prize against a partial set of human results.
 if exists(select 1 from public.world_players p join public.users u on u.id=p.user_id
  left join public.kw_cozy_rewards q on q.world_id=p_world and q.user_id=p.user_id and q.finished and q.final_rank is not null and q.final_score is not null
  where p.world_id=p_world and not p.is_ai and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null and q.user_id is null) then return;end if;
 select count(*),1+count(*) filter(where other.final_rank<r.final_rank) into humans,place
  from public.kw_cozy_rewards other join public.world_players p on p.id=other.world_player_id join public.users u on u.id=p.user_id
  where other.world_id=p_world and other.finished and other.final_rank is not null and not p.is_ai and (other.final_score>=500 or other.portal_crossed_at is not null)
   and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null;
 if r.final_rank is null or humans=0 then return;end if;
 if humans>=5 then xp_percent:=case when place::numeric/humans<=0.25 then 10 when place::numeric/humans<=0.50 then 5 else 0 end;end if;
 perform public.kw_collection_bootstrap(p_user);
 -- Serialize rewards from simultaneous worlds with purchases and other awards.
 perform 1 from public.kw_player_wallet where user_id=p_user for update;
 if exists(select 1 from public.kw_collection_season_rewards where world_id=p_world and user_id=p_user) then return;end if;
 participation:=5*weight;amount:=participation;reward_items:=array[]::text[];
 if r.portal_crossed_at is not null then
  victory:=10*weight;amount:=amount+victory;
  if humans>=5 and place between 1 and 3 then placement:=(4-place)*weight;amount:=amount+placement;end if;
  tier:=case when humans>=10 and place=1 then 'epic'
   when humans>=5 and (place=1 or place::numeric/humans<=0.25) then 'rare'
   when humans>=5 and place::numeric/humans<=0.60 then 'uncommon' else 'common' end;
  select coalesce(array_agg(chosen.product_id),array[]::text[]) into reward_items from (
   select c.product_id from public.kw_collection_catalog c
   where c.kind='equipment' and c.rarity=tier and not c.starter
    and not exists(select 1 from public.kw_player_inventory i where i.user_id=p_user and i.product_id=c.product_id)
   order by md5(p_world::text||p_user::text||c.product_id),c.product_id limit 1) chosen;
  -- One item maximum in either calendar. Exhausted rarity converts to currency.
  if cardinality(reward_items)=0 then conversion:=2;amount:=amount+conversion;end if;
 end if;
 -- Rank XP uses only this world's authoritative progress ledger, distributed to its original kings.
 if xp_percent>0 then
  for earned in select e.product_id,sum(e.xp)::bigint xp from public.kw_king_xp_events e
   join public.kw_player_inventory i on i.user_id=p_user and i.product_id=e.product_id
   join public.kw_collection_catalog c on c.product_id=e.product_id and c.kind='king'
   where e.world_player_id=r.world_player_id group by e.product_id order by e.product_id loop
   bonus:=floor(earned.xp*xp_percent/100.0)::integer;
   if bonus>0 then xp_awards:=xp_awards||jsonb_build_object(earned.product_id,bonus);end if;
  end loop;
 end if;
 insert into public.kw_collection_season_rewards(world_id,user_id,gems,product_ids,place,participants,rarity,participation_gems,victory_gems,placement_gems,conversion_gems,king_xp,xp_percent,rules_version)
 values(p_world,p_user,amount,reward_items,place,humans,tier,participation,victory,placement,conversion,xp_awards,xp_percent,2) on conflict do nothing;
 get diagnostics inserted=row_count;
 if inserted=0 then return;end if;
 update public.kw_player_wallet set gems=gems+amount where user_id=p_user;
 insert into public.kw_player_inventory(user_id,product_id,source) select p_user,id,'season:'||p_world from unnest(reward_items) id on conflict do nothing;
 update public.kw_player_inventory i set xp=i.xp+(a.value::text)::integer from jsonb_each(xp_awards) a where i.user_id=p_user and i.product_id=a.key;
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
  if new.finished and exists(select 1 from public.worlds where id=new.world_id and status='finalized') then
   for participant in select user_id from public.kw_cozy_rewards where world_id=new.world_id and finished order by user_id loop
    perform public.kw_collection_award_season(new.world_id,participant.user_id);
   end loop;
  end if;
 end if;
 return new;
end $$;

create or replace function public.kw_collection_read(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.kw_collection_bootstrap(p_user_id);
 return jsonb_build_object('seasonRewards',coalesce((select jsonb_agg(to_jsonb(a)) from (select r.world_id as "worldId",w.name as "worldName",r.gems,r.product_ids as "productIds",r.awarded_at as "awardedAt",r.place,r.participants,r.rarity,r.participation_gems as "participationGems",r.victory_gems as "victoryGems",r.placement_gems as "placementGems",r.conversion_gems as "conversionGems",r.king_xp as "kingXp",r.xp_percent as "xpPercent",r.rules_version as "rulesVersion" from public.kw_collection_season_rewards r join public.worlds w on w.id=r.world_id where r.user_id=p_user_id order by r.awarded_at desc limit 10) a),'[]'::jsonb),'gems',(select gems from public.kw_player_wallet where user_id=p_user_id),'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'xp',i.xp,'source',i.source,'added',jsonb_build_object('administration',i.added_ad,'command',i.added_cm,'exploration',i.added_ex),'statRevision',i.stat_revision)) from public.kw_player_inventory i where i.user_id=p_user_id),'[]'::jsonb),'selectedId',coalesce((select appearance_id from public.kw_account_appearance where user_id=p_user_id),'sovereign-01'));
end $$;


revoke all on function public.kw_collection_award_season(uuid,uuid),public.kw_collection_season_closed() from public,anon,authenticated;
commit;
