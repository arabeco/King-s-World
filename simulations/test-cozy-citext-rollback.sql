-- Move the extension while preserving type OIDs, data and uniqueness constraints.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';
do $$
declare original_schema text; original_type oid;
begin
 select n.nspname into original_schema from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='citext';
 if original_schema not in ('public','extensions') or original_schema is null then raise exception 'Unexpected citext installation'; end if;
 if has_schema_privilege('anon','extensions','create') or has_schema_privilege('authenticated','extensions','create') then raise exception 'Extension schema allows client creation'; end if;
 select t.oid into original_type from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname=original_schema and t.typname='citext';
 if original_schema='public' then alter extension citext set schema extensions; end if;
 if (select 'extensions.citext'::regtype::oid)<>original_type then raise exception 'citext type identity changed'; end if;
end $$;
notify pgrst,'reload schema';

set local search_path=public,extensions,pg_temp;
do $$
declare uname extensions.citext; mail extensions.citext;
begin
 select username,email into uname,mail from public.users order by id limit 1;
 if uname is null then raise exception 'Need existing profile for case-insensitive test'; end if;
 if not (uname = upper(uname::text)::extensions.citext) then raise exception 'Username comparison became case-sensitive'; end if;
 if not exists(select 1 from public.users where email=upper(mail::text)::extensions.citext) then raise exception 'Email comparison became case-sensitive'; end if;
 begin
  insert into public.users(username,email) values(upper(uname::text)::extensions.citext,'citext-qa-'||gen_random_uuid()::text||'@example.invalid');
  raise exception 'Case-insensitive username uniqueness lost';
 exception when unique_violation then null;
 end;
end $$;

rollback;
select 'PASS: citext move, type identity, case-insensitive username/email and unique constraints; rolled back' as result;
