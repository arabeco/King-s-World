-- KingsWorld: join_code nos mundos
-- Permite jogadores entrarem por código (ex: KW-7X4K2M) em vez de lista.

alter table public.worlds
  add column if not exists join_code text unique;

create index if not exists worlds_join_code_idx
  on public.worlds(lower(join_code));

-- Gera código no formato KW-XXXXXX (6 chars alfanuméricos, sem 0/O/I/1 pra evitar confusão)
create or replace function public.generate_world_join_code()
returns text
language plpgsql
as $$
declare
  chars  text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code   text;
  exists boolean;
begin
  loop
    code := 'KW-';
    for i in 1..6 loop
      code := code || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    end loop;
    select count(*) > 0 into exists
    from public.worlds where lower(join_code) = lower(code);
    exit when not exists;
  end loop;
  return code;
end;
$$;
