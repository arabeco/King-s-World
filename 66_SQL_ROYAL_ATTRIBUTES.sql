begin;
create table if not exists public.kw_royal_attributes (
 user_id uuid primary key references public.users(id) on delete cascade,
 administration smallint not null default 5 check(administration between 0 and 10),
 command smallint not null default 5 check(command between 0 and 10),
 exploration smallint not null default 5 check(exploration between 0 and 10),
 revision bigint not null default 0,
 updated_at timestamptz not null default now()
);
alter table public.kw_royal_attributes enable row level security;
revoke all on public.kw_royal_attributes from public,anon,authenticated;
grant select,insert,update on public.kw_royal_attributes to service_role;
create or replace function public.kw_royal_attributes_save(p_user_id uuid,p_administration integer,p_command integer,p_exploration integer,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare lvl integer; current_row public.kw_royal_attributes%rowtype;
begin
 if not exists(select 1 from public.users where id=p_user_id and coalesce(to_jsonb(users)->>'account_status','active')='active' and to_jsonb(users)->>'deletion_requested_at' is null) then raise exception 'COZY_ACCOUNT_UNAVAILABLE'; end if;
 perform 1 from public.users where id=p_user_id for update;
 select 1+floor(sqrt(coalesce(sum(xp),0)/100.0)) into lvl from public.kw_cozy_rewards where user_id=p_user_id;
 if p_administration is null or p_command is null or p_exploration is null or least(p_administration,p_command,p_exploration)<0 or greatest(p_administration,p_command,p_exploration)>10 or p_administration+p_command+p_exploration>15+least(15,lvl) then raise exception 'ROYAL_INVALID_POINTS'; end if;
 select * into current_row from public.kw_royal_attributes where user_id=p_user_id;
 if (not found and p_expected_revision<>0) or (found and current_row.revision<>p_expected_revision) then raise exception 'ROYAL_REVISION_CONFLICT'; end if;
 insert into public.kw_royal_attributes(user_id,administration,command,exploration,revision) values(p_user_id,p_administration,p_command,p_exploration,1)
 on conflict(user_id) do update set administration=excluded.administration,command=excluded.command,exploration=excluded.exploration,revision=public.kw_royal_attributes.revision+1,updated_at=now()
 returning * into current_row;
 return jsonb_build_object('administration',current_row.administration,'command',current_row.command,'exploration',current_row.exploration,'revision',current_row.revision);
end $$;
revoke all on function public.kw_royal_attributes_save(uuid,integer,integer,integer,bigint) from public,anon,authenticated;
grant execute on function public.kw_royal_attributes_save(uuid,integer,integer,integer,bigint) to service_role;
-- Before opening the gates only a server-validated king choice may create a receipt.
create or replace function public.kw_cozy_commit_royal_before_start(
 p_world_id uuid,p_user_id uuid,p_actor_player_id uuid,p_expected_shared_revision bigint,
 p_expected_world_status text,p_shared jsonb,p_players jsonb,p_request_id text,p_action_hash text,p_finalize boolean
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_status text; old_hash text; result jsonb;
begin
 select status::text into current_status from public.worlds where id=p_world_id for update;
 if current_status is distinct from 'open' or p_expected_world_status<>'open' or p_finalize then return jsonb_build_object('status','conflict'); end if;
 if not exists(select 1 from public.world_players where id=p_actor_player_id and world_id=p_world_id and user_id=p_user_id and status='alive') then raise exception 'COZY_MEMBERSHIP_REQUIRED'; end if;
 select action_hash into old_hash from public.kw_cozy_commands where world_player_id=p_actor_player_id and request_id=p_request_id;
 if found then if old_hash<>p_action_hash then raise exception 'COZY_REQUEST_REUSED'; end if; return jsonb_build_object('status','duplicate'); end if;
 result:=public.kw_cozy_commit(p_world_id,p_user_id,p_actor_player_id,p_expected_shared_revision,p_expected_world_status,p_shared,p_players,null,null,false);
 if result->>'status'='committed' then insert into public.kw_cozy_commands(world_player_id,request_id,action_hash) values(p_actor_player_id,p_request_id,p_action_hash); end if;
 return result;
end $$;
revoke all on function public.kw_cozy_commit_royal_before_start(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean) from public,anon,authenticated;
grant execute on function public.kw_cozy_commit_royal_before_start(uuid,uuid,uuid,bigint,text,jsonb,jsonb,text,text,boolean) to service_role;
commit;
