begin;
create table if not exists public.kw_collection_catalog(product_id text primary key,kind text not null check(kind in ('king','crest','equipment')),gem_price integer not null check(gem_price>=0),starter boolean not null default false,on_sale boolean not null default false);
create table if not exists public.kw_player_wallet(user_id uuid primary key references public.users(id) on delete cascade,gems integer not null default 0 check(gems>=0));
create table if not exists public.kw_player_inventory(user_id uuid references public.users(id) on delete cascade,product_id text references public.kw_collection_catalog(product_id),xp integer not null default 0 check(xp>=0),source text not null,acquired_at timestamptz not null default now(),primary key(user_id,product_id));
create table if not exists public.kw_gem_transactions(user_id uuid references public.users(id) on delete cascade,request_id text not null,product_id text not null references public.kw_collection_catalog(product_id),delta integer not null,balance_after integer not null check(balance_after>=0),created_at timestamptz not null default now(),primary key(user_id,request_id));
alter table public.kw_collection_catalog enable row level security;
revoke all on public.kw_collection_catalog from public,anon,authenticated;
grant select,insert,update on public.kw_collection_catalog to service_role;
alter table public.kw_player_wallet enable row level security;
revoke all on public.kw_player_wallet from public,anon,authenticated;
grant select,insert,update on public.kw_player_wallet to service_role;
alter table public.kw_player_inventory enable row level security;
revoke all on public.kw_player_inventory from public,anon,authenticated;
grant select,insert,update on public.kw_player_inventory to service_role;
alter table public.kw_gem_transactions enable row level security;
revoke all on public.kw_gem_transactions from public,anon,authenticated;
grant select,insert,update on public.kw_gem_transactions to service_role;
insert into public.kw_collection_catalog(product_id,kind,gem_price,starter,on_sale) values
('sovereign-01','king',0,true,false),
('sovereign-02','king',0,true,false),
('sovereign-03','king',0,true,false),
('sovereign-04','king',0,true,false),
('sovereign-05','king',50,false,true),
('sovereign-06','king',50,false,true),
('sovereign-07','king',50,false,true),
('sovereign-08','king',50,false,true),
('sovereign-09','king',50,false,true),
('sovereign-10','king',50,false,true),
('sovereign-11','king',50,false,true),
('sovereign-12','king',50,false,true),
('sovereign-13','king',100,false,true),
('sovereign-14','king',100,false,true),
('sovereign-15','king',100,false,true),
('sovereign-16','king',100,false,true),
('sovereign-17','king',100,false,true),
('sovereign-18','king',100,false,true),
('sovereign-19','king',200,false,true),
('sovereign-20','king',200,false,true),
('sovereign-21','king',250,false,true),
('sovereign-22','king',250,false,true),
('empire-crest-01','crest',0,true,false),
('empire-crest-02','crest',0,true,false),
('empire-crest-03','crest',0,true,false),
('empire-crest-04','crest',0,true,false),
('empire-crest-05','crest',0,true,false),
('empire-crest-06','crest',0,true,false),
('empire-crest-07','crest',0,true,false),
('empire-crest-08','crest',0,true,false),
('empire-crest-09','crest',0,true,false),
('empire-crest-10','crest',0,true,false),
('empire-crest-11','crest',0,true,false),
('empire-crest-12','crest',0,true,false),
('empire-crest-13','crest',0,true,false),
('empire-crest-14','crest',0,true,false),
('empire-crest-15','crest',0,true,false),
('empire-crest-16','crest',0,true,false),
('empire-crest-17','crest',0,true,false),
('empire-crest-18','crest',0,true,false),
('empire-crest-19','crest',0,true,false),
('empire-crest-20','crest',0,true,false),
('premium-griffin','crest',75,false,true),
('extra-dragon','crest',75,false,true),
('premium-phoenix','crest',75,false,true),
('extra-hippocampus','crest',75,false,true),
('extra-crowned-serpent','crest',75,false,true),
('extra-winged-lion','crest',75,false,true),
('item-craft-ledger','equipment',0,true,false),
('item-guard-crest','equipment',0,true,false),
('item-travel-compass','equipment',0,true,false),
('item-seed-sack','equipment',0,false,false),
('item-master-hammer','equipment',0,false,false),
('item-watch-standard','equipment',0,false,false),
('item-road-map','equipment',0,false,false),
('item-granary-seal','equipment',0,false,false),
('item-patrol-horn','equipment',0,false,false),
('item-steward-ledger','equipment',0,false,false),
('item-cartographer-divider','equipment',0,false,false),
('item-frontier-shield','equipment',0,false,false),
('item-builder-tools','equipment',0,false,false),
('item-harvest-coffer','equipment',0,false,false),
('item-journey-crown','equipment',0,false,false)
on conflict(product_id) do update set kind=excluded.kind,gem_price=excluded.gem_price,starter=excluded.starter,on_sale=excluded.on_sale;
create or replace function public.kw_collection_bootstrap(p_user_id uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform 1 from public.users where id=p_user_id and coalesce(to_jsonb(users)->>'account_status','active')='active' and to_jsonb(users)->>'deletion_requested_at' is null for update;
 if not found then raise exception 'COZY_ACCOUNT_UNAVAILABLE';end if;
 insert into public.kw_player_wallet(user_id) values(p_user_id) on conflict do nothing;
 insert into public.kw_player_inventory(user_id,product_id,source) select p_user_id,product_id,'starter' from public.kw_collection_catalog where starter on conflict do nothing;
end $$;
create or replace function public.kw_collection_read(p_user_id uuid) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
begin
 perform public.kw_collection_bootstrap(p_user_id);
 return jsonb_build_object('gems',(select gems from public.kw_player_wallet where user_id=p_user_id),'inventory',coalesce((select jsonb_agg(jsonb_build_object('id',i.product_id,'xp',i.xp,'source',i.source)) from public.kw_player_inventory i where i.user_id=p_user_id),'[]'::jsonb),'selectedId',coalesce((select appearance_id from public.kw_account_appearance where user_id=p_user_id),'sovereign-01'));
end $$;
create or replace function public.kw_collection_buy(p_user_id uuid,p_product_id text,p_request_id text) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare product public.kw_collection_catalog%rowtype; old_product text; balance integer;
begin
 if p_request_id is null or length(p_request_id) not between 8 and 128 then raise exception 'COLLECTION_INVALID_REQUEST';end if;
 perform public.kw_collection_bootstrap(p_user_id);
 select product_id into old_product from public.kw_gem_transactions where user_id=p_user_id and request_id=p_request_id;
 if found then if old_product<>p_product_id then raise exception 'COLLECTION_REQUEST_REUSED';end if;return public.kw_collection_read(p_user_id);end if;
 select * into product from public.kw_collection_catalog where product_id=p_product_id;
 if not found or not product.on_sale or product.gem_price<=0 then raise exception 'COLLECTION_NOT_FOR_SALE';end if;
 if exists(select 1 from public.kw_player_inventory where user_id=p_user_id and product_id=p_product_id) then raise exception 'COLLECTION_ALREADY_OWNED';end if;
 update public.kw_player_wallet set gems=gems-product.gem_price where user_id=p_user_id and gems>=product.gem_price returning gems into balance;
 if not found then raise exception 'COLLECTION_INSUFFICIENT_GEMS';end if;
 insert into public.kw_player_inventory(user_id,product_id,source) values(p_user_id,p_product_id,'gems');
 insert into public.kw_gem_transactions(user_id,request_id,product_id,delta,balance_after) values(p_user_id,p_request_id,p_product_id,-product.gem_price,balance);
 return public.kw_collection_read(p_user_id);
end $$;
-- Upgrade selection validation from starter-only to owned kings, retaining revision checks.
alter table public.kw_account_appearance drop constraint if exists kw_account_appearance_appearance_id_check;
create or replace function public.kw_account_appearance_save(p_user_id uuid,p_appearance_id text,p_expected_revision bigint) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.kw_account_appearance%rowtype;
begin
 perform public.kw_collection_bootstrap(p_user_id);
 if not exists(select 1 from public.kw_player_inventory i join public.kw_collection_catalog c on c.product_id=i.product_id where i.user_id=p_user_id and i.product_id=p_appearance_id and c.kind='king') then raise exception 'APPEARANCE_LOCKED';end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'APPEARANCE_REVISION_CONFLICT';end if;
 select * into current_row from public.kw_account_appearance where user_id=p_user_id;
 if (not found and p_expected_revision<>0) or (found and current_row.revision<>p_expected_revision) then raise exception 'APPEARANCE_REVISION_CONFLICT';end if;
 insert into public.kw_account_appearance(user_id,appearance_id) values(p_user_id,p_appearance_id) on conflict(user_id) do update set appearance_id=excluded.appearance_id,revision=kw_account_appearance.revision+1,updated_at=now() returning * into current_row;
 return to_jsonb(current_row)-'user_id'-'updated_at';
end $$;
revoke all on function public.kw_collection_bootstrap(uuid) from public,anon,authenticated;
grant execute on function public.kw_collection_bootstrap(uuid) to service_role;
revoke all on function public.kw_collection_read(uuid) from public,anon,authenticated;
grant execute on function public.kw_collection_read(uuid) to service_role;
revoke all on function public.kw_collection_buy(uuid,text,text) from public,anon,authenticated;
grant execute on function public.kw_collection_buy(uuid,text,text) to service_role;
-- No season-end XP payout or account-XP conversion belongs in this migration.
-- Individual king XP will come from authoritative gameplay events.
drop trigger if exists kw_collection_king_xp on public.kw_cozy_rewards;
commit;
