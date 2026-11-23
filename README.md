# erp-financeiro

> Sistema ERP financeiro multi-empresa com fluxo de caixa, contas a pagar/receber e importação de extratos.

## Funcionalidades

- **Dashboard** – visão geral de saldo, entradas, saídas e gráfico de evolução mensal
- **Fluxo de caixa** – lançamento manual de transações com categorias, centros de custo e contas bancárias
- **Importação de extratos** – arraste e solte arquivos OFX ou Excel; categorização automática por regras configuráveis
- **Contas a pagar / receber** – controle de vencimentos e liquidação com comprovantes
- **Relatórios** – exportação em PDF e Excel com filtros de período
- **Multi-empresa** – dados isolados por empresa; usuários com papéis `admin`, `user` e `viewer`
- **Reconciliação bancária** – comparação entre saldo do sistema e saldo oficial do banco

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 14, React 18, Tailwind CSS |
| Backend / Auth | Supabase (PostgreSQL + Row Level Security) |
| Exportação | XLSX, html2pdf |
| Deploy | Vercel |

## Como rodar localmente

```bash
git clone https://github.com/jvstrs10/erp-financeiro.git
cd erp-financeiro/erp-financeiro
npm install
cp .env.example .env.local   # configure suas chaves do Supabase
npm run dev
```

## Variáveis de ambiente

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
```

Ambas estão em **Supabase → Project Settings → API**.

## Banco de dados

Schema completo em [`supabase_schema.sql`](./erp-financeiro/supabase_schema.sql). Tabelas principais:

- `empresas` – multi-tenancy
- `perfis` – usuários com roles (admin / user / viewer)
- `contas` – contas bancárias, caixa, investimento
- `transacoes` – lançamentos de entrada e saída
- `contas_pagar` / `contas_receber` – controle de vencimentos
- `categorias`, `centros_custo`, `regras` – configurações por empresa

## Autor

Desenvolvido por [João Victor Soteras](https://github.com/jvstrs10).