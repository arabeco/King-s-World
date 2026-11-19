begin;

-- Independent of live membership and legacy seasonal prize keys.
create table if not exists public.kw_cozy_ascension_archives (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  world_id uuid not null,
  world_player_id uuid not null,
  founded_at_ms bigint not null,
  completed_at_ms bigint not null check (completed_at_ms >= founded_at_ms),
  medal text not null check (medal in ('bronze','silver','gold','legendary')),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  unique (world_player_id, founded_at_ms)
);
create index if not exists kw_cozy_ascension_history_idx
  on public.kw_cozy_ascension_archives (user_id, completed_at_ms desc, id desc);
alter table public.kw_cozy_ascension_archives enable row level security;
revoke all on public.kw_cozy_ascension_archives from public, anon, authenticated, service_role;

-- Only the trusted world commit may eventually attach the confirmed marker.
-- Archive, wallet, inventory and the realm state then share one transaction.
create or replace function public.kw_cozy_record_ascension() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s jsonb := new.state_json;
  confirmation jsonb := s->'ascension';
  w public.worlds%rowtype;
  wallet public.kw_player_wallet%rowtype;
  archive_id uuid := gen_random_uuid();
  founded bigint;
  completed bigint;
  peak integer;
  medal_id text;
  tier text;
  item_id text;
  base_gems integer;
  conversion integer;
  award integer;
  repaid integer;
  cities jsonb;
begin
  if tg_op = 'UPDATE' and old.state_json ? 'ascension' then
    if confirmation is distinct from old.state_json->'ascension'
       or s->'createdAt' is distinct from old.state_json->'createdAt'
       or s->'finalizedAt' is distinct from old.state_json->'finalizedAt'
       or s->'finalScore' is distinct from old.state_json->'finalScore' then
      raise exception 'COZY_ASCENSION_ALREADY_RECORDED';
    end if;
    return new;
  end if;
  if confirmation is null then return new; end if;

  select * into w from public.worlds where id = new.world_id;
  if not found or not w.persistent_cozy or w.status <> 'running'
     or not exists (select 1 from public.world_players p where p.id = new.world_player_id
       and p.world_id = new.world_id and p.user_id = new.user_id and not p.is_ai and p.status = 'alive') then
    raise exception 'COZY_ASCENSION_UNAVAILABLE';
  end if;

  founded := (s->>'createdAt')::bigint;
  completed := (s->>'finalizedAt')::bigint;
  if tg_op <> 'UPDATE' or jsonb_typeof(confirmation) is distinct from 'object'
     or old.state_json->>'finalizedAt' is not null or old.state_json->>'founding' is not null
     or founded is null or founded is distinct from (old.state_json->>'createdAt')::bigint
     or completed is null or completed < founded or completed is distinct from (s->>'settledAt')::bigint
     or completed > extract(epoch from clock_timestamp())*1000 + 5000
     or s#>>'{king,alive}' is distinct from 'true'
     or s#>>'{king,sovereignId}' is distinct from old.state_json#>>'{king,sovereignId}'
     or s#>>'{king,generation}' is distinct from old.state_json#>>'{king,generation}'
     or s->>'portalCrossedAt' is not null or s->>'defeat' is not null
     or jsonb_typeof(s->'cities') is distinct from 'array'
     or s->'orders' is distinct from '[]'::jsonb or new.influence < 1500
     or (s->>'finalScore')::integer is distinct from new.influence then
    raise exception 'COZY_ASCENSION_INVALID_STATE';
  end if;
  if jsonb_array_length(s->'cities') not between 1 and 10 then raise exception 'COZY_ASCENSION_INVALID_STATE'; end if;

  peak := greatest(new.influence, coalesce((s->>'peakInfluence')::integer,0),
    coalesce((old.state_json->>'peakInfluence')::integer,0), old.influence);
  if peak > 2500 then raise exception 'COZY_ASCENSION_INVALID_STATE'; end if;
  select case when peak = 2500 then 'legendary' when peak >= 2100 then 'gold' when peak >= 1800 then 'silver' else 'bronze' end,
    case when peak = 2500 then 'epic' when peak >= 2100 then 'rare' when peak >= 1800 then 'uncommon' else 'common' end
  into medal_id, tier;

  perform public.kw_collection_bootstrap(new.user_id);
  select * into wallet from public.kw_player_wallet where user_id = new.user_id for update;
  if not exists (select 1 from public.kw_collection_catalog c where c.kind = 'equipment' and c.rarity = tier and not c.starter) then
    raise exception 'COZY_ASCENSION_CATALOG_UNAVAILABLE';
  end if;
  -- Same stable candidate order as the read-only preview.
  select c.product_id into item_id from public.kw_collection_catalog c
    where c.kind = 'equipment' and c.rarity = tier and not c.starter
      and not exists (select 1 from public.kw_player_inventory i where i.user_id = new.user_id and i.product_id = c.product_id)
    order by md5(w.id::text || ':' || new.world_player_id::text || ':' || founded::text || ':' || c.product_id) collate "C",
      c.product_id collate "C" limit 1;
  base_gems := case when w.season_mode = 'express' then 15 else 60 end;
  conversion := case when item_id is null then 2 else 0 end;
  award := base_gems + conversion;
  repaid := least(award,wallet.gem_debt);
  if confirmation->>'medal' is distinct from medal_id
     or confirmation->'equipmentId' is distinct from coalesce(to_jsonb(item_id),'null'::jsonb)
     or (confirmation->>'creditedGems')::integer is distinct from award - repaid
     or (confirmation->>'refundOffset')::integer is distinct from repaid then
    raise exception 'COZY_ASCENSION_OFFER_CHANGED';
  end if;

  select jsonb_agg(jsonb_build_object('id',c->'id','name',c->'name','capital',c->'capital','sectors',c->'sectors') order by position)
    into cities from jsonb_array_elements(s->'cities') with ordinality as city(c,position);

  insert into public.kw_cozy_ascension_archives(id,user_id,world_id,world_player_id,founded_at_ms,completed_at_ms,medal,receipt)
  values(archive_id,new.user_id,new.world_id,new.world_player_id,founded,completed,medal_id,jsonb_build_object(
    'id',archive_id,'worldName',w.name,'mode',w.season_mode,
    'sovereign',s#>>'{king,nickname}','sovereignId',s#>>'{king,sovereignId}',
    'foundedAt',founded,'completedAt',completed,'score',new.influence,'peak',peak,'medal',medal_id,
    'cities',cities,'milestones',s->'quests','wonders',coalesce(s#>'{progression,feats,wonders}','[]'::jsonb),
    'rewards',jsonb_build_object('baseGems',base_gems,'conversionGems',conversion,'totalGems',award,
      'refundOffset',repaid,'creditedGems',award-repaid,'equipmentId',item_id)));

  -- The wallet trigger consumes any refund debt before increasing the balance.
  update public.kw_player_wallet set gems = gems + award where user_id = new.user_id;
  if item_id is not null then
    insert into public.kw_player_inventory(user_id,product_id,source)
    values(new.user_id,item_id,'ascension:' || archive_id);
  end if;
  return new;
end;
$$;
drop trigger if exists kw_cozy_record_ascension on public.kw_cozy_player_states;
create trigger kw_cozy_record_ascension after insert or update of state_json
  on public.kw_cozy_player_states for each row execute function public.kw_cozy_record_ascension();
revoke all on function public.kw_cozy_record_ascension() from public, anon, authenticated, service_role;

create or replace function public.kw_cozy_read_ascensions(p_user_id uuid, p_before_id uuid default null) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with cursor_row as (
    select completed_at_ms,id from public.kw_cozy_ascension_archives where user_id = p_user_id and id = p_before_id
  ), page as (
    select id,receipt,completed_at_ms from public.kw_cozy_ascension_archives
    where user_id = p_user_id and (p_before_id is null or (completed_at_ms,id) < (select completed_at_ms,id from cursor_row))
    order by completed_at_ms desc,id desc limit 13
  ), shown as (
    select * from page order by completed_at_ms desc,id desc limit 12
  ), medals as (
    select medal,count(*) as count from public.kw_cozy_ascension_archives where user_id = p_user_id group by medal
  )
  select jsonb_build_object(
    'receipts',coalesce((select jsonb_agg(receipt order by completed_at_ms desc,id desc) from shown),'[]'::jsonb),
    'medals',coalesce((select jsonb_object_agg(medal,count) from medals),'{}'::jsonb),
    'nextCursor',case when (select count(*) from page)>12 then
      (select id from shown order by completed_at_ms,id limit 1) else null end);
$$;
revoke all on function public.kw_cozy_read_ascensions(uuid,uuid) from public, anon, authenticated;
grant execute on function public.kw_cozy_read_ascensions(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
