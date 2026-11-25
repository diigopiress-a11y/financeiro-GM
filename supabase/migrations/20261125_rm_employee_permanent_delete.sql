-- RM | Permite exclusão definitiva de funcionário pela administração ou responsável da própria filial.
-- A exclusão do funcionário remove em cascata diárias, horas extras, pagamentos,
-- taxas e snapshots de valores vinculados, conforme as FKs já existentes.

drop policy if exists "admins delete employees" on public.employees;
drop policy if exists "admins and branch recorders delete employees" on public.employees;

create policy "admins and branch recorders delete employees"
on public.employees
for delete
to authenticated
using (
  public.is_company_admin(company_id)
  or exists (
    select 1
    from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'recorder'
      and p.company_id = employees.company_id
      and p.branch_id = employees.branch_id
  )
);

grant delete on public.employees to authenticated;
