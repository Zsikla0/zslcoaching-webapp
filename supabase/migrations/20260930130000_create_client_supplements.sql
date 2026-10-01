create table if not exists public.client_supplements (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  when_label text not null default '',
  day_type text not null default 'Edzésnap'
    check (day_type in ('Edzésnap', 'Pihenőnap')),
  supplement_name text not null,
  brand text not null default '',
  form text not null default '',
  dose text not null default '',
  unit text not null default '',
  purpose text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists client_supplements_client_id_created_at_idx
  on public.client_supplements (client_id, created_at);

alter table public.client_supplements enable row level security;
grant select, insert, update, delete on public.client_supplements to authenticated;
revoke all on public.client_supplements from anon;

drop policy if exists "Clients and connected coaches can read supplements"
  on public.client_supplements;
create policy "Clients and connected coaches can read supplements"
  on public.client_supplements
  for select
  to authenticated
  using (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_supplements.client_id
        and cc.status = 'accepted'
    )
  );

drop policy if exists "Clients and connected coaches can add supplements"
  on public.client_supplements;
create policy "Clients and connected coaches can add supplements"
  on public.client_supplements
  for insert
  to authenticated
  with check (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_supplements.client_id
        and cc.status = 'accepted'
    )
  );

drop policy if exists "Clients and connected coaches can update supplements"
  on public.client_supplements;
create policy "Clients and connected coaches can update supplements"
  on public.client_supplements
  for update
  to authenticated
  using (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_supplements.client_id
        and cc.status = 'accepted'
    )
  )
  with check (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_supplements.client_id
        and cc.status = 'accepted'
    )
  );

drop policy if exists "Clients and connected coaches can delete supplements"
  on public.client_supplements;
create policy "Clients and connected coaches can delete supplements"
  on public.client_supplements
  for delete
  to authenticated
  using (
    client_id = (select auth.uid())
    or exists (
      select 1
      from public.coach_clients as cc
      where cc.coach_id = (select auth.uid())
        and cc.client_id = client_supplements.client_id
        and cc.status = 'accepted'
    )
  );
