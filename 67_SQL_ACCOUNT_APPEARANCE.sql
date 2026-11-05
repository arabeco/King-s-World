begin;
create table if not exists public.kw_account_appearance (
 user_id uuid primary key references public.users(id) on delete cascade,
 appearance_id text not null default 'sovereign-01' check(appearance_id ~ '^sovereign-0[1-4]$'),
 revision bigint not null default 1,
 updated_at timestamptz not null default now()
);
alter table public.kw_account_appearance enable row level security;
revoke all on public.kw_account_appearance from public,anon,authenticated;
grant select,insert,update on public.kw_account_appearance to service_role;
create or replace function public.kw_account_appearance_save(p_user_id uuid,p_appearance_id text,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare current_row public.kw_account_appearance%rowtype;
begin
 perform 1 from public.users where id=p_user_id and coalesce(to_jsonb(users)->>'account_status','active')='active' and to_jsonb(users)->>'deletion_requested_at' is null for update;
 if not found then raise exception 'COZY_ACCOUNT_UNAVAILABLE'; end if;
 if p_appearance_id is null or p_appearance_id !~ '^sovereign-0[1-4]$' then raise exception 'APPEARANCE_LOCKED'; end if;
 if p_expected_revision is null or p_expected_revision<0 then raise exception 'APPEARANCE_REVISION_CONFLICT'; end if;
 select * into current_row from public.kw_account_appearance where user_id=p_user_id;
 if (not found and p_expected_revision<>0) or (found and current_row.revision<>p_expected_revision) then raise exception 'APPEARANCE_REVISION_CONFLICT'; end if;
 insert into public.kw_account_appearance(user_id,appearance_id) values(p_user_id,p_appearance_id)
 on conflict(user_id) do update set appearance_id=excluded.appearance_id,revision=kw_account_appearance.revision+1,updated_at=now()
 returning * into current_row;
 return to_jsonb(current_row)-'user_id'-'updated_at';
end $$;
revoke all on function public.kw_account_appearance_save(uuid,text,bigint) from public,anon,authenticated;
grant execute on function public.kw_account_appearance_save(uuid,text,bigint) to service_role;
commit;
