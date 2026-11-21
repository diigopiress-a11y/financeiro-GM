# Configuração do Supabase — RM

## 1. Criar o projeto
1. Entre em https://supabase.com/dashboard e crie uma organização/projeto.
2. Escolha uma senha forte para o banco e guarde-a em local seguro.
3. Aguarde o provisionamento do projeto.

## 2. Criar as tabelas e permissões
1. Abra **SQL Editor** no painel Supabase.
2. Clique em **New query**.
3. Abra o arquivo `supabase/schema.sql` deste repositório, copie todo o conteúdo e cole no editor.
4. Clique em **Run**. O script cria empresa/filiais/perfis/funcionários/diárias/faltas/horas extras/pagamentos e ativa RLS.

## 3. Criar o primeiro usuário administrador
1. No Supabase, abra **Authentication → Users → Add user**.
2. Crie o usuário com o e-mail do dono e uma senha provisória forte.
3. Marque o e-mail como confirmado, se o painel oferecer essa opção.
4. Abra **SQL Editor** e execute o bloco abaixo, substituindo os valores:
```sql
-- Cria a empresa RM e as duas filiais.
with c as (
  insert into public.companies (name) values ('RM') returning id
),
b1 as (
  insert into public.branches (company_id, name)
  select id, 'JUÍNA' from c returning id, company_id
),
b2 as (
  insert into public.branches (company_id, name)
  select id, 'RODOTEC' from c returning id, company_id
)
select 'Empresa e filiais criadas' as resultado;
```
5. Para vincular o primeiro usuário, execute:
```sql
-- Substitua o e-mail pelo e-mail exato criado em Authentication > Users.
insert into public.profiles (user_id, company_id, branch_id, full_name, role)
select u.id, c.id, null, 'Administrador RM', 'admin'
from auth.users u
cross join public.companies c
where u.email = 'EMAIL_DO_DONO'
  and c.name = 'RM';
```
Se já existir uma empresa chamada RM, confira os registros antes de executar para evitar duplicidade.

## 4. Criar responsáveis de filial
1. Crie cada responsável em **Authentication → Users → Add user**.
2. Descubra os IDs das filiais:
```sql
select id, name from public.branches order by name;
```
3. Cadastre o perfil do responsável, usando o ID do usuário e o ID da filial:
```sql
insert into public.profiles (user_id, company_id, branch_id, full_name, role)
select 'UUID_DO_USUARIO'::uuid, b.company_id, b.id, 'NOME DO RESPONSÁVEL', 'recorder'
from public.branches b
where b.name = 'JUÍNA'; -- troque para RODOTEC quando necessário
```

## 5. Configurar o frontend
1. No Supabase, abra **Project Settings → API** (ou **Data API**).
2. Copie a **Project URL** e a chave pública **anon/publishable**.
3. Na raiz do projeto, crie `.env.local` a partir de `.env.example` e preencha:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Nunca coloque a `service_role` ou secret key em variáveis `VITE_*`, no GitHub ou no navegador.

## 6. Configurar Vercel
Em **Project → Settings → Environment Variables**, cadastre as mesmas duas variáveis para Production, Preview e Development. Depois faça um novo deploy.

## Regras de acesso previstas
- `admin`: consulta as duas filiais e gerencia perfis e pagamentos.
- `recorder`: consulta e registra dados somente na filial definida em `profiles.branch_id`; não acessa pagamentos.
- As policies RLS do banco aplicam essas regras mesmo se alguém tentar chamar a API diretamente.

## Importante sobre o estágio do projeto
Este commit prepara o cliente Supabase, as tabelas, as policies e o roteiro de configuração. A tela atual ainda usa armazenamento local para os dados operacionais; **não use dados reais nem convide os responsáveis ainda**. A próxima etapa é ligar login e operações das telas ao banco, remover o localStorage e testar cada perfil com duas contas antes de colocar em produção.
