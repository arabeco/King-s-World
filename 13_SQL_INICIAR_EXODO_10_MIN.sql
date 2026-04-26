update public.worlds
set
  status = 'running',
  runtime_started = true,
  runtime_real_time_enabled = true,
  runtime_anchor_day = 1,
  runtime_anchor_started_at = now(),
  day_number = 1,
  updated_at = now()
where slug = 'exodo';
