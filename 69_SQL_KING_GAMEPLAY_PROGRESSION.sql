begin;
alter table public.kw_collection_catalog add column if not exists base_ad smallint not null default 0;
alter table public.kw_collection_catalog add column if not exists base_cm smallint not null default 0;
alter table public.kw_collection_catalog add column if not exists base_ex smallint not null default 0;
alter table public.kw_player_inventory add column if not exists added_ad smallint not null default 0 check(added_ad between 0 and 10);
alter table public.kw_player_inventory add column if not exists added_cm smallint not null default 0 check(added_cm between 0 and 10);
alter table public.kw_player_inventory add column if not exists added_ex smallint not null default 0 check(added_ex between 0 and 10);
alter table public.kw_player_inventory add column if not exists stat_revision bigint not null default 0;
update public.kw_collection_catalog set base_ad=5,base_cm=5,base_ex=5 where product_id='sovereign-01';
update public.kw_collection_catalog set base_ad=8,base_cm=4,base_ex=3 where product_id='sovereign-02';
update public.kw_collection_catalog set base_ad=3,base_cm=8,base_ex=4 where product_id='sovereign-03';
update public.kw_collection_catalog set base_ad=4,base_cm=3,base_ex=8 where product_id='sovereign-04';
update public.kw_collection_catalog set base_ad=3,base_cm=8,base_ex=4 where product_id='sovereign-05';
update public.kw_collection_catalog set base_ad=5,base_cm=7,base_ex=3 where product_id='sovereign-06';
update public.kw_collection_catalog set base_ad=8,base_cm=3,base_ex=4 where product_id='sovereign-07';
update public.kw_collection_catalog set base_ad=3,base_cm=4,base_ex=8 where product_id='sovereign-08';
update public.kw_collection_catalog set base_ad=8,base_cm=4,base_ex=3 where product_id='sovereign-09';
update public.kw_collection_catalog set base_ad=7,base_cm=3,base_ex=5 where product_id='sovereign-10';
update public.kw_collection_catalog set base_ad=4,base_cm=3,base_ex=8 where product_id='sovereign-11';
update public.kw_collection_catalog set base_ad=7,base_cm=4,base_ex=4 where product_id='sovereign-12';
update public.kw_collection_catalog set base_ad=5,base_cm=6,base_ex=4 where product_id='sovereign-13';
update public.kw_collection_catalog set base_ad=4,base_cm=4,base_ex=7 where product_id='sovereign-14';
update public.kw_collection_catalog set base_ad=6,base_cm=4,base_ex=5 where product_id='sovereign-15';
update public.kw_collection_catalog set base_ad=4,base_cm=8,base_ex=3 where product_id='sovereign-16';
update public.kw_collection_catalog set base_ad=8,base_cm=3,base_ex=4 where product_id='sovereign-17';
update public.kw_collection_catalog set base_ad=6,base_cm=4,base_ex=5 where product_id='sovereign-18';
update public.kw_collection_catalog set base_ad=5,base_cm=6,base_ex=4 where product_id='sovereign-19';
update public.kw_collection_catalog set base_ad=4,base_cm=4,base_ex=7 where product_id='sovereign-20';
update public.kw_collection_catalog set base_ad=6,base_cm=6,base_ex=3 where product_id='sovereign-21';
update public.kw_collection_catalog set base_ad=6,base_cm=3,base_ex=6 where product_id='sovereign-22';
create or replace function public.kw_collection_read(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.kw_collection_bootstrap(p_user_id);
 return jsonb_build_object('gems',(select gems from public.kw_player_wallet where user_id=p_user_id),'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'xp',i.xp,'source',i.source,'added',jsonb_build_object('administration',i.added_ad,'command',i.added_cm,'exploration',i.added_ex),'statRevision',i.stat_revision)) from public.kw_player_inventory i where i.user_id=p_user_id),'[]'::jsonb),'selectedId',coalesce((select appearance_id from public.kw_account_appearance where user_id=p_user_id),'sovereign-01'));
end $$;
create or replace function public.kw_king_stats(p_user_id uuid,p_king_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare i public.kw_player_inventory%rowtype;c public.kw_collection_catalog%rowtype;lvl integer;
begin
 perform public.kw_collection_bootstrap(p_user_id);
 select * into i from public.kw_player_inventory where user_id=p_user_id and product_id=p_king_id;
 select * into c from public.kw_collection_catalog where product_id=p_king_id and kind='king';
 if i.product_id is null or c.product_id is null then raise exception 'KING_NOT_OWNED';end if;
 lvl:=least(10,1+floor(sqrt(i.xp/25.0))::integer);
 return jsonb_build_object('kingId',p_king_id,'level',lvl,'xp',i.xp,'revision',i.stat_revision,'available',greatest(0,lvl-1-i.added_ad-i.added_cm-i.added_ex),'attributes',jsonb_build_object('administration',c.base_ad+i.added_ad,'command',c.base_cm+i.added_cm,'exploration',c.base_ex+i.added_ex));
end $$;
create or replace function public.kw_king_add_stat(p_user_id uuid,p_king_id text,p_stat text,p_expected_revision bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare stats jsonb;key_name text;
begin
 perform public.kw_collection_bootstrap(p_user_id);
 stats:=public.kw_king_stats(p_user_id,p_king_id);
 if p_expected_revision is null or (stats->>'revision')::bigint<>p_expected_revision then raise exception 'KING_REVISION_CONFLICT';end if;
 if p_stat is null or p_stat not in ('administration','command','exploration') then raise exception 'KING_INVALID_STAT';end if;
 if (stats->>'available')::integer<=0 or (stats->'attributes'->>p_stat)::integer>=10 then raise exception 'KING_NO_POINTS';end if;
 update public.kw_player_inventory set added_ad=added_ad+case when p_stat='administration' then 1 else 0 end,added_cm=added_cm+case when p_stat='command' then 1 else 0 end,added_ex=added_ex+case when p_stat='exploration' then 1 else 0 end,stat_revision=stat_revision+1 where user_id=p_user_id and product_id=p_king_id;
 return public.kw_collection_read(p_user_id);
end $$;
-- High-water mark across a world's reigns. Losing/recovering influence cannot farm XP.
create table if not exists public.kw_king_xp_progress(world_player_id uuid primary key references public.world_players(id) on delete cascade,highest_influence integer not null check(highest_influence between 0 and 2500));
create table if not exists public.kw_king_xp_events(world_player_id uuid references public.world_players(id) on delete cascade,revision bigint,product_id text references public.kw_collection_catalog(product_id),xp integer not null check(xp>0),primary key(world_player_id,revision));
alter table public.kw_king_xp_progress enable row level security;
alter table public.kw_king_xp_events enable row level security;
revoke all on public.kw_king_xp_progress,public.kw_king_xp_events from public,anon,authenticated;
grant select,insert,update on public.kw_king_xp_progress,public.kw_king_xp_events to service_role;
-- Existing saves start from their present progress; no retroactive season/account XP grant.
insert into public.kw_king_xp_progress(world_player_id,highest_influence) select world_player_id,influence from public.kw_cozy_player_states on conflict do nothing;
create or replace function public.kw_king_progress_xp() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare high integer;gain integer;king_id text;mode_weight integer;
begin
 if exists(select 1 from public.world_players where id=new.world_player_id and is_ai) then return new;end if;
 if not exists(select 1 from public.users where id=new.user_id and coalesce(to_jsonb(users)->>'account_status','active')='active' and to_jsonb(users)->>'deletion_requested_at' is null) then return new;end if;
 perform public.kw_collection_bootstrap(new.user_id);
 insert into public.kw_king_xp_progress(world_player_id,highest_influence) values(new.world_player_id,case when tg_op='UPDATE' then old.influence else 0 end) on conflict do nothing;
 select highest_influence into high from public.kw_king_xp_progress where world_player_id=new.world_player_id for update;
 -- A vacant/dead throne still consumes world progress, but cannot award king XP.
 -- Updating the high-water mark here prevents succession and regained-influence farming.
 update public.kw_king_xp_progress set highest_influence=greatest(high,new.influence) where world_player_id=new.world_player_id;
 if new.state_json#>>'{king,profileId}' is null or new.state_json#>>'{king,alive}' is distinct from 'true' then return new;end if;
 king_id:=coalesce(new.state_json#>>'{king,sovereignId}','sovereign-01');
 if not exists(select 1 from public.kw_player_inventory i join public.kw_collection_catalog c on c.product_id=i.product_id where i.user_id=new.user_id and i.product_id=king_id and c.kind='king') then raise exception 'KING_NOT_OWNED';end if;
 select case when season_mode='express' then 1 else 4 end into mode_weight from public.worlds where id=new.world_id;
 gain:=greatest(0,floor(new.influence/5.0)::integer-floor(high/5.0)::integer)*mode_weight;
 if gain>0 then
 insert into public.kw_king_xp_events(world_player_id,revision,product_id,xp) values(new.world_player_id,new.revision,king_id,gain);
 update public.kw_player_inventory set xp=xp+gain where user_id=new.user_id and product_id=king_id;
 end if;
 return new;
end $$;
drop trigger if exists kw_king_progress_xp on public.kw_cozy_player_states;
create trigger kw_king_progress_xp after insert or update of influence,state_json on public.kw_cozy_player_states for each row execute function public.kw_king_progress_xp();
revoke all on function public.kw_king_progress_xp() from public,anon,authenticated;
revoke all on function public.kw_king_stats(uuid,text) from public,anon,authenticated;
grant execute on function public.kw_king_stats(uuid,text) to service_role;
revoke all on function public.kw_king_add_stat(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.kw_king_add_stat(uuid,text,text,bigint) to service_role;
commit;
