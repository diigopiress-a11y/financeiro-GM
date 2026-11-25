-- RM | LIMPEZA ÚNICA DOS DADOS DE TESTE
-- Execute manualmente no Supabase SQL Editor, depois de conferir que está no projeto correto.
-- Mantém contas, perfis, empresa e filiais. Apaga todos os funcionários RM e,
-- por cascata, diárias, taxas, horas extras, pagamentos e histórico individual.
-- Também remove escalas de sábado vazias/experimentais.

-- Autoriza exclusão definitiva pelo admin ou responsável da própria filial.
drop policy if exists "admins delete employees" on public.employees;
drop policy if exists "admins and branch recorders delete employees" on public.employees;
create policy "admins and branch recorders delete employees"
on public.employees for delete to authenticated
using (
  public.is_company_admin(company_id)
  or exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid()
      and p.role = 'recorder'
      and p.company_id = employees.company_id
      and p.branch_id = employees.branch_id
  )
);
grant delete on public.employees to authenticated;

begin;

delete from public.saturday_schedules
where company_id in (select id from public.companies where lower(name) = 'rm');

delete from public.employees
where company_id in (select id from public.companies where lower(name) = 'rm');

commit;

-- Resultado esperado: 0 funcionários, 0 diárias, 0 horas extras e 0 pagamentos
-- vinculados à equipe de teste. As contas de login e filiais permanecem.
