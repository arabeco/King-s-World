-- Read-only inventory. No queue URLs, response bodies, cron commands or auth secrets.
select jsonb_build_object(
 'pending_requests',(select count(*) from net.http_request_queue),
 'responses',(select count(*) from net._http_response),
 'extensions',(select jsonb_agg(jsonb_build_object('name',e.extname,'version',e.extversion,'schema',n.nspname,'relocatable',e.extrelocatable,'owner',pg_get_userbyid(e.extowner))) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
 'external_dependencies',(select coalesce(jsonb_agg(distinct jsonb_build_object('extension',e.extname,'object',pg_describe_object(d.classid,d.objid,d.objsubid),'depends_on',pg_describe_object(m.classid,m.objid,m.objsubid))), '[]'::jsonb)
   from pg_extension e join pg_depend m on m.refclassid='pg_extension'::regclass and m.refobjid=e.oid and m.deptype='e'
   join pg_depend d on d.refclassid=m.classid and d.refobjid=m.objid
   where e.extname in ('citext','pg_net') and d.deptype not in ('i','e')
   and not exists(select 1 from pg_depend own where own.classid=d.classid and own.objid=d.objid and own.refclassid='pg_extension'::regclass and own.refobjid=e.oid and own.deptype='e')),
 'candidate_functions',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'config',p.proconfig,'owner',pg_get_userbyid(p.proowner),'body_hash',md5(p.prosrc),'definition',pg_get_functiondef(p.oid))), '[]'::jsonb)
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' and p.prosrc ~* '(citext|public\.users|net\.|pg_net)'),
 'citext_columns',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'column',a.attname,'type_oid',a.atttypid)) from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace join pg_type t on t.oid=a.atttypid where t.typname='citext' and a.attnum>0 and not a.attisdropped),
 'settings',(select jsonb_agg(jsonb_build_object('role',r.rolname,'database',s.setdatabase,'config',s.setconfig)) from pg_db_role_setting s left join pg_roles r on r.oid=s.setrole),
 'schemas',(select jsonb_agg(jsonb_build_object('name',n.nspname,'owner',pg_get_userbyid(n.nspowner),'acl',n.nspacl)) from pg_namespace n where n.nspname in ('public','extensions','net'))
) as audit;
