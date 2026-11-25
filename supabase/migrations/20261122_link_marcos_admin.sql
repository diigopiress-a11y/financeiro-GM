-- RM | Vincular a conta Marcos como administrador
-- Execute somente depois de criar admin@rm.com.br em Authentication > Users.

do $$
declare
  v_user_id uuid;
  v_company_id uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = 'admin@rm.com.br'
  limit 1;

  if v_user_id is null then
    raise exception 'Usuário admin@rm.com.br não encontrado em Authentication > Users.';
  end if;

  select id into v_company_id
  from public.companies
  where lower(name) = 'rm'
  limit 1;

  if v_company_id is null then
    raise exception 'Empresa RM não encontrada. Execute primeiro as migrações anteriores.';
  end if;

  insert into public.profiles (user_id, company_id, branch_id, full_name, role)
  values (v_user_id, v_company_id, null, 'Marcos', 'admin')
  on conflict (user_id) do update
  set company_id = excluded.company_id,
      branch_id = null,
      full_name = 'Marcos',
      role = 'admin';

  insert into private.login_aliases (username_normalized, user_id)
  values ('marcos', v_user_id)
  on conflict (username_normalized) do update
  set user_id = excluded.user_id;

  insert into private.user_security (user_id, must_change_password)
  values (v_user_id, true)
  on conflict (user_id) do update
  set must_change_password = true,
      updated_at = now();
end $$;
