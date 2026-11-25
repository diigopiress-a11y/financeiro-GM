-- RM | Migração de permissões, equipe e escala de sábado
-- Execute no Supabase SQL Editor depois de já ter executado supabase/schema.sql.
-- Esta migração é aditiva: preserva os registros existentes.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to service_role;

-- Dados de equipe controlados exclusivamente pelo administrador.
alter table public.employees
  add column if not exists daily_rate integer not null default 120
    check (daily_rate in (120, 150));

alter table public.employees
  add column if not exists effective_from date not null default current_date;

-- Identificadores de login internos. O e-mail real/interno nunca é consultado
-- diretamente pelo navegador; somente funções server-side com service_role.
create table if not exists private.login_aliases (
  username_normalized text primary key
    check (username_normalized = lower(trim(username_normalized))),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists private.user_security (
  user_id uuid primary key references auth.users(id) on delete cascade,
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);

revoke all on private.login_aliases, private.user_security from public, anon, authenticated;
grant select, insert, update, delete on private.login_aliases, private.user_security to service_role;

-- Escala do sábado: pode ser preenchida antecipadamente na sexta-feira.
create table if not exists public.saturday_schedules (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null,
  work_date date not null check (extract(isodow from work_date) = 6),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (branch_id, company_id) references public.branches(id, company_id),
  unique (branch_id, work_date),
  unique (id, company_id, branch_id)
);

create table if not exists public.saturday_schedule_members (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null,
  employee_id uuid not null,
  company_id uuid not null,
  branch_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (schedule_id, company_id, branch_id)
    references public.saturday_schedules(id, company_id, branch_id) on delete cascade,
  foreign key (employee_id, branch_id, company_id)
    references public.employees(id, branch_id, company_id) on delete cascade,
  unique (schedule_id, employee_id)
);

create index if not exists saturday_schedules_branch_date_idx
  on public.saturday_schedules(branch_id, work_date);
create index if not exists saturday_members_schedule_idx
  on public.saturday_schedule_members(schedule_id);

alter table public.saturday_schedules enable row level security;
alter table public.saturday_schedule_members enable row level security;

create policy "branch members read saturday schedules"
on public.saturday_schedules for select
using (public.can_access_branch(company_id, branch_id));

create policy "branch members create saturday schedules"
on public.saturday_schedules for insert
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members update saturday schedules"
on public.saturday_schedules for update
using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members delete saturday schedules"
on public.saturday_schedules for delete
using (public.can_access_branch(company_id, branch_id));

create policy "branch members read saturday members"
on public.saturday_schedule_members for select
using (public.can_access_branch(company_id, branch_id));

create policy "branch members create saturday members"
on public.saturday_schedule_members for insert
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members update saturday members"
on public.saturday_schedule_members for update
using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members delete saturday members"
on public.saturday_schedule_members for delete
using (public.can_access_branch(company_id, branch_id));

-- Responsáveis de filial não podem cadastrar, editar ou excluir funcionários.
drop policy if exists "branch members insert employees" on public.employees;
drop policy if exists "branch members update employees" on public.employees;
drop policy if exists "admins insert employees" on public.employees;
drop policy if exists "admins update employees" on public.employees;
drop policy if exists "admins delete employees" on public.employees;

create policy "admins insert employees" on public.employees
for insert with check (public.is_company_admin(company_id));

create policy "admins update employees" on public.employees
for update using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "admins delete employees" on public.employees
for delete using (public.is_company_admin(company_id));

-- Cria a empresa e as duas filiais de forma idempotente.
insert into public.companies (name)
select 'RM'
where not exists (select 1 from public.companies where lower(name) = 'rm');

insert into public.branches (company_id, name)
select c.id, b.name
from public.companies c
cross join (values ('JUÍNA'), ('RODOTEC')) as b(name)
where lower(c.name) = 'rm'
on conflict (company_id, name) do nothing;

-- Vincula as contas já criadas no Supabase Auth aos respectivos acessos.
-- Se alguma conta ainda não existir, ela será vinculada quando for criada.
with rm as (
  select id as company_id from public.companies where lower(name) = 'rm' limit 1
),
accounts as (
  select u.id as user_id, u.email,
         case lower(u.email)
           when 'juina@rm.com.br' then 'JUÍNA'
           when 'rodotec@rm.com.br' then 'RODOTEC'
         end as branch_name,
         case lower(u.email)
           when 'juina@rm.com.br' then 'Responsável JUÍNA'
           when 'rodotec@rm.com.br' then 'Responsável RODOTEC'
         end as display_name,
         case lower(u.email)
           when 'juina@rm.com.br' then 'juina'
           when 'rodotec@rm.com.br' then 'rodotec'
         end as username
  from auth.users u
  where lower(u.email) in ('juina@rm.com.br', 'rodotec@rm.com.br')
)
insert into public.profiles (user_id, company_id, branch_id, full_name, role)
select a.user_id, rm.company_id, b.id, a.display_name, 'recorder'
from accounts a
cross join rm
join public.branches b on b.company_id = rm.company_id and b.name = a.branch_name
on conflict (user_id) do update
set company_id = excluded.company_id,
    branch_id = excluded.branch_id,
    full_name = excluded.full_name,
    role = 'recorder';

insert into private.login_aliases (username_normalized, user_id)
select a.username, a.user_id
from (
  select u.id as user_id,
         case lower(u.email)
           when 'juina@rm.com.br' then 'juina'
           when 'rodotec@rm.com.br' then 'rodotec'
         end as username
  from auth.users u
  where lower(u.email) in ('juina@rm.com.br', 'rodotec@rm.com.br')
) a
where a.username is not null
on conflict (username_normalized) do update
set user_id = excluded.user_id;
