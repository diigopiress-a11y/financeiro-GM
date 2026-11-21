-- RM | Estrutura inicial do banco de dados
-- Execute no Supabase: SQL Editor > New query > Run.
-- RLS é a barreira de segurança principal. Não remova estas policies.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null check (name in ('JUÍNA', 'RODOTEC')),
  created_at timestamptz not null default now(),
  unique(company_id, name),
  unique(id, company_id)
);

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid,
  full_name text not null,
  role text not null check (role in ('admin', 'recorder')),
  created_at timestamptz not null default now(),
  constraint profiles_branch_company_fk foreign key (branch_id, company_id)
    references public.branches(id, company_id),
  constraint recorder_requires_branch check (role <> 'recorder' or branch_id is not null)
);

create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  foreign key (branch_id, company_id) references public.branches(id, company_id),
  unique(id, branch_id, company_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  status text not null check (status in ('worked', 'absent', 'off')),
  daily_rate integer check (daily_rate in (120, 150)),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (branch_id, company_id) references public.branches(id, company_id),
  foreign key (employee_id, branch_id, company_id) references public.employees(id, branch_id, company_id) on delete cascade,
  unique(employee_id, work_date)
);

create table if not exists public.overtime (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  work_date date not null,
  passed_scheduled_end boolean not null default true,
  note text not null default 'Passou do horário de saída',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (branch_id, company_id) references public.branches(id, company_id),
  unique(employee_id, work_date)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  branch_id uuid not null,
  employee_id uuid not null references public.employees(id) on delete cascade,
  week_start date not null,
  paid boolean not null default false,
  paid_at timestamptz,
  updated_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (branch_id, company_id) references public.branches(id, company_id),
  unique(employee_id, week_start)
);

create index if not exists employees_branch_idx on public.employees(branch_id);
create index if not exists attendance_branch_date_idx on public.attendance(branch_id, work_date);
create index if not exists overtime_branch_date_idx on public.overtime(branch_id, work_date);
create index if not exists payments_branch_week_idx on public.payments(branch_id, week_start);

-- Funções auxiliares: SECURITY DEFINER evita recursão nas policies de profiles.
create or replace function public.current_profile()
returns table (company_id uuid, branch_id uuid, role text)
language sql stable security definer
set search_path = public
as $$
  select p.company_id, p.branch_id, p.role
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.can_access_branch(target_company uuid, target_branch uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = target_company
      and (p.role = 'admin' or p.branch_id = target_branch)
  )
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.company_id = target_company
      and p.role = 'admin'
  )
$$;

alter table public.companies enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.employees enable row level security;
alter table public.attendance enable row level security;
alter table public.overtime enable row level security;
alter table public.payments enable row level security;

create policy "company members can read their company" on public.companies
for select using (exists(select 1 from public.profiles p where p.user_id = auth.uid() and p.company_id = id));

create policy "members can read their branches" on public.branches
for select using (public.can_access_branch(company_id, id) or public.is_company_admin(company_id));

create policy "users can read own profile and admins can read company profiles" on public.profiles
for select using (
  user_id = auth.uid()
  or public.is_company_admin(company_id)
);

create policy "admins manage company profiles" on public.profiles
for all using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "branch members read employees" on public.employees
for select using (public.can_access_branch(company_id, branch_id));

create policy "branch members insert employees" on public.employees
for insert with check (public.can_access_branch(company_id, branch_id));

create policy "branch members update employees" on public.employees
for update using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members read attendance" on public.attendance
for select using (public.can_access_branch(company_id, branch_id));

create policy "branch members insert attendance" on public.attendance
for insert with check (public.can_access_branch(company_id, branch_id));

create policy "branch members update attendance" on public.attendance
for update using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members delete attendance" on public.attendance
for delete using (public.can_access_branch(company_id, branch_id));

create policy "branch members read overtime" on public.overtime
for select using (public.can_access_branch(company_id, branch_id));

create policy "branch members insert overtime" on public.overtime
for insert with check (public.can_access_branch(company_id, branch_id));

create policy "branch members update overtime" on public.overtime
for update using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));

create policy "branch members delete overtime" on public.overtime
for delete using (public.can_access_branch(company_id, branch_id));

create policy "admins read payments" on public.payments
for select using (public.is_company_admin(company_id));

create policy "admins create payments" on public.payments
for insert with check (public.is_company_admin(company_id));

create policy "admins update payments" on public.payments
for update using (public.is_company_admin(company_id))
with check (public.is_company_admin(company_id));

create policy "admins delete payments" on public.payments
for delete using (public.is_company_admin(company_id));

-- IMPORTANTE: o primeiro administrador deve ser criado manualmente pelo SQL Editor,
-- depois de criar o usuário em Authentication > Users. Não permita auto-cadastro
-- público nem conceda papel admin a partir do navegador.
