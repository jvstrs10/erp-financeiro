-- ============================================================
-- SCHEMA DO BANCO DE DADOS - ERP FINANCEIRO
-- Execute este script no SQL Editor do Supabase
-- ============================================================

-- Extensão para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELA: empresas (multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS empresas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome TEXT NOT NULL,
  cnpj TEXT,
  criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: perfis de usuário (liga auth.users às empresas)
-- ============================================================
CREATE TABLE IF NOT EXISTS perfis (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'viewer')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: contas bancárias
-- ============================================================
CREATE TABLE IF NOT EXISTS contas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT DEFAULT 'banco' CHECK (tipo IN ('caixa', 'banco', 'investimento')),
  criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: centros de custo
-- ============================================================
CREATE TABLE IF NOT EXISTS centros_custo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: categorias
-- ============================================================
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: regras de categorização automática
-- ============================================================
CREATE TABLE IF NOT EXISTS regras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  palavra TEXT NOT NULL,
  categoria TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  criada_em TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABELA: transações (fluxo de caixa)
-- ============================================================
CREATE TABLE IF NOT EXISTS transacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT,
  conta_id UUID REFERENCES contas(id) ON DELETE SET NULL,
  centro_custo TEXT DEFAULT 'Geral',
  conciliada BOOLEAN DEFAULT FALSE,
  comprovante TEXT, -- base64 ou URL
  justificativa TEXT,
  criada_em TIMESTAMPTZ DEFAULT NOW(),
  criada_por UUID REFERENCES auth.users(id)
);

-- ============================================================
-- TABELA: contas a pagar
-- ============================================================
CREATE TABLE IF NOT EXISTS contas_pagar (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  vencimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  fornecedor TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'cancelado')),
  categoria TEXT,
  criada_em TIMESTAMPTZ DEFAULT NOW(),
  criada_por UUID REFERENCES auth.users(id)
);

-- ============================================================
-- TABELA: contas a receber
-- ============================================================
CREATE TABLE IF NOT EXISTS contas_receber (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  vencimento DATE NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(15,2) NOT NULL,
  cliente TEXT,
  status TEXT DEFAULT 'pendente' CHECK (status IN ('pendente', 'recebido', 'cancelado')),
  categoria TEXT,
  criada_em TIMESTAMPTZ DEFAULT NOW(),
  criada_por UUID REFERENCES auth.users(id)
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS) - ISOLAMENTO POR EMPRESA
-- Cada usuário só vê os dados da sua própria empresa
-- ============================================================

ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE perfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas ENABLE ROW LEVEL SECURITY;
ALTER TABLE centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_pagar ENABLE ROW LEVEL SECURITY;
ALTER TABLE contas_receber ENABLE ROW LEVEL SECURITY;

-- Função helper para pegar empresa_id do usuário logado
CREATE OR REPLACE FUNCTION get_empresa_id()
RETURNS UUID AS $$
  SELECT empresa_id FROM perfis WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Políticas RLS para cada tabela
CREATE POLICY "Usuários veem sua empresa" ON empresas FOR ALL
  USING (id = get_empresa_id());

CREATE POLICY "Usuários veem seu perfil" ON perfis FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem suas contas" ON contas FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem centros de custo" ON centros_custo FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem categorias" ON categorias FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem regras" ON regras FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem transações" ON transacoes FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem contas a pagar" ON contas_pagar FOR ALL
  USING (empresa_id = get_empresa_id());

CREATE POLICY "Usuários veem contas a receber" ON contas_receber FOR ALL
  USING (empresa_id = get_empresa_id());

-- ============================================================
-- FUNÇÃO: criar empresa e perfil ao registrar novo usuário
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  nova_empresa_id UUID;
BEGIN
  -- Cria empresa nova para o usuário
  INSERT INTO empresas (nome)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'empresa', 'Minha Empresa'))
  RETURNING id INTO nova_empresa_id;

  -- Cria perfil do usuário como admin da empresa
  INSERT INTO perfis (id, empresa_id, nome, email, role)
  VALUES (
    NEW.id,
    nova_empresa_id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    'admin'
  );

  -- Cria contas padrão
  INSERT INTO contas (empresa_id, nome, tipo) VALUES
    (nova_empresa_id, 'Caixa Interno', 'caixa'),
    (nova_empresa_id, 'Banco Principal', 'banco');

  -- Cria centro de custo padrão
  INSERT INTO centros_custo (empresa_id, nome) VALUES
    (nova_empresa_id, 'Geral');

  -- Cria categorias padrão de entrada
  INSERT INTO categorias (empresa_id, nome, tipo) VALUES
    (nova_empresa_id, 'Recebimento de Cliente', 'entrada'),
    (nova_empresa_id, 'Vendas à Vista', 'entrada'),
    (nova_empresa_id, 'Vendas a Prazo', 'entrada'),
    (nova_empresa_id, 'Prestação de Serviços', 'entrada'),
    (nova_empresa_id, 'Aporte de Capital', 'entrada'),
    (nova_empresa_id, 'Empréstimos Recebidos', 'entrada'),
    (nova_empresa_id, 'Outras Entradas', 'entrada'),
    (nova_empresa_id, 'Saldo Inicial', 'entrada');

  -- Cria categorias padrão de saída
  INSERT INTO categorias (empresa_id, nome, tipo) VALUES
    (nova_empresa_id, 'Fornecedores', 'saida'),
    (nova_empresa_id, 'Folha de Pagamento', 'saida'),
    (nova_empresa_id, 'INSS', 'saida'),
    (nova_empresa_id, 'FGTS', 'saida'),
    (nova_empresa_id, 'Impostos sobre Vendas', 'saida'),
    (nova_empresa_id, 'Aluguéis', 'saida'),
    (nova_empresa_id, 'Energia Elétrica', 'saida'),
    (nova_empresa_id, 'Telefone/Internet', 'saida'),
    (nova_empresa_id, 'Contabilidade', 'saida'),
    (nova_empresa_id, 'Combustíveis', 'saida'),
    (nova_empresa_id, 'Despesas Diversas', 'saida'),
    (nova_empresa_id, 'Empréstimos Bancários', 'saida'),
    (nova_empresa_id, 'Retiradas Sócios', 'saida'),
    (nova_empresa_id, 'Outras Saídas', 'saida');

  -- Cria regras padrão
  INSERT INTO regras (empresa_id, palavra, categoria, tipo) VALUES
    (nova_empresa_id, 'CPFL', 'Energia Elétrica', 'saida'),
    (nova_empresa_id, 'PIX', 'Recebimento de Cliente', 'entrada');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara ao criar novo usuário
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ÍNDICES para performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_transacoes_empresa ON transacoes(empresa_id);
CREATE INDEX IF NOT EXISTS idx_transacoes_data ON transacoes(data);
CREATE INDEX IF NOT EXISTS idx_contas_pagar_empresa ON contas_pagar(empresa_id);
CREATE INDEX IF NOT EXISTS idx_contas_receber_empresa ON contas_receber(empresa_id);
