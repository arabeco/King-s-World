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
commit;
