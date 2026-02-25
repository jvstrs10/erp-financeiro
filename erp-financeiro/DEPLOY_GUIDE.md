# 🚀 Guia de Deploy — ERP Financeiro no Vercel + Supabase

## Visão Geral da Arquitetura

```
Usuários → Vercel (Next.js) → Supabase (PostgreSQL + Auth)
```

- **Vercel**: hospeda o front-end gratuitamente com SSL automático
- **Supabase**: banco de dados PostgreSQL + autenticação de usuários (plano grátis: 500MB, 50.000 usuários)
- **Multi-tenant**: cada empresa tem seus dados completamente isolados

---

## PASSO 1 — Criar conta no Supabase

1. Acesse **https://supabase.com** e clique em **"Start your project"**
2. Faça login com GitHub ou e-mail
3. Clique em **"New Project"**
4. Preencha:
   - **Name**: `erp-financeiro` (ou o nome que quiser)
   - **Database Password**: crie uma senha forte e salve
   - **Region**: escolha `South America (São Paulo)` para melhor latência
5. Aguarde ~2 minutos para o projeto ser criado

---

## PASSO 2 — Configurar o Banco de Dados

1. No painel do Supabase, clique em **"SQL Editor"** (ícone de banco de dados no menu lateral)
2. Clique em **"New query"**
3. Abra o arquivo `supabase_schema.sql` (incluído neste projeto)
4. **Copie todo o conteúdo** e cole no editor SQL
5. Clique em **"Run"** (ou `Ctrl+Enter`)
6. Você verá: `Success. No rows returned` — isso é correto!

---

## PASSO 3 — Obter as Chaves de API

1. No painel do Supabase, vá em **Settings > API** (menu lateral, ícone de engrenagem)
2. Copie os valores:
   - **Project URL**: `https://xxxxxxxxxxxxxxxx.supabase.co`
   - **anon public** key (chave pública, começa com `eyJ...`)

---

## PASSO 4 — Configurar Autenticação (E-mail)

1. No Supabase, vá em **Authentication > Providers**
2. Certifique-se que **Email** está habilitado (já vem por padrão)
3. Em **Authentication > Email Templates**, você pode personalizar os e-mails de confirmação
4. **Opcional**: em **Authentication > URL Configuration**, adicione a URL do seu site Vercel após o deploy

> ⚠️ Por padrão, o Supabase exige confirmação de e-mail. Para desativar em testes:
> Vá em **Authentication > Providers > Email** e desmarque "Confirm email"

---

## PASSO 5 — Subir o Código no GitHub

1. Crie um repositório no **https://github.com/new**
2. No terminal, dentro da pasta do projeto:

```bash
git init
git add .
git commit -m "ERP Financeiro - versão inicial"
git remote add origin https://github.com/SEU_USUARIO/erp-financeiro.git
git push -u origin main
```

---

## PASSO 6 — Deploy no Vercel

1. Acesse **https://vercel.com** e faça login com GitHub
2. Clique em **"Add New Project"**
3. Selecione o repositório `erp-financeiro`
4. Na tela de configuração:
   - **Framework Preset**: Next.js (detectado automaticamente)
   - **Root Directory**: deixe em branco (ou `./`)
5. Clique em **"Environment Variables"** e adicione:

   | Nome | Valor |
   |------|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxxxxxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (sua chave anon) |

6. Clique em **"Deploy"**
7. Aguarde ~2 minutos — seu site estará em `https://erp-financeiro.vercel.app`

---

## PASSO 7 — Configurar URL no Supabase (pós-deploy)

Após o deploy, copie a URL do Vercel (ex: `https://erp-financeiro.vercel.app`) e:

1. No Supabase, vá em **Authentication > URL Configuration**
2. Em **Site URL**, cole a URL do Vercel
3. Em **Redirect URLs**, adicione: `https://erp-financeiro.vercel.app/**`
4. Clique em **Save**

---

## ✅ Testando o Sistema

1. Acesse a URL do Vercel
2. Clique em **"Criar Conta"**
3. Preencha seu nome, nome da empresa, e-mail e senha
4. Se a confirmação de e-mail estiver ativa, verifique sua caixa de entrada
5. Após login, o sistema já virá com categorias, contas e regras padrão criadas automaticamente

---

## 🔒 Segurança — Como Funciona o Isolamento

O banco usa **Row Level Security (RLS)** do PostgreSQL:

- Cada usuário ao se registrar cria automaticamente **uma nova empresa**
- Todas as tabelas filtram dados por `empresa_id`
- Um usuário **nunca pode ver** os dados de outra empresa, mesmo que tente via API
- Para convidar colaboradores à mesma empresa, implemente a função de convite (sugestão de melhoria)

---

## 💰 Custos

| Serviço | Plano Grátis | Pago |
|---------|-------------|------|
| Vercel | Ilimitado para uso pessoal/pequeno | $20/mês (Pro) |
| Supabase | 500MB banco, 50k usuários, 2GB storage | $25/mês (Pro) |

**Para até ~100 empresas usando o sistema, o plano grátis é suficiente.**

---

## 🛠️ Manutenção e Atualizações

Para fazer atualizações no sistema:

```bash
# Faça as alterações no código
git add .
git commit -m "descrição da mudança"
git push
# O Vercel faz o redeploy automaticamente!
```

---

## ❓ Problemas Comuns

**"Invalid API key"**: Verifique se as variáveis de ambiente no Vercel estão corretas.

**"Email not confirmed"**: O usuário precisa clicar no link enviado por e-mail. Ou desative a confirmação em Authentication > Providers > Email.

**Dados não carregam após login**: Verifique se o SQL do schema foi executado corretamente no Supabase.

**Erro "relation does not exist"**: O script SQL não foi executado. Repita o Passo 2.
