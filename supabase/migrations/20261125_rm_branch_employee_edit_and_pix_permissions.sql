-- RM | Alinha permissões de cadastro e edição de funcionários nas filiais.
-- Aplicar no Supabase SQL Editor após as migrações anteriores.
-- Responsáveis podem cadastrar/editar dados operacionais e Pix da própria filial.
-- A diária inicial é inserida, mas somente o administrador pode alterar taxas existentes.

grant select (id, company_id, branch_id, name, active, created_at, effective_from, pix_key, pix_key_type, pix_city)
on public.employees to authenticated;

grant insert (company_id, branch_id, name, active, effective_from, pix_key, pix_key_type, pix_city)
on public.employees to authenticated;

grant update (name, active, pix_key, pix_key_type, pix_city)
on public.employees to authenticated;

drop policy if exists "branch recorders update own branch employees" on public.employees;
create policy "branch recorders update own branch employees"
on public.employees
for update
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'recorder'
      and p.company_id = employees.company_id
      and p.branch_id = employees.branch_id
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'recorder'
      and p.company_id = employees.company_id
      and p.branch_id = employees.branch_id
  )
);

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
