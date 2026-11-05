begin;
create or replace function public.grant_kw_entitlement(
 p_user_id uuid,p_provider text,p_product_id text,p_purchase_token text,p_order_id text default null,
 p_status text default 'active',p_store_environment text default 'production',p_started_at timestamptz default null,
 p_expires_at timestamptz default null,p_auto_renewing boolean default false,p_will_renew boolean default false,p_raw_payload jsonb default '{}'::jsonb
) returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare saved public.user_entitlements%rowtype;duplicate boolean;
begin
 if not exists(select 1 from public.users u where id=p_user_id and coalesce(to_jsonb(u)->>'account_status','active')='active' and to_jsonb(u)->>'deletion_requested_at' is null) then raise exception 'APP_USER_REQUIRED';end if;
 if p_provider is distinct from 'google_play' then raise exception 'INVALID_PROVIDER';end if;
 if p_product_id is distinct from 'premium_monthly' then raise exception 'PRODUCT_ID_REQUIRED';end if;
 if nullif(trim(p_purchase_token),'') is null or length(p_purchase_token)>8192 then raise exception 'TOKEN_REQUIRED';end if;
 if p_status is null or p_status not in ('active','grace_period','on_hold','paused','expired','canceled','revoked','pending') then raise exception 'INVALID_STATUS';end if;
 if p_store_environment is null or p_store_environment not in ('sandbox','production') then raise exception 'INVALID_ENVIRONMENT';end if;
 if p_status in ('active','grace_period','canceled') and p_expires_at is null then raise exception 'EXPIRY_REQUIRED';end if;
 -- Lock also covers the first insert; FOR UPDATE alone cannot lock a missing row.
 perform pg_advisory_xact_lock(hashtextextended(p_provider||':'||p_purchase_token,0));
 select * into saved from public.user_entitlements where provider=p_provider and purchase_token=p_purchase_token for update;
 duplicate:=found;
 if duplicate and saved.user_id<>p_user_id then raise exception 'TOKEN_ALREADY_USED_BY_ANOTHER_USER';end if;
 if duplicate and saved.product_id<>p_product_id then raise exception 'TOKEN_PRODUCT_CONFLICT';end if;
 if duplicate then
  update public.user_entitlements set status=p_status,expires_at=p_expires_at,auto_renewing=p_auto_renewing,will_renew=p_will_renew,
   last_verified_at=now(),raw_payload=p_raw_payload,order_id=p_order_id,store_environment=p_store_environment
   where id=saved.id returning * into saved;
 else
  insert into public.user_entitlements(user_id,provider,product_id,purchase_token,order_id,status,store_environment,started_at,expires_at,auto_renewing,will_renew,last_verified_at,raw_payload)
  values(p_user_id,p_provider,p_product_id,p_purchase_token,p_order_id,p_status,p_store_environment,p_started_at,p_expires_at,p_auto_renewing,p_will_renew,now(),p_raw_payload) returning * into saved;
 end if;
 return jsonb_build_object('success',true,'duplicate',duplicate,'id',saved.id,'status',saved.status,'expires_at',saved.expires_at);
end $$;
revoke all on function public.grant_kw_entitlement(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean,jsonb) from public,anon,authenticated;
grant execute on function public.grant_kw_entitlement(uuid,text,text,text,text,text,text,timestamptz,timestamptz,boolean,boolean,jsonb) to service_role;
commit;
