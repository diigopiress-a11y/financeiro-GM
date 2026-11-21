# RM — Gestão de Diárias

Sistema mobile-first para controle de funcionários, diárias, faltas e ocorrências de hora extra das filiais **JUÍNA** e **RODOTEC**.

## Desenvolvimento
```bash
npm install
npm run dev
```

## Supabase
Consulte [docs/SUPABASE_SETUP.md](docs/SUPABASE_SETUP.md) para criar o projeto, executar o schema, cadastrar o administrador e configurar as variáveis.

- Schema e políticas RLS: `supabase/schema.sql`
- Variáveis locais: copie `.env.example` para `.env.local`
- O frontend usa somente Project URL e chave pública anon/publishable.
- **Nunca exponha a service_role/secret key no frontend.**

## Estado desta etapa
Esta etapa prepara a dependência e o cliente Supabase, o modelo de dados com RLS e o guia de configuração. A interface operacional ainda mantém o armazenamento local nesta branch. Não utilize dados reais até concluir a próxima etapa de integração do login e das operações de leitura/escrita ao banco, seguida de testes com perfis admin e recorder.
