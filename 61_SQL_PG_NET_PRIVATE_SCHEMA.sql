-- Reinstall the same pg_net version outside public without losing HTTP history.
-- Empty-queue guard and RESTRICT protect requests and external dependencies.
begin;
set local lock_timeout='5s';
set local statement_timeout='45s';

create temporary view kw_net_metadata as
select 'schema' kind,nspname name,pg_get_userbyid(nspowner) owner,coalesce(nspacl::text,'') acl from pg_namespace where nspname='net'
union all select c.relkind::text,c.relname,pg_get_userbyid(c.relowner),coalesce(c.relacl::text,'') from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='net'
union all select 'function',p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',pg_get_userbyid(p.proowner),coalesce(p.proacl::text,'') from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='net';

do $$
declare installed_schema text; installed_version text; metadata_before jsonb; metadata_after jsonb;
        history jsonb; request_sequence bigint; sequence_called boolean;
begin
 select n.nspname,e.extversion into installed_schema,installed_version from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='pg_net';
 if installed_schema='extensions' then return; end if;
 if installed_schema is distinct from 'public' or installed_version is distinct from '0.20.0' then
   raise exception 'Unexpected pg_net installation; review before changing';
 end if;
 lock table net.http_request_queue,net._http_response in access exclusive mode;
 if exists(select 1 from net.http_request_queue) then raise exception 'Pending HTTP requests; leave pg_net unchanged'; end if;
 select jsonb_agg(to_jsonb(m) order by kind,name) into metadata_before from kw_net_metadata m;
 select jsonb_agg(to_jsonb(r) order by id) into history from net._http_response r;
 select last_value,is_called into request_sequence,sequence_called from net.http_request_queue_id_seq;
 drop extension pg_net;
 create extension pg_net with schema extensions version '0.20.0';
 insert into net._http_response select * from jsonb_populate_recordset(null::net._http_response,history);
 perform setval('net.http_request_queue_id_seq',request_sequence,sequence_called);
 select jsonb_agg(to_jsonb(m) order by kind,name) into metadata_after from kw_net_metadata m;
 if metadata_before is distinct from metadata_after then raise exception 'pg_net ownership or permissions changed'; end if;
 if (select jsonb_agg(to_jsonb(r) order by id) from net._http_response r) is distinct from history then raise exception 'pg_net response history changed'; end if;
end $$;

drop view kw_net_metadata;
notify pgrst,'reload schema';
commit;
