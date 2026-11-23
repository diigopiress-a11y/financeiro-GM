-- RM | Permite que responsáveis cadastrem funcionários somente na própria filial.
-- Executar no Supabase SQL Editor depois das migrações anteriores.

-- O formulário do responsável cria o funcionário com a filial vinculada ao perfil.
grant insert (company_id, branch_id, name, active, effective_from)
on public.employees to authenticated;

drop policy if exists "branch recorders insert own branch employees" on public.employees;
create policy "branch recorders insert own branch employees"
on public.employees
for insert
to authenticated
with check (
  exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'recorder'
      and p.company_id = employees.company_id
      and p.branch_id = employees.branch_id
  )
);

-- A diária inicial (R$ 120 ou R$ 150) é criada junto com o funcionário.
-- O responsável pode inserir o valor inicial, mas não alterar taxas existentes.
drop policy if exists "branch recorders insert own branch employee rate" on public.employee_rates;
create policy "branch recorders insert own branch employee rate"
on public.employee_rates
for insert
to authenticated
with check (
  exists (
    select 1
    from public.employees e
    join public.profiles p
      on p.company_id = e.company_id
     and p.branch_id = e.branch_id
     and p.user_id = auth.uid()
     and p.role = 'recorder'
    where e.id = employee_rates.employee_id
  )
);

-- Permite ao responsável consultar somente as taxas dos funcionários da própria filial.
drop policy if exists "branch recorders read own branch employee rates" on public.employee_rates;
create policy "branch recorders read own branch employee rates"
on public.employee_rates
for select
to authenticated
using (
  exists (
    select 1
    from public.employees e
    join public.profiles p
      on p.company_id = e.company_id
     and p.branch_id = e.branch_id
     and p.user_id = auth.uid()
     and p.role = 'recorder'
    where e.id = employee_rates.employee_id
  )
);
