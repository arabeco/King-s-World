-- =============================================================
-- KingsWorld #50 — REPOSIÇÃO AUTOMÁTICA DE CIDADES ABANDONADAS
-- Rodar no SQL Editor do Supabase APÓS o 49. Idempotente.
--
-- Problema: os NPCs (44) tomam as abandonadas com o tempo -> o mundo fica
-- sem alvos claimáveis pro jogador. Esta função completa de volta até 12 por
-- mundo (6 peq / 4 méd / 2 fort) e posiciona as novas no círculo (dist 14-37),
-- sem teleportar as já posicionadas. Agendada a cada 10 min via pg_cron.
--
-- Esperto: o Bloco B só reposiciona as RECÉM-criadas (coord temporária r>=45),
-- então rodar todo tick não embaralha as abandonadas existentes nem os NPCs.
-- =============================================================

create or replace function public.kw_abandoned_replenish()
returns void language plpgsql security definer set search_path=public, extensions as $$
declare
  v_world uuid; v_biome text; v_tile uuid; v_site uuid;
  v_have int; v_seed int; v_spawn_idx int;
  v_terr public.terrain_kind; v_tierrec record;
  v_rec record; v_q int; v_r int; v_angle double precision; v_radius double precision;
  v_hexdist int; v_try int; v_ok boolean;
  v_min_dist constant int := 5; v_r_inner constant int := 14; v_r_outer constant int := 34;
begin
  -- A) top-up até 12 (6 peq / 4 méd / 2 fort) — novas vão p/ coord temporária r>=45
  for v_world in select id from public.worlds where status='running' loop
    select coalesce((select biome_type from public.map_tiles where world_id=v_world limit 1),'plains') into v_biome;
    v_spawn_idx := 0;
    for v_tierrec in select * from (values
        ('pequena','neutral','Ruínas Abandonadas',6),
        ('media','posto_avancado','Vila Abandonada',4),
        ('fortaleza','bastiao','Fortaleza Abandonada',2)
      ) as x(tier,cls,nm,tgt)
    loop
      select count(*) into v_have from public.villages
       where world_id=v_world and origin_kind='abandoned_city' and owner_world_player_id is null
         and destroyed_at is null and city_class=v_tierrec.cls::public.city_class;
      while v_have < v_tierrec.tgt loop
        v_terr := (array['ashen_fields','riverlands','ironridge','frontier_pass','crown_heartland']::public.terrain_kind[])[1+(v_spawn_idx%5)];
        v_seed := 0;
        loop
          exit when not exists (select 1 from public.map_tiles t where t.world_id=v_world and t.q=(v_seed%20) and t.r=45+(v_seed/20));
          v_seed := v_seed+1; exit when v_seed>5000;
        end loop;
        insert into public.map_tiles (world_id,q,r,biome_type,terrain_type)
          values (v_world,(v_seed%20),45+(v_seed/20),v_biome,'normal') returning id into v_tile;
        insert into public.map_sites (world_id,tile_id,site_type,status)
          values (v_world,v_tile,'village','active') returning id into v_site;
        insert into public.villages
          (site_id,world_id,owner_world_player_id,founder_world_player_id,name,
           village_type,settlement_role,city_class,city_class_locked,
           origin_kind,terrain_kind,is_original_capital,capital_eligibility_status)
        values (v_site,v_world,null,null,v_tierrec.nm,'colony','Colonia',
           v_tierrec.cls::public.city_class,true,'abandoned_city',v_terr,false,'pending_review');
        insert into public.village_structure_states
          (world_id,world_player_id,village_site_id,structure_code,slot_a,slot_b,slot_c,slot_d)
        select v_world,null,v_site,sc.code,
          case v_tierrec.tier when 'fortaleza' then 3 when 'media' then 2 else 1 end,
          case v_tierrec.tier when 'fortaleza' then (case when sc.code='defense' then 3 else 2 end) when 'media' then 1 else 0 end,
          case v_tierrec.tier when 'fortaleza' then (case when sc.code='defense' then 3 else 2 end) when 'media' then 0 else 0 end,
          case v_tierrec.tier when 'fortaleza' then (case when sc.code='defense' then 1 else 0 end) when 'media' then 0 else 0 end
        from (values ('crown'),('economy'),('society'),('recruitment'),('defense')) as sc(code)
        on conflict (village_site_id,structure_code) do nothing;
        v_have := v_have+1; v_spawn_idx := v_spawn_idx+1;
      end loop;
    end loop;
  end loop;

  -- B) espalhar SÓ as recém-criadas (r>=45) no círculo; não mexe nas já posicionadas
  for v_rec in
    select t.id as tile_id, t.world_id
    from public.villages v
    join public.map_sites ms on ms.id=v.site_id
    join public.map_tiles t on t.id=ms.tile_id
    where v.origin_kind='abandoned_city' and v.owner_world_player_id is null and v.destroyed_at is null
      and t.r >= 45
      and v.world_id in (select id from public.worlds where status='running')
    order by random()
  loop
    v_ok := false;
    for v_try in 1..400 loop
      v_angle := random()*2*pi();
      v_radius := v_r_inner + random()*(v_r_outer-v_r_inner);
      v_q := round(v_radius*cos(v_angle)); v_r := round(v_radius*sin(v_angle));
      v_hexdist := (abs(v_q)+abs(v_r)+abs(v_q+v_r))/2;
      if v_hexdist < v_r_inner or v_hexdist > 37 then continue; end if;
      if not exists (select 1 from public.map_tiles t2
        where t2.world_id=v_rec.world_id and t2.id<>v_rec.tile_id
          and ((abs(t2.q-v_q)+abs((t2.q+t2.r)-(v_q+v_r))+abs(t2.r-v_r))/2) < v_min_dist) then
        v_ok := true; exit;
      end if;
    end loop;
    if v_ok then update public.map_tiles set q=v_q, r=v_r where id=v_rec.tile_id; end if;
  end loop;
end $$;

revoke all on function public.kw_abandoned_replenish() from public, anon, authenticated;
grant execute on function public.kw_abandoned_replenish() to service_role;

-- Agenda a cada 10 min (pg_cron; upsert por nome).
create extension if not exists pg_cron;
select cron.schedule('kw-abandoned-replenish','*/10 * * * *',$$select public.kw_abandoned_replenish();$$);

-- Conferência:
--   select jobname, schedule, active from cron.job where jobname='kw-abandoned-replenish';
--   select public.kw_abandoned_replenish();  -- roda na hora
--   select count(*) from public.villages v join public.worlds w on w.id=v.world_id and w.status='running'
--     where v.origin_kind='abandoned_city' and v.owner_world_player_id is null;  -- deve dar 12
-- =============================================================
