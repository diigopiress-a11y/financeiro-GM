# Diária GM

Modelo inicial de um sistema mobile-first para administração de diárias, presença, faltas, horas extras e fechamento semanal.

## Executar localmente

```bash
npm install
npm run dev
```

## Publicar na Vercel

Importe este repositório na Vercel. O framework será detectado como Vite. Comando de build: `npm run build`; diretório de saída: `dist`.

## Estado atual

Esta primeira versão é um protótipo funcional que salva os lançamentos no armazenamento local do navegador (localStorage). Os dados ainda não são compartilhados entre dispositivos ou usuários. Antes de usar com dados reais, será necessário integrar Supabase Auth, banco de dados, isolamento por empresa (RLS) e backups.

## Funcionalidades do protótipo

- Cadastro e edição de funcionários e valor da diária.
- Registro diário de presença, falta e folga.
- Lançamento de horas extras por funcionário e por dia.
- Resumo semanal por pessoa e total da equipe.
- Marcação de pagamento da semana.
- Exportação CSV do fechamento semanal.

Os valores e nomes iniciais são fictícios e podem ser editados/excluídos.