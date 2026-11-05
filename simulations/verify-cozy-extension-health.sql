-- Read-only post-migration check; never sends HTTP requests.
select net.check_worker_is_up();
select jsonb_build_object(
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'schema',n.nspname,'version',e.extversion)) from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname in ('citext','pg_net')),
 'pending_requests',(select count(*) from net.http_request_queue),
 'response_count',(select count(*) from net._http_response),
 'citext_type_oid','extensions.citext'::regtype::oid,
 'worker','PASS: check_worker_is_up completed'
) as health;
