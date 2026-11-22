-- RM | Segurança de dados e permissões por perfil
-- Executar depois das migrações de autenticação já aplicadas.

create table if not exists public.employee_rates (
  employee_id uuid primary key references public.employees(id) on delete cascade,
  daily_rate integer not null check (daily_rate in (120, 150)),
  effective_from date not null default current_date,
  updated_at timestamptz not null default now()
);

insert into public.employee_rates (employee_id, daily_rate, effective_from)
select id, daily_rate, effective_from from public.employees
on conflict (employee_id) do nothing;

create table if not exists public.attendance_rates (
  attendance_id uuid primary key references public.attendance(id) on delete cascade,
  daily_rate integer not null check (daily_rate in (120, 150))
);

insert into public.attendance_rates (attendance_id, daily_rate)
select id, daily_rate from public.attendance where daily_rate in (120,150)
on conflict (attendance_id) do nothing;

alter table public.employees drop column if exists daily_rate;
alter table public.employees drop column if exists effective_from;
alter table public.attendance drop column if exists daily_rate;

alter table public.employee_rates enable row level security;
alter table public.attendance_rates enable row level security;

drop policy if exists "admins manage employee rates" on public.employee_rates;
create policy "admins manage employee rates" on public.employee_rates
for all using (
  exists (
    select 1 from public.employees e
    where e.id = employee_id and public.is_company_admin(e.company_id)
  )
)
with check (
  exists (
    select 1 from public.employees e
    where e.id = employee_id and public.is_company_admin(e.company_id)
  )
);

drop policy if exists "admins manage attendance rates" on public.attendance_rates;
create policy "admins manage attendance rates" on public.attendance_rates
for all using (
  exists (
    select 1 from public.attendance a
    join public.profiles p on p.company_id = a.company_id
    where a.id = attendance_id and p.user_id = auth.uid() and p.role = 'admin'
  )
)
with check (
  exists (
    select 1 from public.attendance a
    join public.profiles p on p.company_id = a.company_id
    where a.id = attendance_id and p.user_id = auth.uid() and p.role = 'admin'
  )
);

-- Apenas colunas operacionais são liberadas para os usuários autenticados.
revoke all on public.employees from anon, authenticated;
grant select (id, company_id, branch_id, name, active, created_at) on public.employees to authenticated;
grant insert (company_id, branch_id, name, active) on public.employees to authenticated;
grant update (name, active) on public.employees to authenticated;
grant delete on public.employees to authenticated;

revoke all on public.attendance from anon, authenticated;
grant select (id, company_id, branch_id, employee_id, work_date, status, created_by, created_at) on public.attendance to authenticated;
grant insert (company_id, branch_id, employee_id, work_date, status, created_by) on public.attendance to authenticated;
grant update (status) on public.attendance to authenticated;
grant delete on public.attendance to authenticated;

grant select, insert, update, delete on public.employee_rates, public.attendance_rates to authenticated;

-- Corrige as policies: somente admin administra funcionários e valores.
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

-- O responsável da filial só pode registrar dados da própria filial.
drop policy if exists "branch members insert attendance" on public.attendance;
drop policy if exists "branch members update attendance" on public.attendance;
drop policy if exists "branch members delete attendance" on public.attendance;
create policy "branch members insert attendance" on public.attendance
for insert with check (
  public.can_access_branch(company_id, branch_id)
  and created_by = auth.uid()
);
create policy "branch members update attendance" on public.attendance
for update using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));
create policy "branch members delete attendance" on public.attendance
for delete using (public.can_access_branch(company_id, branch_id));

drop policy if exists "branch members insert overtime" on public.overtime;
drop policy if exists "branch members update overtime" on public.overtime;
drop policy if exists "branch members delete overtime" on public.overtime;
create policy "branch members insert overtime" on public.overtime
for insert with check (
  public.can_access_branch(company_id, branch_id)
  and created_by = auth.uid()
);
create policy "branch members update overtime" on public.overtime
for update using (public.can_access_branch(company_id, branch_id))
with check (public.can_access_branch(company_id, branch_id));
create policy "branch members delete overtime" on public.overtime
for delete using (public.can_access_branch(company_id, branch_id));

-- Função segura para consultar o perfil autenticado e exigir troca inicial de senha.
create or replace function public.get_my_security_status()
returns table (user_id uuid, full_name text, role text, company_id uuid, branch_id uuid, must_change_password boolean)
language sql stable security definer
set search_path = public, private, pg_temp
as $$
  select p.user_id, p.full_name, p.role, p.company_id, p.branch_id,
         coalesce(s.must_change_password, false)
  from public.profiles p
  left join private.user_security s on s.user_id = p.user_id
  where p.user_id = auth.uid()
  limit 1
$$;

create or replace function public.complete_password_change(new_password text)
returns void
language plpgsql security definer
set search_path = public, private, auth, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Sessão não autenticada.';
  end if;
  if length(new_password) < 8 then
    raise exception 'A senha deve ter pelo menos 8 caracteres.';
  end if;
  update auth.users
  set encrypted_password = crypt(new_password, gen_salt('bf')),
      updated_at = now()
  where id = auth.uid();
  update private.user_security
  set must_change_password = false, updated_at = now()
  where user_id = auth.uid();
end;
$$;

revoke all on function public.get_my_security_status() from public, anon;
grant execute on function public.get_my_security_status() to authenticated;
revoke all on function public.complete_password_change(text) from public, anon;
grant execute on function public.complete_password_change(text) to authenticated;

-- Não permitir cadastro público de perfis nem elevação de privilégio pelo navegador.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
