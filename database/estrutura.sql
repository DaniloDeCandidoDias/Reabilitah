-- Estrutura do Reabilitah para PostgreSQL 18. Executar somente em um banco vazio.
BEGIN;
SET LOCAL check_function_bodies = false;
DO $$ BEGIN
  IF current_database() <> 'reabilitah' THEN
    RAISE EXCEPTION 'Conecte a Query Tool ao banco reabilitah antes de executar.';
  END IF;
END $$;

CREATE SCHEMA reabilitah;
REVOKE ALL ON SCHEMA reabilitah FROM PUBLIC;
SET LOCAL search_path = reabilitah, pg_catalog;

CREATE TABLE usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (btrim(email) <> ''),
  senha_hash text NOT NULL CHECK (length(senha_hash) >= 40),
  super_administrador boolean NOT NULL DEFAULT false,
  ativo boolean NOT NULL DEFAULT true,
  exige_troca_senha boolean NOT NULL DEFAULT true,
  versao_credencial integer NOT NULL DEFAULT 1 CHECK (versao_credencial > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX usuario_email_unico ON usuario (lower(btrim(email)));

CREATE TABLE instituicao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  nome_legal text, cnpj varchar(14), email text, telefone text,
  endereco jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(endereco) = 'object'),
  ativa boolean NOT NULL DEFAULT true,
  criado_por uuid REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE cargo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL REFERENCES instituicao(id),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  ativo boolean NOT NULL DEFAULT true,
  UNIQUE (instituicao_id, id), UNIQUE (instituicao_id, nome)
);

CREATE TABLE vinculo_institucional (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL REFERENCES instituicao(id),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  perfil text NOT NULL CHECK (perfil IN ('ADMINISTRADOR', 'COLABORADOR')),
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  cargo_id uuid, telefone text, registro_profissional text,
  data_nascimento date, cpf varchar(11), rg text,
  endereco jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(endereco) = 'object'),
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  desativado_em timestamptz,
  UNIQUE (instituicao_id, id), UNIQUE (instituicao_id, usuario_id),
  FOREIGN KEY (instituicao_id, cargo_id) REFERENCES cargo(instituicao_id, id),
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')
);

CREATE TABLE tipo_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  encerra_acolhimento boolean NOT NULL DEFAULT false,
  geracao_cadastral boolean NOT NULL DEFAULT false
);

CREATE TABLE permissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE, nome text NOT NULL,
  tipo_documento_id uuid REFERENCES tipo_documento(id)
);
CREATE TABLE permissao_vinculo (
  instituicao_id uuid NOT NULL,
  vinculo_id uuid NOT NULL,
  permissao_id uuid NOT NULL REFERENCES permissao(id),
  concedida_por uuid NOT NULL REFERENCES usuario(id),
  concedida_em timestamptz NOT NULL DEFAULT now(),
  ativa boolean NOT NULL DEFAULT true,
  PRIMARY KEY (instituicao_id, vinculo_id, permissao_id),
  FOREIGN KEY (instituicao_id, vinculo_id)
    REFERENCES vinculo_institucional(instituicao_id, id)
);

CREATE TABLE sessao_usuario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuario(id),
  token_hash char(64) NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  instituicao_selecionada_id uuid REFERENCES instituicao(id),
  versao_credencial integer NOT NULL CHECK (versao_credencial > 0),
  criado_em timestamptz NOT NULL DEFAULT now(),
  expira_em timestamptz NOT NULL,
  revogada_em timestamptz,
  CHECK (expira_em > criado_em)
);

CREATE TABLE paciente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL REFERENCES instituicao(id),
  nome_completo text NOT NULL CHECK (btrim(nome_completo) <> ''),
  apelido text, cpf varchar(11), rg text, data_nascimento date,
  nacionalidade text, naturalidade text, municipio_origem text,
  nome_pai text, nome_mae text, escolaridade text, profissao text,
  cor_raca text, estado_civil text, possui_filhos boolean,
  endereco jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(endereco) = 'object'),
  primeira_droga_licita text, idade_primeira_droga_licita smallint,
  primeira_droga_ilicita text, idade_primeira_droga_ilicita smallint,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instituicao_id, id),
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$'),
  CHECK (idade_primeira_droga_licita BETWEEN 0 AND 130),
  CHECK (idade_primeira_droga_ilicita BETWEEN 0 AND 130)
);
CREATE UNIQUE INDEX paciente_cpf_unico ON paciente(instituicao_id, cpf) WHERE cpf IS NOT NULL;
CREATE INDEX paciente_nome_busca ON paciente(instituicao_id, lower(nome_completo));

CREATE TABLE responsavel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL,
  paciente_id uuid NOT NULL,
  nome text NOT NULL CHECK (btrim(nome) <> ''),
  parentesco text, cpf varchar(11), rg text, telefone text, endereco text,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instituicao_id, id),
  FOREIGN KEY (instituicao_id, paciente_id) REFERENCES paciente(instituicao_id, id),
  CHECK (cpf IS NULL OR cpf ~ '^[0-9]{11}$')
);
CREATE TABLE tipo_dependencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE, nome text NOT NULL, ordem smallint NOT NULL
);
CREATE TABLE paciente_dependencia (
  instituicao_id uuid NOT NULL, paciente_id uuid NOT NULL,
  tipo_dependencia_id uuid NOT NULL REFERENCES tipo_dependencia(id),
  ativa boolean NOT NULL DEFAULT true,
  PRIMARY KEY (instituicao_id, paciente_id, tipo_dependencia_id),
  FOREIGN KEY (instituicao_id, paciente_id) REFERENCES paciente(instituicao_id, id)
);

CREATE TABLE acolhimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL, paciente_id uuid NOT NULL,
  data_entrada date NOT NULL, convenio text, chave_sisreg text,
  data_saida date, motivo_saida text,
  documento_desligamento_id uuid,
  encerrado_por uuid REFERENCES usuario(id), encerrado_em timestamptz,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instituicao_id, id),
  UNIQUE (instituicao_id, paciente_id, id),
  FOREIGN KEY (instituicao_id, paciente_id) REFERENCES paciente(instituicao_id, id),
  CHECK (data_saida IS NULL OR data_saida >= data_entrada),
  CHECK ((data_saida IS NULL AND encerrado_em IS NULL AND encerrado_por IS NULL
       AND documento_desligamento_id IS NULL AND motivo_saida IS NULL)
      OR (data_saida IS NOT NULL AND encerrado_em IS NOT NULL AND encerrado_por IS NOT NULL
       AND documento_desligamento_id IS NOT NULL AND nullif(btrim(motivo_saida), '') IS NOT NULL))
);
CREATE UNIQUE INDEX acolhimento_unico_aberto ON acolhimento(instituicao_id, paciente_id)
  WHERE encerrado_em IS NULL;

CREATE TABLE modelo_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_documento_id uuid NOT NULL REFERENCES tipo_documento(id),
  versao integer NOT NULL CHECK (versao > 0),
  campos jsonb NOT NULL CHECK (jsonb_typeof(campos) = 'object'),
  assinantes jsonb NOT NULL DEFAULT '[]' CHECK (jsonb_typeof(assinantes) = 'array'),
  texto_fixo text NOT NULL DEFAULT '', identificador_layout text NOT NULL,
  publicado_em timestamptz NOT NULL DEFAULT now(),
  publicado_por uuid NOT NULL REFERENCES usuario(id),
  UNIQUE (tipo_documento_id, versao)
);

CREATE TABLE documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL, paciente_id uuid NOT NULL, acolhimento_id uuid NOT NULL,
  codigo bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  modelo_documento_id uuid NOT NULL REFERENCES modelo_documento(id),
  dados jsonb NOT NULL CHECK (jsonb_typeof(dados) = 'object'),
  dados_paciente jsonb NOT NULL CHECK (jsonb_typeof(dados_paciente) = 'object'),
  dados_instituicao jsonb NOT NULL CHECK (jsonb_typeof(dados_instituicao) = 'object'),
  dados_autor jsonb NOT NULL CHECK (jsonb_typeof(dados_autor) = 'object'),
  assinantes jsonb NOT NULL CHECK (jsonb_typeof(assinantes) = 'array'),
  hash_conteudo char(64) NOT NULL CHECK (hash_conteudo ~ '^[0-9a-f]{64}$'),
  data_atendimento timestamptz,
  data_desligamento date, motivo_desligamento text,
  corrige_documento_id uuid,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  desconsiderado_em timestamptz,
  desconsiderado_por uuid REFERENCES usuario(id),
  justificativa_desconsideracao text,
  UNIQUE (instituicao_id, id),
  UNIQUE (instituicao_id, paciente_id, acolhimento_id, id),
  FOREIGN KEY (instituicao_id, paciente_id, acolhimento_id)
    REFERENCES acolhimento(instituicao_id, paciente_id, id),
  FOREIGN KEY (instituicao_id, paciente_id, acolhimento_id, corrige_documento_id)
    REFERENCES documento(instituicao_id, paciente_id, acolhimento_id, id),
  CHECK (corrige_documento_id IS NULL OR corrige_documento_id <> id),
  CHECK ((desconsiderado_em IS NULL AND desconsiderado_por IS NULL AND justificativa_desconsideracao IS NULL)
      OR (desconsiderado_em IS NOT NULL AND desconsiderado_por IS NOT NULL
       AND nullif(btrim(justificativa_desconsideracao), '') IS NOT NULL)),
  CHECK ((data_desligamento IS NULL AND motivo_desligamento IS NULL)
      OR (data_desligamento IS NOT NULL AND nullif(btrim(motivo_desligamento), '') IS NOT NULL))
);
ALTER TABLE acolhimento ADD CONSTRAINT acolhimento_documento_saida_fk
  FOREIGN KEY (instituicao_id, paciente_id, id, documento_desligamento_id)
  REFERENCES documento(instituicao_id, paciente_id, acolhimento_id, id);
CREATE INDEX documento_historico ON documento(instituicao_id, acolhimento_id, criado_em);

CREATE TABLE documento_arquivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL, documento_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('ORIGINAL', 'DIGITALIZACAO')),
  numero_envio integer,
  chave_armazenamento text NOT NULL UNIQUE CHECK (btrim(chave_armazenamento) <> ''),
  nome_original text, mime_type text NOT NULL CHECK (mime_type = 'application/pdf'),
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  hash_arquivo char(64) NOT NULL CHECK (hash_arquivo ~ '^[0-9a-f]{64}$'),
  enviado_por uuid NOT NULL REFERENCES usuario(id),
  enviado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (instituicao_id, id), UNIQUE (instituicao_id, documento_id, numero_envio),
  UNIQUE (instituicao_id, documento_id, id),
  FOREIGN KEY (instituicao_id, documento_id) REFERENCES documento(instituicao_id, id),
  CHECK ((tipo = 'ORIGINAL' AND numero_envio IS NULL)
      OR (tipo = 'DIGITALIZACAO' AND numero_envio > 0))
);
CREATE UNIQUE INDEX documento_original_unico ON documento_arquivo(documento_id) WHERE tipo = 'ORIGINAL';

CREATE TABLE conferencia_assinatura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL, documento_id uuid NOT NULL,
  arquivo_id uuid NOT NULL UNIQUE,
  decisao text NOT NULL CHECK (decisao IN ('APROVADA', 'REJEITADA')),
  justificativa text,
  conferido_por uuid NOT NULL REFERENCES usuario(id),
  conferido_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (instituicao_id, documento_id, arquivo_id)
    REFERENCES documento_arquivo(instituicao_id, documento_id, id),
  CHECK (decisao <> 'REJEITADA' OR nullif(btrim(justificativa), '') IS NOT NULL)
);
CREATE UNIQUE INDEX documento_aprovacao_unica ON conferencia_assinatura(documento_id)
  WHERE decisao = 'APROVADA';

CREATE TABLE documento_evento (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instituicao_id uuid NOT NULL, documento_id uuid NOT NULL,
  arquivo_id uuid, acao text NOT NULL, justificativa text,
  autor_id uuid NOT NULL REFERENCES usuario(id),
  ocorrido_em timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (instituicao_id, documento_id) REFERENCES documento(instituicao_id, id),
  FOREIGN KEY (instituicao_id, documento_id, arquivo_id)
    REFERENCES documento_arquivo(instituicao_id, documento_id, id)
);
CREATE INDEX documento_evento_historico ON documento_evento(instituicao_id, documento_id, ocorrido_em);

CREATE TABLE auditoria (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  instituicao_id uuid REFERENCES instituicao(id),
  autor_id uuid REFERENCES usuario(id),
  entidade text NOT NULL, registro_id text NOT NULL,
  acao text NOT NULL, justificativa text,
  antes jsonb, depois jsonb,
  ocorrido_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auditoria_instituicao ON auditoria(instituicao_id, ocorrido_em);
CREATE INDEX auditoria_usuario ON auditoria(instituicao_id, autor_id, ocorrido_em);

CREATE TABLE aviso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instituicao_id uuid NOT NULL REFERENCES instituicao(id),
  mensagem text NOT NULL CHECK (btrim(mensagem) <> ''),
  inicio_em timestamptz NOT NULL, fim_em timestamptz NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid NOT NULL REFERENCES usuario(id),
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  CHECK (fim_em >= inicio_em)
);
CREATE TABLE configuracao_institucional (
  instituicao_id uuid PRIMARY KEY REFERENCES instituicao(id),
  cabecalho jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(cabecalho) = 'object'),
  rodape jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(rodape) = 'object'),
  atualizado_por uuid NOT NULL REFERENCES usuario(id),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Imutabilidade: dados emitidos, arquivos, conferencias e historicos nao sao editados.
CREATE FUNCTION impedir_alteracao() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Registro preservado: % nao permite %.', TG_TABLE_NAME, TG_OP; END $$;
CREATE FUNCTION proteger_documento() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
BEGIN
  IF (to_jsonb(NEW) - ARRAY['desconsiderado_em','desconsiderado_por','justificativa_desconsideracao'])
    IS DISTINCT FROM
     (to_jsonb(OLD) - ARRAY['desconsiderado_em','desconsiderado_por','justificativa_desconsideracao']) THEN
    RAISE EXCEPTION 'Conteudo emitido e imutavel. Crie outro documento.';
  END IF;
  IF OLD.desconsiderado_em IS NOT NULL OR NEW.desconsiderado_em IS NULL THEN
    RAISE EXCEPTION 'Documento desconsiderado nao pode ser reativado ou alterado.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id=NEW.desconsiderado_por AND u.ativo AND
    (u.super_administrador OR EXISTS (SELECT 1 FROM vinculo_institucional v
      JOIN instituicao i ON i.id=v.instituicao_id WHERE v.usuario_id=u.id
      AND v.instituicao_id=NEW.instituicao_id AND v.ativo AND i.ativa AND v.perfil='ADMINISTRADOR'))) THEN
    RAISE EXCEPTION 'Desconsideracao exige administrador.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_imutavel BEFORE UPDATE ON documento FOR EACH ROW EXECUTE FUNCTION proteger_documento();

DO $$ DECLARE nome text; BEGIN
  FOREACH nome IN ARRAY ARRAY['modelo_documento','documento_arquivo','conferencia_assinatura','documento_evento','auditoria'] LOOP
    EXECUTE format('CREATE TRIGGER preservar_registro BEFORE UPDATE OR DELETE OR TRUNCATE ON reabilitah.%I FOR EACH STATEMENT EXECUTE FUNCTION reabilitah.impedir_alteracao()', nome);
  END LOOP;
  FOREACH nome IN ARRAY ARRAY['usuario','instituicao','cargo','vinculo_institucional','permissao_vinculo','paciente','responsavel','paciente_dependencia','acolhimento','documento','aviso','configuracao_institucional'] LOOP
    EXECUTE format('CREATE TRIGGER impedir_exclusao BEFORE DELETE OR TRUNCATE ON reabilitah.%I FOR EACH STATEMENT EXECUTE FUNCTION reabilitah.impedir_alteracao()', nome);
  END LOOP;
END $$;

-- Modelo publicado e anexos dependem da mesma emissao, nao do cadastro atual.
CREATE FUNCTION validar_emissao() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
DECLARE m modelo_documento; t tipo_documento; a acolhimento;
BEGIN
  SELECT * INTO STRICT m FROM modelo_documento WHERE id = NEW.modelo_documento_id;
  SELECT * INTO STRICT t FROM tipo_documento WHERE id = m.tipo_documento_id;
  SELECT * INTO STRICT a FROM acolhimento WHERE id = NEW.acolhimento_id AND instituicao_id = NEW.instituicao_id FOR UPDATE;
  IF a.encerrado_em IS NOT NULL THEN RAISE EXCEPTION 'Acolhimento encerrado: abra uma readmissao.'; END IF;
  IF NEW.assinantes IS DISTINCT FROM m.assinantes THEN RAISE EXCEPTION 'Assinantes devem seguir o modelo.'; END IF;
  IF t.encerra_acolhimento <> (NEW.data_desligamento IS NOT NULL) THEN RAISE EXCEPTION 'Dados de desligamento incompatíveis com o tipo.'; END IF;
  IF NEW.data_desligamento < a.data_entrada THEN RAISE EXCEPTION 'Saida anterior a entrada.'; END IF;
  IF t.geracao_cadastral AND EXISTS (
    SELECT 1 FROM documento d JOIN modelo_documento md ON md.id=d.modelo_documento_id
    JOIN tipo_documento td ON td.id=md.tipo_documento_id
    WHERE d.acolhimento_id=NEW.acolhimento_id AND td.geracao_cadastral AND d.desconsiderado_em IS NULL
  ) THEN RAISE EXCEPTION 'Ja existe ficha vigente. Desconsidere a anterior na mesma transacao.'; END IF;
  NEW.hash_conteudo := encode(sha256(convert_to(jsonb_build_object(
    'dados', NEW.dados, 'paciente', NEW.dados_paciente, 'instituicao', NEW.dados_instituicao,
    'autor', NEW.dados_autor, 'modelo', NEW.modelo_documento_id, 'assinantes', NEW.assinantes,
    'atendimento', NEW.data_atendimento, 'saida', NEW.data_desligamento, 'motivo', NEW.motivo_desligamento
  )::text,'UTF8')), 'hex');
  RETURN NEW;
END $$;
CREATE TRIGGER validar_documento BEFORE INSERT ON documento FOR EACH ROW EXECUTE FUNCTION validar_emissao();

CREATE FUNCTION validar_arquivo() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
DECLARE d documento;
BEGIN
  SELECT * INTO STRICT d FROM documento WHERE id=NEW.documento_id AND instituicao_id=NEW.instituicao_id FOR UPDATE;
  IF d.desconsiderado_em IS NOT NULL THEN RAISE EXCEPTION 'Documento desconsiderado.'; END IF;
  IF NEW.tipo='DIGITALIZACAO' THEN
    IF jsonb_array_length(d.assinantes)=0 THEN RAISE EXCEPTION 'Documento nao exige assinatura.'; END IF;
    IF EXISTS (SELECT 1 FROM conferencia_assinatura WHERE documento_id=d.id AND decisao='APROVADA') THEN
      RAISE EXCEPTION 'Documento ja aprovado: nao permite novo envio.';
    END IF;
    IF EXISTS (SELECT 1 FROM documento_arquivo f WHERE f.documento_id=d.id AND f.tipo='DIGITALIZACAO'
      AND NOT EXISTS (SELECT 1 FROM conferencia_assinatura c WHERE c.arquivo_id=f.id)) THEN
      RAISE EXCEPTION 'Existe envio aguardando conferencia.';
    END IF;
    NEW.numero_envio := 1 + coalesce((SELECT max(numero_envio) FROM documento_arquivo WHERE documento_id=d.id),0);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER validar_envio BEFORE INSERT ON documento_arquivo FOR EACH ROW EXECUTE FUNCTION validar_arquivo();

CREATE FUNCTION validar_conferencia() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
DECLARE d documento; f documento_arquivo; encerra boolean;
BEGIN
  SELECT * INTO STRICT d FROM documento WHERE id=NEW.documento_id AND instituicao_id=NEW.instituicao_id FOR UPDATE;
  SELECT * INTO STRICT f FROM documento_arquivo WHERE id=NEW.arquivo_id AND documento_id=d.id;
  IF d.desconsiderado_em IS NOT NULL OR f.tipo<>'DIGITALIZACAO' THEN RAISE EXCEPTION 'Arquivo nao pode ser conferido.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM usuario u WHERE u.id=NEW.conferido_por AND u.ativo AND
    (u.super_administrador OR EXISTS (SELECT 1 FROM vinculo_institucional v
      JOIN instituicao i ON i.id=v.instituicao_id
      WHERE v.usuario_id=u.id AND v.instituicao_id=d.instituicao_id AND v.ativo AND i.ativa AND v.perfil='ADMINISTRADOR'))) THEN
    RAISE EXCEPTION 'Conferencia exige administrador ativo da instituicao ou super administrador.';
  END IF;
  SELECT t.encerra_acolhimento INTO encerra FROM modelo_documento m JOIN tipo_documento t ON t.id=m.tipo_documento_id WHERE m.id=d.modelo_documento_id;
  IF NEW.decisao='APROVADA' AND encerra THEN
    UPDATE acolhimento SET data_saida=d.data_desligamento, motivo_saida=d.motivo_desligamento,
      documento_desligamento_id=d.id, encerrado_por=NEW.conferido_por, encerrado_em=NEW.conferido_em,
      atualizado_em=now() WHERE id=d.acolhimento_id AND encerrado_em IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'Acolhimento ja encerrado.'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER conferir_arquivo BEFORE INSERT ON conferencia_assinatura FOR EACH ROW EXECUTE FUNCTION validar_conferencia();

CREATE FUNCTION registrar_evento_documento() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
BEGIN
  IF TG_TABLE_NAME='documento' THEN
    INSERT INTO documento_evento(instituicao_id,documento_id,acao,autor_id,justificativa)
      VALUES(NEW.instituicao_id,NEW.id,CASE WHEN TG_OP='INSERT' THEN 'EMISSAO' ELSE 'DESCONSIDERACAO' END,
        CASE WHEN TG_OP='INSERT' THEN NEW.criado_por ELSE NEW.desconsiderado_por END,NEW.justificativa_desconsideracao);
  ELSIF TG_TABLE_NAME='documento_arquivo' THEN
    INSERT INTO documento_evento(instituicao_id,documento_id,arquivo_id,acao,autor_id)
      VALUES(NEW.instituicao_id,NEW.documento_id,NEW.id,NEW.tipo || '_ARMAZENADO',NEW.enviado_por);
  ELSE
    INSERT INTO documento_evento(instituicao_id,documento_id,arquivo_id,acao,autor_id,justificativa)
      VALUES(NEW.instituicao_id,NEW.documento_id,NEW.arquivo_id,'CONFERENCIA_' || NEW.decisao,NEW.conferido_por,NEW.justificativa);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER evento_emissao AFTER INSERT OR UPDATE ON documento FOR EACH ROW EXECUTE FUNCTION registrar_evento_documento();
CREATE TRIGGER evento_envio AFTER INSERT ON documento_arquivo FOR EACH ROW EXECUTE FUNCTION registrar_evento_documento();
CREATE TRIGGER evento_conferencia AFTER INSERT ON conferencia_assinatura FOR EACH ROW EXECUTE FUNCTION registrar_evento_documento();

-- Esse contexto so sera usado por conexoes do servidor; nao e credencial do navegador.
CREATE FUNCTION registrar_auditoria() RETURNS trigger LANGUAGE plpgsql
  SET search_path = reabilitah, pg_catalog AS $$
DECLARE antes jsonb; depois jsonb; autor uuid; inst uuid;
BEGIN
  depois := to_jsonb(NEW) - ARRAY['senha_hash','token_hash'];
  IF TG_OP='UPDATE' THEN antes := to_jsonb(OLD) - ARRAY['senha_hash','token_hash']; END IF;
  autor := nullif(current_setting('reabilitah.autor_id',true),'')::uuid;
  IF autor IS NULL AND TG_OP='INSERT' THEN
    autor := coalesce((depois->>'criado_por')::uuid,(depois->>'publicado_por')::uuid,
      (depois->>'concedida_por')::uuid,(depois->>'atualizado_por')::uuid);
  END IF;
  IF TG_OP='UPDATE' AND autor IS NULL THEN
    RAISE EXCEPTION 'Alteracao exige identificar o autor na transacao.';
  END IF;
  inst := (depois->>'instituicao_id')::uuid;
  IF TG_TABLE_NAME='instituicao' THEN inst := NEW.id; END IF;
  INSERT INTO auditoria(instituicao_id,autor_id,entidade,registro_id,acao,antes,depois)
    VALUES(inst,autor,TG_TABLE_NAME,coalesce(depois->>'id',depois->>'vinculo_id',depois->>'paciente_id',depois->>'instituicao_id'),TG_OP,antes,depois);
  RETURN NEW;
END $$;
DO $$ DECLARE nome text; BEGIN
  FOREACH nome IN ARRAY ARRAY['usuario','instituicao','cargo','vinculo_institucional','permissao_vinculo','paciente','responsavel','paciente_dependencia','modelo_documento','aviso','configuracao_institucional'] LOOP
    EXECUTE format('CREATE TRIGGER auditar_registro AFTER INSERT OR UPDATE ON reabilitah.%I FOR EACH ROW EXECUTE FUNCTION reabilitah.registrar_auditoria()',nome);
  END LOOP;
END $$;

DO $$ DECLARE r record; BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname='reabilitah' LOOP
    EXECUTE format('ALTER TABLE reabilitah.%I ENABLE ROW LEVEL SECURITY',r.tablename);
    EXECUTE format('ALTER TABLE reabilitah.%I FORCE ROW LEVEL SECURITY',r.tablename);
  END LOOP;
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA reabilitah FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA reabilitah FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA reabilitah FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA reabilitah REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

INSERT INTO tipo_documento(codigo,nome,encerra_acolhimento,geracao_cadastral) VALUES
 ('ficha-acolhimento','Ficha de Acolhimento',false,true),
 ('termo-acolhimento','Termo de Acolhimento',false,false),
 ('evolucao-geral','Evolucao Geral',false,false),
 ('declaracao-desligamento','Declaracao de Desligamento',true,false),
 ('evolucao-enfermagem','Evolucao de Enfermagem',false,false);
INSERT INTO permissao(codigo,nome) VALUES
 ('pacientes.cadastrar','Cadastrar pacientes'), ('pacientes.corrigir','Corrigir cadastro de pacientes'),
 ('pacientes.readmitir','Readmitir pacientes'), ('documentos.enviar-digitalizacao','Enviar digitalizacoes');
INSERT INTO permissao(codigo,nome,tipo_documento_id)
 SELECT 'documentos.criar.' || codigo,'Criar ' || nome,id FROM tipo_documento WHERE NOT geracao_cadastral;

DO $$ BEGIN
  IF current_database() <> 'reabilitah' THEN RAISE EXCEPTION 'Conecte ao banco reabilitah.'; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='reabilitah_runtime') THEN
    CREATE ROLE reabilitah_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;
CREATE SCHEMA reabilitah_auth;
REVOKE ALL ON SCHEMA reabilitah_auth FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA reabilitah_auth REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE TABLE reabilitah_auth.tentativa_login (
  chave char(64) PRIMARY KEY, inicio timestamptz NOT NULL, quantidade integer NOT NULL CHECK (quantidade > 0)
);
CREATE INDEX tentativa_login_expiracao ON reabilitah_auth.tentativa_login(inicio);
REVOKE ALL ON reabilitah_auth.tentativa_login FROM PUBLIC;

CREATE FUNCTION reabilitah_auth.reservar_tentativa(chave_email text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE total integer;
BEGIN
  IF chave_email !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Chave invalida.'; END IF;
  DELETE FROM reabilitah_auth.tentativa_login WHERE inicio < clock_timestamp()-interval '1 day';
  INSERT INTO reabilitah_auth.tentativa_login AS t VALUES (chave_email,clock_timestamp(),1)
  ON CONFLICT (chave) DO UPDATE SET
    quantidade=CASE WHEN t.inicio < clock_timestamp()-interval '15 minutes' THEN 1 ELSE t.quantidade+1 END,
    inicio=CASE WHEN t.inicio < clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE t.inicio END
  RETURNING quantidade INTO total;
  RETURN total <= 8;
END $$;

CREATE FUNCTION reabilitah_auth.credencial(email_busca text)
RETURNS TABLE(id uuid,senha_hash text,versao_credencial integer)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT u.id,u.senha_hash,u.versao_credencial FROM reabilitah.usuario u
  WHERE lower(btrim(u.email))=lower(btrim(email_busca)) AND u.ativo
$$;

CREATE FUNCTION reabilitah_auth.sessao_atual()
RETURNS TABLE(usuario_id uuid,email text,super_administrador boolean,exige_troca_senha boolean,instituicao_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT u.id,u.email,u.super_administrador,u.exige_troca_senha,s.instituicao_selecionada_id
  FROM reabilitah.sessao_usuario s JOIN reabilitah.usuario u ON u.id=s.usuario_id
  WHERE s.token_hash=nullif(current_setting('reabilitah.token_hash',true),'')
    AND s.revogada_em IS NULL AND s.expira_em > statement_timestamp()
    AND s.versao_credencial=u.versao_credencial AND u.ativo
$$;

CREATE FUNCTION reabilitah_auth.abrir_sessao(alvo uuid,versao integer,hash_token text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE sessao_id uuid;
BEGIN
  PERFORM 1 FROM reabilitah.usuario WHERE id=alvo AND ativo AND versao_credencial=versao FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credencial alterada. Entre novamente.'; END IF;
  INSERT INTO reabilitah.sessao_usuario(usuario_id,token_hash,versao_credencial,expira_em)
    VALUES(alvo,hash_token,versao,clock_timestamp()+interval '8 hours') RETURNING id INTO sessao_id;
  INSERT INTO reabilitah.auditoria(autor_id,entidade,registro_id,acao) VALUES(alvo,'sessao_usuario',sessao_id::text,'LOGIN');
  DELETE FROM reabilitah_auth.tentativa_login WHERE chave=(
    SELECT encode(sha256(convert_to(lower(btrim(email)),'UTF8')),'hex') FROM reabilitah.usuario WHERE id=alvo
  );
END $$;

CREATE FUNCTION reabilitah_auth.instituicoes_disponiveis() RETURNS TABLE(id uuid,nome text,perfil text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT i.id,i.nome,CASE WHEN s.super_administrador THEN 'SUPER_ADMINISTRADOR' ELSE v.perfil END
  FROM reabilitah_auth.sessao_atual() s CROSS JOIN reabilitah.instituicao i
  LEFT JOIN reabilitah.vinculo_institucional v ON v.instituicao_id=i.id AND v.usuario_id=s.usuario_id AND v.ativo
  WHERE i.ativa AND NOT s.exige_troca_senha AND (s.super_administrador OR v.id IS NOT NULL)
  ORDER BY i.nome,i.id
$$;

CREATE FUNCTION reabilitah_auth.pode_ler(inst uuid,administracao boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT EXISTS (
    SELECT FROM reabilitah_auth.sessao_atual() s JOIN reabilitah.instituicao i ON i.id=inst AND i.ativa
    WHERE NOT s.exige_troca_senha AND s.instituicao_id=inst AND
      (s.super_administrador OR EXISTS (
        SELECT FROM reabilitah.vinculo_institucional v WHERE v.usuario_id=s.usuario_id
          AND v.instituicao_id=inst AND v.ativo AND (NOT administracao OR v.perfil='ADMINISTRADOR')
      ))
  )
$$;

CREATE FUNCTION reabilitah_auth.selecionar_instituicao(inst uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid; sessao_id uuid;
BEGIN
  SELECT usuario_id INTO autor FROM reabilitah_auth.sessao_atual();
  IF NOT EXISTS (SELECT FROM reabilitah_auth.instituicoes_disponiveis() WHERE id=inst) THEN
    RAISE EXCEPTION 'Instituicao indisponivel para este acesso.';
  END IF;
  UPDATE reabilitah.sessao_usuario SET instituicao_selecionada_id=inst
    WHERE token_hash=current_setting('reabilitah.token_hash',true) RETURNING id INTO sessao_id;
  INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao)
    VALUES(inst,autor,'sessao_usuario',sessao_id::text,'SELECIONAR_INSTITUICAO');
END $$;

CREATE FUNCTION reabilitah_auth.encerrar_sessao() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s record; sessao_id uuid;
BEGIN
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  IF s.usuario_id IS NULL THEN RETURN; END IF;
  UPDATE reabilitah.sessao_usuario SET revogada_em=clock_timestamp()
    WHERE token_hash=current_setting('reabilitah.token_hash',true) RETURNING id INTO sessao_id;
  INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao)
    VALUES(s.instituicao_id,s.usuario_id,'sessao_usuario',sessao_id::text,'LOGOUT');
END $$;

CREATE FUNCTION reabilitah_auth.minha_credencial() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT u.senha_hash FROM reabilitah.usuario u JOIN reabilitah_auth.sessao_atual() s ON s.usuario_id=u.id
$$;

CREATE FUNCTION reabilitah_auth.trocar_senha(novo_hash text,hash_anterior text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s record;
BEGIN
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  IF s.usuario_id IS NULL OR novo_hash IS NULL OR novo_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$' THEN RAISE EXCEPTION 'Alteracao nao autorizada.'; END IF;
  PERFORM set_config('reabilitah.autor_id',s.usuario_id::text,true);
  UPDATE reabilitah.usuario SET senha_hash=novo_hash,exige_troca_senha=false,
    versao_credencial=versao_credencial+1,atualizado_em=clock_timestamp()
    WHERE id=s.usuario_id AND senha_hash=hash_anterior AND ativo;
  IF NOT FOUND THEN RAISE EXCEPTION 'Credencial alterada. Entre novamente.'; END IF;
  UPDATE reabilitah.sessao_usuario SET revogada_em=clock_timestamp() WHERE usuario_id=s.usuario_id AND revogada_em IS NULL;
  INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao)
    VALUES(s.instituicao_id,s.usuario_id,'usuario',s.usuario_id::text,'TROCAR_SENHA');
END $$;

-- API restrita: nao permite um administrador assumir a identidade do autor.
CREATE FUNCTION reabilitah_auth.redefinir_senha(alvo uuid,novo_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE s record; total integer;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  IF s.usuario_id IS NULL OR s.exige_troca_senha OR novo_hash IS NULL OR novo_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$' THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  IF alvo=s.usuario_id THEN RAISE EXCEPTION 'PROPRIO_ACESSO'; END IF;
  PERFORM 1 FROM reabilitah.usuario WHERE id=alvo AND ativo FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTA_INDISPONIVEL'; END IF;
  IF NOT s.super_administrador THEN
    IF NOT reabilitah_auth.pode_ler(s.instituicao_id,true) OR NOT EXISTS (
      SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=alvo AND instituicao_id=s.instituicao_id AND ativo
    ) OR EXISTS (SELECT FROM reabilitah.usuario WHERE id=alvo AND super_administrador) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
    SELECT count(*) INTO total FROM reabilitah.vinculo_institucional WHERE usuario_id=alvo AND ativo;
    IF total>1 THEN RAISE EXCEPTION 'RESET_MULTIPLAS_INSTITUICOES'; END IF;
  END IF;
  PERFORM set_config('reabilitah.autor_id',s.usuario_id::text,true);
  UPDATE reabilitah.usuario SET senha_hash=novo_hash,exige_troca_senha=true,versao_credencial=versao_credencial+1,atualizado_em=clock_timestamp() WHERE id=alvo;
  UPDATE reabilitah.sessao_usuario SET revogada_em=clock_timestamp() WHERE usuario_id=alvo AND revogada_em IS NULL;
  INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao) VALUES(s.instituicao_id,s.usuario_id,'usuario',alvo::text,'REDEFINIR_SENHA');
END $$;

-- Nenhum INSERT/UPDATE/DELETE direto e autorizado para a aplicacao.
GRANT USAGE ON SCHEMA reabilitah,reabilitah_auth TO reabilitah_runtime;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA reabilitah_auth TO reabilitah_runtime;
DO $$ DECLARE nome text; BEGIN
  FOREACH nome IN ARRAY ARRAY['paciente','responsavel','acolhimento','documento','documento_arquivo','conferencia_assinatura','documento_evento','paciente_dependencia','cargo','permissao_vinculo','aviso','configuracao_institucional'] LOOP
    EXECUTE format('GRANT SELECT ON reabilitah.%I TO reabilitah_runtime',nome);
    EXECUTE format('CREATE POLICY isolamento_leitura ON reabilitah.%I FOR SELECT TO reabilitah_runtime USING (reabilitah_auth.pode_ler(instituicao_id))',nome);
  END LOOP;
  FOREACH nome IN ARRAY ARRAY['tipo_documento','permissao','tipo_dependencia','modelo_documento'] LOOP
    EXECUTE format('GRANT SELECT ON reabilitah.%I TO reabilitah_runtime',nome);
    EXECUTE format('CREATE POLICY catalogo_autenticado ON reabilitah.%I FOR SELECT TO reabilitah_runtime USING (EXISTS (SELECT FROM reabilitah_auth.sessao_atual() s WHERE NOT s.exige_troca_senha))',nome);
  END LOOP;
END $$;
GRANT SELECT ON reabilitah.instituicao,reabilitah.vinculo_institucional,reabilitah.auditoria TO reabilitah_runtime;
CREATE POLICY instituicoes_autorizadas ON reabilitah.instituicao FOR SELECT TO reabilitah_runtime
  USING (id IN (SELECT id FROM reabilitah_auth.instituicoes_disponiveis()));
CREATE POLICY equipe_administrador ON reabilitah.vinculo_institucional FOR SELECT TO reabilitah_runtime
  USING (reabilitah_auth.pode_ler(instituicao_id,true));
CREATE POLICY historico_administrador ON reabilitah.auditoria FOR SELECT TO reabilitah_runtime USING (
  reabilitah_auth.pode_ler(instituicao_id,true) OR EXISTS (
    SELECT FROM reabilitah_auth.sessao_atual() s WHERE s.super_administrador AND NOT s.exige_troca_senha
  )
);
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA reabilitah_auth FROM PUBLIC;

CREATE SCHEMA IF NOT EXISTS reabilitah_gestao;
REVOKE ALL ON SCHEMA reabilitah_gestao FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA reabilitah_gestao REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER TABLE reabilitah.instituicao ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
ALTER TABLE reabilitah.vinculo_institucional ADD COLUMN IF NOT EXISTS versao integer NOT NULL DEFAULT 1;
CREATE INDEX IF NOT EXISTS vinculo_usuario_ativo ON reabilitah.vinculo_institucional(usuario_id, instituicao_id) WHERE ativo;
CREATE INDEX IF NOT EXISTS evento_autor_instituicao ON reabilitah.documento_evento(instituicao_id, autor_id, ocorrido_em DESC);

-- Alterações de acesso compartilham o bloqueio, inclusive vínculos e redefinição de senha.
CREATE FUNCTION reabilitah_gestao.bloquear_alteracao() RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM set_config('lock_timeout','5s',true);
  PERFORM pg_advisory_xact_lock(781924631);
END $$;

CREATE FUNCTION reabilitah_gestao.autor_super() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid;
BEGIN
  SELECT usuario_id INTO autor FROM reabilitah_auth.sessao_atual()
    WHERE super_administrador AND NOT exige_troca_senha;
  IF autor IS NULL THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  RETURN autor;
END $$;

CREATE FUNCTION reabilitah_gestao.autor_gestor(inst uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid;
BEGIN
  IF NOT reabilitah_auth.pode_ler(inst,true) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT usuario_id INTO autor FROM reabilitah_auth.sessao_atual();
  RETURN autor;
END $$;

CREATE FUNCTION reabilitah_gestao.pode_executar(inst uuid, codigo_permissao text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT reabilitah_auth.pode_ler(inst) AND EXISTS (
    SELECT FROM reabilitah.permissao p CROSS JOIN reabilitah_auth.sessao_atual() s
    WHERE p.codigo=codigo_permissao AND (s.super_administrador OR EXISTS (
      SELECT FROM reabilitah.vinculo_institucional v WHERE v.instituicao_id=inst AND v.usuario_id=s.usuario_id AND v.ativo
      AND (v.perfil='ADMINISTRADOR' OR EXISTS (
        SELECT FROM reabilitah.permissao_vinculo pv WHERE pv.vinculo_id=v.id AND pv.permissao_id=p.id AND pv.ativa
      ))
    ))
  )
$$;

CREATE FUNCTION reabilitah_gestao.salvar_instituicao(alvo uuid, dados jsonb, versao_esperada integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid; resultado uuid;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  autor := reabilitah_gestao.autor_super();
  IF jsonb_typeof(dados) IS DISTINCT FROM 'object' OR length(btrim(coalesce(dados->>'nome',''))) NOT BETWEEN 2 AND 160
    OR length(coalesce(dados->>'nome_legal',''))>200 OR length(coalesce(dados->>'telefone',''))>30
    OR length(coalesce(dados->>'email',''))>254
    OR (nullif(dados->>'cnpj','') IS NOT NULL AND dados->>'cnpj' !~ '^[0-9]{14}$') THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  PERFORM set_config('reabilitah.autor_id',autor::text,true);
  IF alvo IS NULL THEN
    INSERT INTO reabilitah.instituicao(nome,nome_legal,cnpj,email,telefone,criado_por)
      VALUES(btrim(dados->>'nome'),nullif(dados->>'nome_legal',''),nullif(dados->>'cnpj',''),nullif(dados->>'email',''),nullif(dados->>'telefone',''),autor)
      RETURNING id INTO resultado;
  ELSE
    UPDATE reabilitah.instituicao SET nome=btrim(dados->>'nome'),nome_legal=nullif(dados->>'nome_legal',''),
      cnpj=nullif(dados->>'cnpj',''),email=nullif(dados->>'email',''),telefone=nullif(dados->>'telefone',''),
      versao=versao+1,atualizado_em=clock_timestamp()
      WHERE id=alvo AND versao=versao_esperada AND ativa RETURNING id INTO resultado;
    IF resultado IS NULL THEN RAISE EXCEPTION 'CADASTRO_ALTERADO'; END IF;
  END IF;
  RETURN resultado;
END $$;

CREATE FUNCTION reabilitah_gestao.validar_membro(dados jsonb) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF jsonb_typeof(dados) IS DISTINCT FROM 'object' OR length(btrim(coalesce(dados->>'nome',''))) NOT BETWEEN 2 AND 160
    OR length(coalesce(dados->>'email','')) NOT BETWEEN 3 AND 254 OR coalesce(dados->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    OR length(btrim(coalesce(dados->>'cargo',''))) NOT BETWEEN 2 AND 80
    OR coalesce(dados->>'perfil','') NOT IN ('ADMINISTRADOR','COLABORADOR')
    OR length(coalesce(dados->>'telefone',''))>30 OR length(coalesce(dados->>'registro_profissional',''))>80 THEN
    RAISE EXCEPTION 'DADOS_INVALIDOS';
  END IF;
END $$;

CREATE FUNCTION reabilitah_gestao.gravar_permissoes(inst uuid, vinculo uuid, codigos text[], autor uuid) RETURNS void
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  IF codigos IS NULL OR cardinality(codigos)>30 OR EXISTS (
    SELECT FROM unnest(codigos) c WHERE c IS NULL OR NOT EXISTS (SELECT FROM reabilitah.permissao p WHERE p.codigo=c)
  ) THEN RAISE EXCEPTION 'PERMISSAO_INVALIDA'; END IF;
  UPDATE reabilitah.permissao_vinculo pv SET ativa=false,concedida_por=autor,concedida_em=clock_timestamp()
    WHERE pv.vinculo_id=vinculo AND pv.ativa AND NOT EXISTS (
      SELECT FROM reabilitah.permissao p WHERE p.id=pv.permissao_id AND p.codigo=ANY(codigos)
    );
  INSERT INTO reabilitah.permissao_vinculo(instituicao_id,vinculo_id,permissao_id,concedida_por)
    SELECT inst,vinculo,p.id,autor FROM reabilitah.permissao p WHERE p.codigo=ANY(codigos)
    ON CONFLICT (instituicao_id,vinculo_id,permissao_id) DO UPDATE
      SET ativa=true,concedida_por=autor,concedida_em=clock_timestamp() WHERE NOT reabilitah.permissao_vinculo.ativa;
END $$;

CREATE FUNCTION reabilitah_gestao.criar_membro(inst uuid, dados jsonb, codigos text[], novo_hash text, conta_existente boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid; s record; u record; novo_vinculo uuid; email_normalizado text;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  autor := reabilitah_gestao.autor_gestor(inst);
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  PERFORM reabilitah_gestao.validar_membro(dados);
  IF dados->>'perfil'='ADMINISTRADOR' AND NOT s.super_administrador THEN RAISE EXCEPTION 'PROMOCAO_RESTRITA'; END IF;
  IF conta_existente IS NULL THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  IF conta_existente AND NOT s.super_administrador THEN RAISE EXCEPTION 'VINCULO_RESTRITO'; END IF;
  email_normalizado := lower(btrim(dados->>'email'));
  SELECT * INTO u FROM reabilitah.usuario WHERE lower(btrim(email))=email_normalizado FOR UPDATE;
  IF conta_existente AND (u.id IS NULL OR NOT u.ativo OR u.super_administrador) THEN RAISE EXCEPTION 'CONTA_INDISPONIVEL'; END IF;
  IF NOT conta_existente AND u.id IS NOT NULL THEN
    IF EXISTS (SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=u.id AND instituicao_id=inst) THEN
      RAISE EXCEPTION 'VINCULO_EXISTENTE';
    END IF;
    IF NOT s.super_administrador THEN
      IF EXISTS (SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=u.id AND instituicao_id<>inst) THEN
        RAISE EXCEPTION 'CONTA_OUTRA_INSTITUICAO';
      END IF;
      RAISE EXCEPTION 'CONTA_EXISTENTE_SUPER';
    END IF;
    RAISE EXCEPTION 'EMAIL_CADASTRADO';
  END IF;
  PERFORM set_config('reabilitah.autor_id',autor::text,true);
  IF NOT conta_existente THEN
    IF novo_hash IS NULL OR novo_hash !~ '^scrypt\$131072\$8\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$' THEN RAISE EXCEPTION 'SENHA_INVALIDA'; END IF;
    INSERT INTO reabilitah.usuario(email,senha_hash) VALUES(email_normalizado,novo_hash) RETURNING * INTO u;
  END IF;
  IF EXISTS (SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=u.id AND instituicao_id=inst) THEN RAISE EXCEPTION 'VINCULO_EXISTENTE'; END IF;
  INSERT INTO reabilitah.vinculo_institucional(instituicao_id,usuario_id,perfil,nome,cargo_id,telefone,registro_profissional,criado_por)
    VALUES(inst,u.id,dados->>'perfil',btrim(dados->>'nome'),reabilitah_gestao.resolver_cargo(inst,dados->>'cargo'),nullif(dados->>'telefone',''),nullif(dados->>'registro_profissional',''),autor)
    RETURNING id INTO novo_vinculo;
  PERFORM reabilitah_gestao.gravar_permissoes(inst,novo_vinculo,CASE WHEN dados->>'perfil'='ADMINISTRADOR' THEN ARRAY[]::text[] ELSE codigos END,autor);
  RETURN novo_vinculo;
END $$;

CREATE FUNCTION reabilitah_gestao.salvar_membro(inst uuid, alvo uuid, dados jsonb, codigos text[], versao_esperada integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid; s record; v record; u record; email_normalizado text;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  autor := reabilitah_gestao.autor_gestor(inst);
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  PERFORM reabilitah_gestao.validar_membro(dados);
  SELECT * INTO v FROM reabilitah.vinculo_institucional WHERE id=alvo AND instituicao_id=inst;
  IF v.id IS NULL THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO u FROM reabilitah.usuario WHERE id=v.usuario_id FOR UPDATE;
  IF u.super_administrador OR NOT u.ativo THEN RAISE EXCEPTION 'CONTA_INDISPONIVEL'; END IF;
  IF versao_esperada IS NULL OR v.versao<>versao_esperada THEN RAISE EXCEPTION 'CADASTRO_ALTERADO'; END IF;
  IF dados->>'perfil'='ADMINISTRADOR' AND v.perfil<>'ADMINISTRADOR' AND NOT s.super_administrador THEN RAISE EXCEPTION 'PROMOCAO_RESTRITA'; END IF;
  IF dados->>'perfil'<>v.perfil AND v.usuario_id=autor THEN RAISE EXCEPTION 'PROPRIO_ACESSO'; END IF;
  IF v.ativo AND v.perfil='ADMINISTRADOR' AND dados->>'perfil'<>'ADMINISTRADOR' AND NOT EXISTS (
    SELECT FROM reabilitah.vinculo_institucional WHERE instituicao_id=inst AND ativo AND perfil='ADMINISTRADOR' AND id<>alvo
  ) THEN RAISE EXCEPTION 'ULTIMO_ADMINISTRADOR'; END IF;
  email_normalizado := lower(btrim(dados->>'email'));
  PERFORM set_config('reabilitah.autor_id',autor::text,true);
  IF email_normalizado<>lower(btrim(u.email)) THEN
    IF NOT s.super_administrador AND EXISTS (
      SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=u.id AND ativo AND instituicao_id<>inst
    ) THEN RAISE EXCEPTION 'EMAIL_MULTIPLAS_INSTITUICOES'; END IF;
    IF EXISTS (SELECT FROM reabilitah.usuario WHERE lower(btrim(email))=email_normalizado AND id<>u.id) THEN RAISE EXCEPTION 'EMAIL_CADASTRADO'; END IF;
    UPDATE reabilitah.usuario SET email=email_normalizado,atualizado_em=clock_timestamp() WHERE id=u.id;
    INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao,antes,depois)
      VALUES(inst,autor,'usuario',u.id::text,'ALTERAR_EMAIL',jsonb_build_object('email',u.email),jsonb_build_object('email',email_normalizado));
  END IF;
  UPDATE reabilitah.vinculo_institucional SET cargo_id=reabilitah_gestao.resolver_cargo(inst,dados->>'cargo'),nome=btrim(dados->>'nome'),perfil=dados->>'perfil',telefone=nullif(dados->>'telefone',''),
    registro_profissional=nullif(dados->>'registro_profissional',''),atualizado_em=clock_timestamp(),versao=versao+1 WHERE id=alvo;
  PERFORM reabilitah_gestao.gravar_permissoes(inst,alvo,CASE WHEN dados->>'perfil'='ADMINISTRADOR' THEN ARRAY[]::text[] ELSE codigos END,autor);
END $$;

CREATE FUNCTION reabilitah_gestao.alterar_acesso(inst uuid, alvo uuid, ativar boolean, motivo text, versao_esperada integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE autor uuid; v record; s record;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  autor := reabilitah_gestao.autor_gestor(inst);
  SELECT * INTO s FROM reabilitah_auth.sessao_atual();
  SELECT * INTO v FROM reabilitah.vinculo_institucional WHERE id=alvo AND instituicao_id=inst;
  IF v.id IS NULL OR ativar IS NULL THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  PERFORM 1 FROM reabilitah.usuario WHERE id=v.usuario_id AND ativo AND NOT super_administrador FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'CONTA_INDISPONIVEL'; END IF;
  IF versao_esperada IS NULL OR v.versao<>versao_esperada OR v.ativo=ativar THEN RAISE EXCEPTION 'CADASTRO_ALTERADO'; END IF;
  IF v.usuario_id=autor THEN RAISE EXCEPTION 'PROPRIO_ACESSO'; END IF;
  IF length(btrim(coalesce(motivo,''))) NOT BETWEEN 10 AND 1000 THEN RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA'; END IF;
  IF ativar AND v.perfil='ADMINISTRADOR' AND NOT s.super_administrador THEN RAISE EXCEPTION 'PROMOCAO_RESTRITA'; END IF;
  IF NOT ativar AND v.perfil='ADMINISTRADOR' AND NOT EXISTS (
    SELECT FROM reabilitah.vinculo_institucional WHERE instituicao_id=inst AND ativo AND perfil='ADMINISTRADOR' AND id<>alvo
  ) THEN RAISE EXCEPTION 'ULTIMO_ADMINISTRADOR'; END IF;
  PERFORM set_config('reabilitah.autor_id',autor::text,true);
  UPDATE reabilitah.vinculo_institucional SET ativo=ativar,desativado_em=CASE WHEN ativar THEN NULL ELSE clock_timestamp() END,
    atualizado_em=clock_timestamp(),versao=versao+1 WHERE id=alvo;
  IF NOT ativar THEN
    UPDATE reabilitah.sessao_usuario SET instituicao_selecionada_id=NULL WHERE usuario_id=v.usuario_id AND instituicao_selecionada_id=inst AND revogada_em IS NULL;
  END IF;
  INSERT INTO reabilitah.auditoria(instituicao_id,autor_id,entidade,registro_id,acao,justificativa)
    VALUES(inst,autor,'vinculo_institucional',alvo::text,CASE WHEN ativar THEN 'REATIVAR_ACESSO' ELSE 'DESATIVAR_ACESSO' END,btrim(motivo));
END $$;

CREATE FUNCTION reabilitah_gestao.redefinir_senha_membro(inst uuid, vinculo uuid, novo_hash text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
DECLARE alvo uuid;
BEGIN
  PERFORM reabilitah_gestao.bloquear_alteracao();
  PERFORM reabilitah_gestao.autor_gestor(inst);
  SELECT usuario_id INTO alvo FROM reabilitah.vinculo_institucional WHERE id=vinculo AND instituicao_id=inst AND ativo;
  IF alvo IS NULL THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  PERFORM reabilitah_auth.redefinir_senha(alvo,novo_hash);
END $$;

CREATE FUNCTION reabilitah_gestao.listar_equipe(inst uuid)
RETURNS TABLE(id uuid,usuario_id uuid,nome text,email text,perfil text,telefone text,registro_profissional text,ativo boolean,versao integer,multiplas_instituicoes boolean,permissoes text[])
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM reabilitah_gestao.autor_gestor(inst);
  RETURN QUERY SELECT v.id,v.usuario_id,v.nome,u.email,v.perfil,v.telefone,v.registro_profissional,v.ativo,v.versao,
    EXISTS (SELECT FROM reabilitah.vinculo_institucional outro WHERE outro.usuario_id=v.usuario_id AND outro.ativo AND outro.instituicao_id<>inst),
    ARRAY(SELECT p.codigo FROM reabilitah.permissao_vinculo pv JOIN reabilitah.permissao p ON p.id=pv.permissao_id WHERE pv.vinculo_id=v.id AND pv.ativa ORDER BY p.codigo)
    FROM reabilitah.vinculo_institucional v JOIN reabilitah.usuario u ON u.id=v.usuario_id
    WHERE v.instituicao_id=inst ORDER BY v.ativo DESC,v.nome,v.id;
END $$;

CREATE FUNCTION reabilitah_gestao.historico(inst uuid, pessoa uuid DEFAULT NULL, pagina integer DEFAULT 1)
RETURNS TABLE(id text,ocorrido_em timestamptz,autor text,acao text,entidade text,descricao text,justificativa text,antes jsonb,depois jsonb)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
  SELECT * FROM reabilitah_gestao.historico(inst,pessoa,pagina,'todos')
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA reabilitah_gestao FROM PUBLIC;
GRANT USAGE ON SCHEMA reabilitah_gestao TO reabilitah_runtime;
GRANT EXECUTE ON FUNCTION reabilitah_gestao.pode_executar(uuid,text),
  reabilitah_gestao.salvar_instituicao(uuid,jsonb,integer),
  reabilitah_gestao.criar_membro(uuid,jsonb,text[],text,boolean),
  reabilitah_gestao.salvar_membro(uuid,uuid,jsonb,text[],integer),
  reabilitah_gestao.alterar_acesso(uuid,uuid,boolean,text,integer),
  reabilitah_gestao.redefinir_senha_membro(uuid,uuid,text),
  reabilitah_gestao.listar_equipe(uuid),reabilitah_gestao.historico(uuid,uuid,integer) TO reabilitah_runtime;

-- O cargo descreve a função profissional; o perfil continua definindo o acesso.
CREATE FUNCTION reabilitah_gestao.resolver_cargo(inst uuid, nome_cargo text) RETURNS uuid
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE nome_normalizado text; existente record; resultado uuid;
BEGIN
  nome_normalizado := regexp_replace(btrim(coalesce(nome_cargo,'')),'[[:space:]]+',' ','g');
  IF length(nome_normalizado) NOT BETWEEN 2 AND 80 THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  SELECT id,ativo INTO existente FROM reabilitah.cargo
    WHERE instituicao_id=inst AND lower(btrim(nome))=lower(nome_normalizado) ORDER BY id LIMIT 1;
  IF FOUND THEN
    IF NOT existente.ativo THEN RAISE EXCEPTION 'CARGO_INDISPONIVEL'; END IF;
    RETURN existente.id;
  END IF;
  INSERT INTO reabilitah.cargo(instituicao_id,nome) VALUES(inst,nome_normalizado) RETURNING id INTO resultado;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION reabilitah_gestao.resolver_cargo(uuid,text) FROM PUBLIC,reabilitah_runtime;

CREATE POLICY proprio_vinculo ON reabilitah.vinculo_institucional FOR SELECT TO reabilitah_runtime USING (
  reabilitah_auth.pode_ler(instituicao_id) AND usuario_id=(SELECT usuario_id FROM reabilitah_auth.sessao_atual())
);

-- Eventos globais continuam preservados, mas não são atribuídos a instituições por suposição.
CREATE FUNCTION reabilitah_gestao.historico(inst uuid, pessoa uuid, pagina integer, filtro text)
RETURNS TABLE(id text,ocorrido_em timestamptz,autor text,acao text,entidade text,descricao text,justificativa text,antes jsonb,depois jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM reabilitah_gestao.autor_gestor(inst);
  IF filtro IS NULL OR filtro NOT IN ('todos','acessos','sem-acessos','criacao-documentos','documentos') THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  IF pagina IS NULL OR pagina NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  IF pessoa IS NOT NULL AND NOT EXISTS (SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=pessoa AND instituicao_id=inst) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  RETURN QUERY WITH eventos AS (
    SELECT 'a-'||a.id AS chave,a.ocorrido_em,a.autor_id,a.acao,a.entidade,
      CASE WHEN permissao.id IS NOT NULL THEN coalesce(v.nome,'')||' · '||permissao.nome
        ELSE coalesce(a.depois->>'nome',a.antes->>'nome',v.nome,alvo.email,'') END AS descricao,a.justificativa,
      CASE WHEN a.entidade='vinculo_institucional' AND a.antes IS NOT NULL THEN a.antes||jsonb_build_object('cargo',cargo_anterior.nome) ELSE a.antes END AS antes,
      CASE WHEN a.entidade='vinculo_institucional' AND a.depois IS NOT NULL THEN a.depois||jsonb_build_object('cargo',cargo_atual.nome) ELSE a.depois END AS depois
    FROM reabilitah.auditoria a
    LEFT JOIN reabilitah.vinculo_institucional v ON v.id::text=a.registro_id AND v.instituicao_id=inst
    LEFT JOIN reabilitah.usuario alvo ON alvo.id::text=a.registro_id AND a.entidade='usuario'
    LEFT JOIN reabilitah.permissao permissao ON permissao.id::text=coalesce(a.depois->>'permissao_id',a.antes->>'permissao_id') AND a.entidade='permissao_vinculo'
    LEFT JOIN reabilitah.cargo cargo_anterior ON cargo_anterior.id::text=a.antes->>'cargo_id' AND cargo_anterior.instituicao_id=inst
    LEFT JOIN reabilitah.cargo cargo_atual ON cargo_atual.id::text=a.depois->>'cargo_id' AND cargo_atual.instituicao_id=inst
    WHERE a.instituicao_id=inst AND (pessoa IS NULL OR a.autor_id=pessoa OR v.usuario_id=pessoa OR (a.entidade='usuario' AND a.registro_id=pessoa::text)
      OR a.depois->>'usuario_id'=pessoa::text OR a.antes->>'usuario_id'=pessoa::text)
    UNION ALL
    SELECT 'd-'||e.id,e.ocorrido_em,e.autor_id,e.acao,'documento',
      'Documento #'||d.codigo||' · '||p.nome_completo,e.justificativa,NULL::jsonb,NULL::jsonb
    FROM reabilitah.documento_evento e JOIN reabilitah.documento d ON d.id=e.documento_id
    JOIN reabilitah.paciente p ON p.id=d.paciente_id
    WHERE e.instituicao_id=inst AND (pessoa IS NULL OR e.autor_id=pessoa)
  ) SELECT e.chave,e.ocorrido_em,coalesce(v.nome,u.email,'Sistema'),e.acao,e.entidade,e.descricao,e.justificativa,e.antes,e.depois
    FROM eventos e LEFT JOIN reabilitah.usuario u ON u.id=e.autor_id
    LEFT JOIN reabilitah.vinculo_institucional v ON v.usuario_id=e.autor_id AND v.instituicao_id=inst
    WHERE CASE filtro
      WHEN 'todos' THEN true
      WHEN 'acessos' THEN e.acao IN ('LOGIN','LOGOUT','SELECIONAR_INSTITUICAO')
      WHEN 'sem-acessos' THEN e.acao NOT IN ('LOGIN','LOGOUT','SELECIONAR_INSTITUICAO')
      WHEN 'criacao-documentos' THEN e.entidade='documento' AND e.acao='EMISSAO'
      WHEN 'documentos' THEN e.entidade='documento'
      ELSE false END
    ORDER BY e.ocorrido_em DESC,e.chave DESC LIMIT 51 OFFSET ((pagina-1)*50);
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA reabilitah_gestao FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reabilitah_gestao.historico(uuid,uuid,integer,text) TO reabilitah_runtime;

-- O catálogo alimenta as opções da tela e a classificação dos registros.
CREATE FUNCTION reabilitah_gestao.tipos_atividade()
RETURNS TABLE(codigo text,nome text,grupo text,entidades text[],acoes text[],ordem integer)
LANGUAGE sql IMMUTABLE SET search_path=pg_catalog,pg_temp AS $$
  VALUES
    ('acessos','Acessos e saídas','Acesso ao sistema',NULL::text[],ARRAY['LOGIN','LOGOUT','SELECIONAR_INSTITUICAO'],10),
    ('credenciais','Senhas e e-mail de acesso','Acesso ao sistema',ARRAY['usuario'],ARRAY['REDEFINIR_SENHA','TROCAR_SENHA','ALTERAR_EMAIL'],20),
    ('criacao-documentos','Criação de documentos','Prontuários',ARRAY['documento'],ARRAY['EMISSAO'],30),
    ('desconsideracao-documentos','Documentos desconsiderados','Prontuários',ARRAY['documento'],ARRAY['DESCONSIDERACAO'],40),
    ('arquivos-documentos','Arquivos e digitalizações','Prontuários',ARRAY['documento'],ARRAY['ORIGINAL_ARMAZENADO','DIGITALIZACAO_ARMAZENADO'],50),
    ('assinaturas','Conferência de assinaturas','Prontuários',ARRAY['documento'],ARRAY['CONFERENCIA_APROVADA','CONFERENCIA_REJEITADA'],60),
    ('pacientes','Pacientes e acolhimentos','Prontuários',ARRAY['paciente','responsavel','paciente_dependencia','acolhimento'],NULL::text[],70),
    ('cadastros-equipe','Cadastros da equipe e cargos','Gestão',ARRAY['vinculo_institucional','cargo'],ARRAY['INSERT','UPDATE'],80),
    ('permissoes-equipe','Permissões da equipe','Gestão',ARRAY['permissao_vinculo'],NULL::text[],90),
    ('acesso-equipe','Ativação e desativação de acessos','Gestão',ARRAY['vinculo_institucional'],ARRAY['REATIVAR_ACESSO','DESATIVAR_ACESSO'],100),
    ('instituicao','Dados da instituição','Gestão',ARRAY['instituicao','configuracao_institucional'],NULL::text[],110),
    ('avisos','Avisos','Gestão',ARRAY['aviso'],NULL::text[],120),
    ('outras','Outras atividades','Outras',ARRAY[]::text[],ARRAY[]::text[],130)
$$;

CREATE FUNCTION reabilitah_gestao.historico_selecionado(inst uuid, pessoa uuid, pagina integer, tipos text[])
RETURNS TABLE(id text,ocorrido_em timestamptz,autor text,acao text,entidade text,descricao text,justificativa text,antes jsonb,depois jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $$
BEGIN
  PERFORM reabilitah_gestao.autor_gestor(inst);
  IF tipos IS NOT NULL AND (cardinality(tipos)>100 OR EXISTS (
    SELECT FROM unnest(tipos) escolhido WHERE escolhido IS NULL OR NOT EXISTS (
      SELECT FROM reabilitah_gestao.tipos_atividade() t WHERE t.codigo=escolhido
    )
  )) THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  IF pagina IS NULL OR pagina NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'DADOS_INVALIDOS'; END IF;
  IF pessoa IS NOT NULL AND NOT EXISTS (SELECT FROM reabilitah.vinculo_institucional WHERE usuario_id=pessoa AND instituicao_id=inst) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  RETURN QUERY WITH eventos AS (
    SELECT 'a-'||a.id AS chave,a.ocorrido_em,a.autor_id,a.acao,a.entidade,
      CASE WHEN permissao.id IS NOT NULL THEN coalesce(v.nome,'')||' · '||permissao.nome
        ELSE coalesce(a.depois->>'nome',a.antes->>'nome',v.nome,alvo.email,'') END AS descricao,a.justificativa,
      CASE WHEN a.entidade='vinculo_institucional' AND a.antes IS NOT NULL THEN a.antes||jsonb_build_object('cargo',cargo_anterior.nome) ELSE a.antes END AS antes,
      CASE WHEN a.entidade='vinculo_institucional' AND a.depois IS NOT NULL THEN a.depois||jsonb_build_object('cargo',cargo_atual.nome) ELSE a.depois END AS depois
    FROM reabilitah.auditoria a
    LEFT JOIN reabilitah.vinculo_institucional v ON v.id::text=a.registro_id AND v.instituicao_id=inst
    LEFT JOIN reabilitah.usuario alvo ON alvo.id::text=a.registro_id AND a.entidade='usuario'
    LEFT JOIN reabilitah.permissao permissao ON permissao.id::text=coalesce(a.depois->>'permissao_id',a.antes->>'permissao_id') AND a.entidade='permissao_vinculo'
    LEFT JOIN reabilitah.cargo cargo_anterior ON cargo_anterior.id::text=a.antes->>'cargo_id' AND cargo_anterior.instituicao_id=inst
    LEFT JOIN reabilitah.cargo cargo_atual ON cargo_atual.id::text=a.depois->>'cargo_id' AND cargo_atual.instituicao_id=inst
    WHERE a.instituicao_id=inst AND (pessoa IS NULL OR a.autor_id=pessoa OR v.usuario_id=pessoa OR (a.entidade='usuario' AND a.registro_id=pessoa::text)
      OR a.depois->>'usuario_id'=pessoa::text OR a.antes->>'usuario_id'=pessoa::text)
    UNION ALL
    SELECT 'd-'||e.id,e.ocorrido_em,e.autor_id,e.acao,'documento',
      'Documento #'||d.codigo||' · '||p.nome_completo,e.justificativa,NULL::jsonb,NULL::jsonb
    FROM reabilitah.documento_evento e JOIN reabilitah.documento d ON d.id=e.documento_id
    JOIN reabilitah.paciente p ON p.id=d.paciente_id
    WHERE e.instituicao_id=inst AND (pessoa IS NULL OR e.autor_id=pessoa)
  ) SELECT e.chave,e.ocorrido_em,coalesce(v.nome,u.email,'Sistema'),e.acao,e.entidade,e.descricao,e.justificativa,e.antes,e.depois
    FROM eventos e LEFT JOIN reabilitah.usuario u ON u.id=e.autor_id
    LEFT JOIN reabilitah.vinculo_institucional v ON v.usuario_id=e.autor_id AND v.instituicao_id=inst
    WHERE tipos IS NULL OR coalesce((
      SELECT t.codigo FROM reabilitah_gestao.tipos_atividade() t
      WHERE t.codigo<>'outras' AND (t.entidades IS NULL OR e.entidade=ANY(t.entidades))
        AND (t.acoes IS NULL OR e.acao=ANY(t.acoes))
      ORDER BY t.ordem LIMIT 1
    ),'outras')=ANY(tipos)
    ORDER BY e.ocorrido_em DESC,e.chave DESC LIMIT 51 OFFSET ((pagina-1)*50);
END $$;

REVOKE ALL ON FUNCTION reabilitah_gestao.tipos_atividade() FROM PUBLIC;
REVOKE ALL ON FUNCTION reabilitah_gestao.historico_selecionado(uuid,uuid,integer,text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reabilitah_gestao.tipos_atividade(),reabilitah_gestao.historico_selecionado(uuid,uuid,integer,text[]) TO reabilitah_runtime;
COMMIT;
