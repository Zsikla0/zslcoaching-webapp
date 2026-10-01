create table if not exists public.client_goals (
  client_id uuid not null references auth.users(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  calories numeric,
  protein numeric,
  carbs numeric,
  fat numeric,
  steps integer,
  cardio_minutes integer,
  updated_at timestamptz not null default now(),
  primary key (client_id, coach_id),
  constraint client_goals_calories_nonnegative check (calories is null or calories >= 0),
  constraint client_goals_protein_nonnegative check (protein is null or protein >= 0),
  constraint client_goals_carbs_nonnegative check (carbs is null or carbs >= 0),
  constraint client_goals_fat_nonnegative check (fat is null or fat >= 0),
  constraint client_goals_steps_nonnegative check (steps is null or steps >= 0),
  constraint client_goals_cardio_nonnegative check (cardio_minutes is null or cardio_minutes >= 0)
);

alter table public.client_goals enable row level security;
grant select, insert, update on public.client_goals to authenticated;
revoke delete on public.client_goals from anon, authenticated;

drop policy if exists "Clients and connected coaches can read goals" on public.client_goals;
create policy "Clients and connected coaches can read goals"
  on public.client_goals
  for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or (
      coach_id = (select auth.uid())
      and exists (
        select 1
        from public.coach_clients as cc
        where cc.coach_id = (select auth.uid())
          and cc.client_id = client_goals.client_id
          and cc.status = 'accepted'
      )
    )
  );

drop policy if exists "Connected coaches can create client goals" on public.client_goals;
create policy "Connected coaches can create client goals"
  on public.client_goals
  for insert
  to authenticated
  with check (
    coach_id = (select auth.uid())
    and exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_goals.client_id
        and cc.status = 'accepted'
    )
  );

drop policy if exists "Connected coaches can update client goals" on public.client_goals;
create policy "Connected coaches can update client goals"
  on public.client_goals
  for update
  to authenticated
  using (
    coach_id = (select auth.uid())
    and exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_goals.client_id
        and cc.status = 'accepted'
    )
  )
  with check (
    coach_id = (select auth.uid())
    and exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_goals.client_id
        and cc.status = 'accepted'
    )
  );

create or replace function public.coach_save_client_goals(
  p_client_id uuid,
  p_calories numeric,
  p_protein numeric,
  p_carbs numeric,
  p_fat numeric,
  p_steps integer,
  p_cardio_minutes integer
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_coach_id uuid := auth.uid();
begin
  if v_coach_id is null then
    raise exception 'Jelentkezz be a célok mentéséhez.';
  end if;

  if not exists (
    select 1
    from public.coaches as c
    where c.user_id = v_coach_id
  ) then
    raise exception 'Edzői jogosultság szükséges.';
  end if;

  if not exists (
    select 1
    from public.coach_clients as cc
    where cc.coach_id = v_coach_id
      and cc.client_id = p_client_id
      and cc.status = 'accepted'
  ) then
    raise exception 'Ez a vendég nincs hozzád kapcsolva.';
  end if;

  insert into public.client_goals (
    client_id, coach_id, calories, protein, carbs, fat, steps, cardio_minutes, updated_at
  ) values (
    p_client_id, v_coach_id, p_calories, p_protein, p_carbs, p_fat, p_steps, p_cardio_minutes, now()
  )
  on conflict (client_id, coach_id) do update
  set calories = excluded.calories,
      protein = excluded.protein,
      carbs = excluded.carbs,
      fat = excluded.fat,
      steps = excluded.steps,
      cardio_minutes = excluded.cardio_minutes,
      updated_at = now();
end;
$$;

revoke all on function public.coach_save_client_goals(uuid, numeric, numeric, numeric, numeric, integer, integer) from public;
grant execute on function public.coach_save_client_goals(uuid, numeric, numeric, numeric, numeric, integer, integer) to authenticated;
