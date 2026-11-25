-- RM | LIMPEZA ÚNICA DOS DADOS DE TESTE
-- Execute manualmente no Supabase SQL Editor, depois de conferir que está no projeto correto.
-- Mantém contas, perfis, empresa e filiais. Apaga todos os funcionários RM e,
-- por cascata, diárias, taxas, horas extras, pagamentos e histórico individual.
-- Também remove escalas de sábado vazias/experimentais.

begin;

delete from public.saturday_schedules
where company_id in (select id from public.companies where lower(name) = 'rm');

delete from public.employees
where company_id in (select id from public.companies where lower(name) = 'rm');

commit;

-- Resultado esperado: 0 funcionários, 0 diárias, 0 horas extras e 0 pagamentos
-- vinculados à equipe de teste. As contas de login e filiais permanecem.
