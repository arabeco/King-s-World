update public.worlds
set
  day_number = least(
    120,
    runtime_anchor_day + floor(extract(epoch from (now() - runtime_anchor_started_at)) / 600)::int
  ),
  runtime_anchor_day = least(
    120,
    runtime_anchor_day + floor(extract(epoch from (now() - runtime_anchor_started_at)) / 600)::int
  ),
  runtime_anchor_started_at = null,
  runtime_real_time_enabled = false,
  updated_at = now()
where slug = 'exodo'
  and runtime_started = true
  and runtime_real_time_enabled = true
  and runtime_anchor_started_at is not null;
