-- =============================================================
-- KingsWorld #53 — RE-ESPALHAR O MAPA (conserta a "linha colada")
-- Rodar no SQL Editor. Idempotente. Funciona com o mundo CONGELADO ('open')
-- porque mira o mundo por ID (não por status='running').
--
-- Causa da linha: ~49 NPCs + 12 abandonadas não cabiam no anel estreito (14-37,
-- dist mín 5) -> placement falhava -> entidades ficavam na coord temporária
-- (r>=45), clampadas na borda = linha diagonal colada.
--
-- Fix: anel LARGO + placement GARANTIDO (relaxa a dist mínima 5->2 se preciso),
-- então TODA entidade entra no anel, nada sobra na coord temp.
--   * NPCs:        dist 12..39 (longe do centro)
--   * Abandonadas: dist 6..39  (podem ficar mais pro centro também)
-- =============================================================
do $$
declare
  v_world    uuid := 'b8b32ba3-07b6-464b-b283-7774fd04aafb';  -- Alpha Expresso
  v_rec      record;
  v_q int; v_r int; v_angle double precision; v_radius double precision;
  v_hexdist int; v_try int; v_ok boolean; v_md int;
  v_inner int;
begin
  for v_rec in
    select tile_id, world_id, tipo from (
      -- capitais de NPC
      select t.id as tile_id, t.world_id, 'npc' as tipo
      from public.world_players wp
      join public.villages v   on v.owner_world_player_id = wp.id
      join public.map_sites ms on ms.id = v.site_id
      join public.map_tiles t  on t.id = ms.tile_id
      where wp.is_ai = true and wp.world_id = v_world
      union all
      -- abandonadas (sem dono)
      select t.id as tile_id, t.world_id, 'abandonada' as tipo
      from public.villages v
      join public.map_sites ms on ms.id = v.site_id
      join public.map_tiles t  on t.id = ms.tile_id
      where v.origin_kind = 'abandoned_city' and v.owner_world_player_id is null
        and v.destroyed_at is null and v.world_id = v_world
    ) alvos
    order by random()
  loop
    v_inner := case when v_rec.tipo = 'npc' then 12 else 6 end;
    v_ok := false;
    -- placement GARANTIDO: tenta dist mínima 5, depois afrouxa 4,3,2
    for v_md in reverse 5..2 loop
      for v_try in 1..250 loop
        v_angle  := random() * 2 * pi();
        v_radius := v_inner + random() * (39 - v_inner);
        v_q := round(v_radius * cos(v_angle));
        v_r := round(v_radius * sin(v_angle));
        v_hexdist := (abs(v_q) + abs(v_r) + abs(v_q + v_r)) / 2;
        if v_hexdist > 39 or v_hexdist < v_inner then
          continue;
        end if;
        if not exists (
          select 1 from public.map_tiles t2
          where t2.world_id = v_world and t2.id <> v_rec.tile_id
            and ((abs(t2.q - v_q) + abs((t2.q + t2.r) - (v_q + v_r)) + abs(t2.r - v_r)) / 2) < v_md
        ) then
          v_ok := true; exit;
        end if;
      end loop;
      exit when v_ok;
    end loop;
    if v_ok then
      update public.map_tiles set q = v_q, r = v_r where id = v_rec.tile_id;
    end if;
  end loop;
end $$;

-- ---- PARTE B: atualiza a reposição automática (alvo 8, anel 6-39, garantido)
create or replace function public.kw_abandoned_replenish()
returns void language plpgsql security definer set search_path=public, extensions as $$
declare
  v_world uuid; v_biome text; v_tile uuid; v_site uuid;
  v_have int; v_seed int; v_spawn_idx int;
  v_terr public.terrain_kind; v_tierrec record;
  v_rec record; v_q int; v_r int; v_angle double precision; v_radius double precision;
  v_hexdist int; v_try int; v_ok boolean; v_md int;
begin
  -- A) top-up até 8 (4 peq / 3 méd / 1 fort) por mundo running
  for v_world in select id from public.worlds where status='running' loop
    select coalesce((select biome_type from public.map_tiles where world_id=v_world limit 1),'plains') into v_biome;
    v_spawn_idx := 0;
    for v_tierrec in select * from (values
        ('pequena','neutral','Ruínas Abandonadas',4),
        ('media','posto_avancado','Vila Abandonada',3),
        ('fortaleza','bastiao','Fortaleza Abandonada',1)
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

  -- B) espalha só as recém-criadas (r>=45), anel 6-39, placement GARANTIDO
  for v_rec in
    select t.id as tile_id, t.world_id
    from public.villages v
    join public.map_sites ms on ms.id=v.site_id
    join public.map_tiles t on t.id=ms.tile_id
    where v.origin_kind='abandoned_city' and v.owner_world_player_id is null and v.destroyed_at is null
      and t.r >= 45 and v.world_id in (select id from public.worlds where status='running')
    order by random()
  loop
    v_ok := false;
    for v_md in reverse 5..2 loop
      for v_try in 1..250 loop
        v_angle := random()*2*pi(); v_radius := 6 + random()*33;
        v_q := round(v_radius*cos(v_angle)); v_r := round(v_radius*sin(v_angle));
        v_hexdist := (abs(v_q)+abs(v_r)+abs(v_q+v_r))/2;
        if v_hexdist > 39 or v_hexdist < 6 then continue; end if;
        if not exists (select 1 from public.map_tiles t2
          where t2.world_id=v_rec.world_id and t2.id<>v_rec.tile_id
            and ((abs(t2.q-v_q)+abs((t2.q+t2.r)-(v_q+v_r))+abs(t2.r-v_r))/2) < v_md) then
          v_ok := true; exit;
        end if;
      end loop;
      exit when v_ok;
    end loop;
    if v_ok then update public.map_tiles set q=v_q, r=v_r where id=v_rec.tile_id; end if;
  end loop;
end $$;

-- Conferência (nada deve ter dist > 40 nem < 6; sem cluster):
--   select case when v.owner_world_player_id is null then 'ABANDONADA' else 'NPC' end tipo,
--          (abs(t.q)+abs(t.r)+abs(t.q+t.r))/2 dist
--   from public.villages v
--   join public.map_sites ms on ms.id=v.site_id
--   join public.map_tiles t on t.id=ms.tile_id
--   where v.world_id='b8b32ba3-07b6-464b-b283-7774fd04aafb'
--     and (v.origin_kind='abandoned_city' or v.owner_world_player_id in
--          (select id from public.world_players where is_ai))
--   order by dist desc;
-- =============================================================
