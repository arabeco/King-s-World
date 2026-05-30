-- =============================================================
-- KingsWorld: RPC grant_kw_entitlement
-- Idempotente, com FOR UPDATE lock para prevenir race condition
-- em retries simultâneos. Apenas service_role pode executar.
-- Rodar no Supabase SQL Editor após o schema do arquivo 11.
-- =============================================================

create or replace function public.grant_kw_entitlement(
  p_user_id          uuid,
  p_provider         text,
  p_product_id       text,
  p_purchase_token   text,
  p_order_id         text       default null,
  p_status           text       default 'active',
  p_store_environment text      default 'production',
  p_started_at       timestamptz default null,
  p_expires_at       timestamptz default null,
  p_auto_renewing    boolean    default false,
  p_will_renew       boolean    default false,
  p_raw_payload      jsonb      default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_existing public.user_entitlements%rowtype;
  v_result   public.user_entitlements%rowtype;
begin
  -- Validações básicas
  if p_user_id is null then
    raise exception 'USER_REQUIRED';
  end if;
  if nullif(trim(p_purchase_token), '') is null then
    raise exception 'TOKEN_REQUIRED';
  end if;
  if nullif(trim(p_product_id), '') is null then
    raise exception 'PRODUCT_ID_REQUIRED';
  end if;
  if p_provider not in ('google_play') then
    raise exception 'INVALID_PROVIDER';
  end if;

  -- Tenta pegar o registro existente com lock (previne race em retries)
  select * into v_existing
  from public.user_entitlements
  where provider       = p_provider
    and purchase_token = p_purchase_token
  for update;

  if found then
    -- Token já existe — idempotência
    if v_existing.user_id <> p_user_id then
      raise exception 'TOKEN_ALREADY_USED_BY_ANOTHER_USER';
    end if;

    -- Atualiza last_verified_at e status (pode ter mudado no Google)
    update public.user_entitlements
    set status           = p_status,
        expires_at       = p_expires_at,
        auto_renewing    = p_auto_renewing,
        will_renew       = p_will_renew,
        last_verified_at = now(),
        raw_payload      = p_raw_payload
    where id = v_existing.id
    returning * into v_result;

    return jsonb_build_object(
      'success',    true,
      'duplicate',  true,
      'id',         v_result.id,
      'status',     v_result.status,
      'expires_at', v_result.expires_at
    );
  end if;

  -- Novo token — insere
  insert into public.user_entitlements (
    user_id, provider, product_id, purchase_token,
    order_id, status, store_environment,
    started_at, expires_at, auto_renewing, will_renew,
    last_verified_at, raw_payload
  ) values (
    p_user_id, p_provider, p_product_id, p_purchase_token,
    p_order_id, p_status, p_store_environment,
    p_started_at, p_expires_at, p_auto_renewing, p_will_renew,
    now(), p_raw_payload
  )
  returning * into v_result;

  return jsonb_build_object(
    'success',    true,
    'duplicate',  false,
    'id',         v_result.id,
    'status',     v_result.status,
    'expires_at', v_result.expires_at
  );
end;
$$;

-- Segurança: apenas service_role pode chamar
revoke all on function public.grant_kw_entitlement from public, authenticated, anon;
grant execute on function public.grant_kw_entitlement to service_role;
