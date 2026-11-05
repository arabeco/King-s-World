-- PostgreSQL real smoke, transaction-only fixtures, no actual PvP season activation.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$declare u uuid:=gen_random_uuid();v uuid:=gen_random_uuid();w uuid;cozy uuid;c jsonb;member uuid;denied boolean;count_before integer;
begin
 insert into public.users(id,username,email) values(u,'qa74_'||substr(replace(u::text,'-',''),1,16),u::text||'@test.invalid'),(v,'qa74_'||substr(replace(v::text,'-',''),1,16),v::text||'@test.invalid');
 c:=public.kw_cozy_create_with_rules(u,'QA competitive mode','express','competitive',null);w:=(c->>'id')::uuid;
 assert (select combat_mode from public.worlds where id=w)='competitive','COMPETITIVE_CREATION';
 select count(*) into count_before from public.worlds;
 denied:=false;begin perform public.kw_cozy_create_with_rules(u,'QA invalid mode','express','invalid',null);exception when raise_exception then if sqlerrm like '%INVALID_COMBAT_MODE%' then denied:=true;else raise;end if;end;
 assert denied and (select count(*) from public.worlds)=count_before,'INVALID_MODE_NO_ORPHAN';
 perform public.kw_cozy_start(w,u);
 denied:=false;begin update public.worlds set combat_mode='cozy' where id=w;exception when raise_exception then if sqlerrm like '%COMBAT_MODE_LOCKED%' then denied:=true;else raise;end if;end;
 assert denied,'MODE_LOCKED_AFTER_START';
 c:=public.kw_cozy_create_with_rules(v,'QA Cozy default','express','cozy',null);cozy:=(c->>'id')::uuid;
 assert (select combat_mode from public.worlds where id=cozy)='cozy','COZY_DEFAULT';
 select id into member from public.world_players where world_id=cozy and user_id=v;
 insert into public.kw_cozy_player_states(world_player_id,world_id,user_id,state_json,influence,revision) values(member,cozy,v,'{}',0,1);
 denied:=false;begin update public.worlds set combat_mode='competitive' where id=cozy;exception when raise_exception then if sqlerrm like '%COMBAT_MODE_LOCKED%' then denied:=true;else raise;end if;end;
 assert denied,'MODE_LOCKED_AFTER_PREPARATION';
 assert not has_function_privilege('anon','public.kw_cozy_create_with_rules(uuid,text,text,text,text)','execute'),'ANON_DENIED';
 assert not has_function_privilege('authenticated','public.kw_cozy_create_with_rules(uuid,text,text,text,text)','execute'),'CLIENT_DENIED';
 assert has_function_privilege('service_role','public.kw_cozy_create_with_rules(uuid,text,text,text,text)','execute'),'SERVER_ALLOWED';
end $$;
select jsonb_build_object('status','PASS','migration',74,'checks',array['explicit competitive creation','Cozy creation','invalid mode atomic rejection','mode frozen after start','mode frozen after preparation','private RPC'],'cleanup','ROLLBACK follows') verification;
rollback;
