-- Five transaction-only accounts and one world. No Auth signup, email or real purchase.
begin;
set local lock_timeout='5s';set local statement_timeout='60s';
do $$
declare people uuid[]:=array[]::uuid[];members uuid[]:=array[]::uuid[];u uuid;p uuid;w uuid;i integer;c jsonb;receipt public.kw_collection_season_rewards%rowtype;
begin
 for i in 1..5 loop
  u:=gen_random_uuid();people:=array_append(people,u);
  insert into public.users(id,username,email) values(u,'qa73_'||substr(replace(u::text,'-',''),1,16),u::text||'@test.invalid');
  perform public.kw_collection_read(u);
 end loop;
 c:=public.kw_cozy_create_lobby(people[1],'QA position prizes','express',null);w:=(c->>'id')::uuid;
 select id into p from public.world_players where world_id=w and user_id=people[1];members:=array_append(members,p);
 for i in 2..5 loop insert into public.world_players(world_id,user_id) values(w,people[i]) returning id into p;members:=array_append(members,p);end loop;
 perform public.kw_account_appearance_save(people[1],'sovereign-04',0);
 insert into public.kw_cozy_player_states(world_player_id,world_id,user_id,state_json,influence,revision) values(members[1],w,people[1],'{"king":{"profileId":"builder","sovereignId":"sovereign-01","alive":true,"attributes":{"administration":5,"command":5,"exploration":5}}}',0,1);
 insert into public.kw_king_xp_events(world_player_id,revision,product_id,xp) values(members[1],9000,'sovereign-01',300),(members[1],9001,'sovereign-02',100);
 update public.kw_player_inventory set xp=300 where user_id=people[1] and product_id='sovereign-01';
 update public.kw_player_inventory set xp=100 where user_id=people[1] and product_id='sovereign-02';
 update public.worlds set status='running',starts_at=now()-interval '31 days',phase_2_starts_at=now()-interval '20 days',ends_at=now()-interval '1 day' where id=w;
 for i in 1..4 loop
  insert into public.kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score,portal_crossed_at)
   values(w,people[i],members[i],'QA position prizes','QA player',true,i,case when i=1 then 1500 else 1000 end,case when i=1 then now() else null end);
 end loop;
 update public.worlds set status='finalized' where id=w;
 assert (select count(*) from public.kw_collection_season_rewards where world_id=w)=0,'PARTIAL_RANKING_PAID_EARLY';
 insert into public.kw_cozy_rewards(world_id,user_id,world_player_id,world_name,player_name,finished,final_rank,final_score)
  values(w,people[5],members[5],'QA position prizes','QA player',true,5,1000);
 select * into receipt from public.kw_collection_season_rewards where world_id=w and user_id=people[1];
 assert receipt.rules_version=2 and receipt.place=1 and receipt.participants=5,'RANK_RECEIPT';
 assert receipt.gems=18 and receipt.participation_gems=5 and receipt.victory_gems=10 and receipt.placement_gems=3,'GEM_BREAKDOWN';
 assert receipt.rarity='rare' and cardinality(receipt.product_ids)=1,'ONE_RARE_ITEM';
 assert receipt.king_xp='{"sovereign-01":30,"sovereign-02":10}'::jsonb and receipt.xp_percent=10,'PER_KING_XP_RECEIPT';
 assert (public.kw_king_stats(people[1],'sovereign-01')->>'xp')::integer=330,'KING_ONE_XP';
 assert (public.kw_king_stats(people[1],'sovereign-02')->>'xp')::integer=110,'KING_TWO_XP';
 assert (public.kw_king_stats(people[1],'sovereign-04')->>'xp')::integer=0,'ACCOUNT_SELECTION_CANNOT_DIVERT_XP';
 assert (select state_json#>>'{king,attributes,administration}' from public.kw_cozy_player_states where world_player_id=members[1])='5','REIGN_STATS_FROZEN';
 perform public.kw_collection_award_season(w,people[1]);
 assert (public.kw_collection_read(people[1])->>'gems')::integer=18,'GEMS_REPLAY';
 assert (public.kw_king_stats(people[1],'sovereign-01')->>'xp')::integer=330,'XP_REPLAY';
 assert (select count(*) from public.kw_collection_season_rewards where world_id=w)=5,'ALL_WAITING_RECIPIENTS_PAID';
 assert (public.kw_collection_read(people[1])#>>'{seasonRewards,0,kingXp,sovereign-02}')='10','READ_RPC_METADATA';
 assert not has_function_privilege('anon','public.kw_collection_award_season(uuid,uuid)','execute'),'PUBLIC_PRIZE_RPC';
 assert not has_function_privilege('authenticated','public.kw_collection_award_season(uuid,uuid)','execute'),'AUTHENTICATED_PRIZE_RPC';
end $$;
select jsonb_build_object('status','PASS','migration',73,'checks',array['complete ranking','late result pays all pending','18 Gemas broken down','one rare item','XP 30/10 assigned to original kings','selected king gets zero','frozen reign stats','replay','RPC receipt metadata','private permissions'],'cleanup','ROLLBACK follows') verification;
rollback;
