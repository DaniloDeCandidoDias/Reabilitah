-- Somente na instancia temporaria de teste. Tudo e revertido ao final.
BEGIN;
SET LOCAL search_path = reabilitah, pg_catalog;
CREATE FUNCTION pg_temp.exigir_erro(comando text, trecho text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE falhou boolean := false;
BEGIN
  BEGIN EXECUTE comando;
  EXCEPTION WHEN OTHERS THEN
    IF position(trecho IN SQLERRM)=0 THEN RAISE; END IF;
    falhou := true;
  END;
  IF NOT falhou THEN RAISE EXCEPTION 'Operacao deveria falhar: %',comando; END IF;
END $$;
DO $$
DECLARE u uuid; outro uuid; i uuid; j uuid; p uuid; a uuid; m uuid; d uuid; f uuid; g uuid; t uuid;
BEGIN
  INSERT INTO usuario(email,senha_hash) VALUES('admin@teste.invalid',repeat('x',60)) RETURNING id INTO u;
  INSERT INTO usuario(email,senha_hash) VALUES('colaborador@teste.invalid',repeat('x',60)) RETURNING id INTO outro;
  PERFORM set_config('reabilitah.autor_id',u::text,true);
  INSERT INTO instituicao(nome,criado_por) VALUES('Instituicao de teste A',u) RETURNING id INTO i;
  INSERT INTO instituicao(nome,criado_por) VALUES('Instituicao de teste B',u) RETURNING id INTO j;
  INSERT INTO vinculo_institucional(instituicao_id,usuario_id,perfil,nome,criado_por)
    VALUES(i,u,'ADMINISTRADOR','Administrador de teste',u);
  INSERT INTO paciente(instituicao_id,nome_completo,criado_por) VALUES(i,'Paciente de teste',u) RETURNING id INTO p;
  INSERT INTO acolhimento(instituicao_id,paciente_id,data_entrada,criado_por)
    VALUES(i,p,'2026-10-01',u) RETURNING id INTO a;
  PERFORM pg_temp.exigir_erro(format('INSERT INTO acolhimento(instituicao_id,paciente_id,data_entrada,criado_por) VALUES(%L,%L,%L,%L)',j,p,'2026-10-01',u),'foreign key');
  PERFORM pg_temp.exigir_erro(format('INSERT INTO acolhimento(instituicao_id,paciente_id,data_entrada,criado_por) VALUES(%L,%L,%L,%L)',i,p,'2026-10-02',u),'unique');
  SELECT id INTO t FROM tipo_documento WHERE codigo='declaracao-desligamento';
  INSERT INTO modelo_documento(tipo_documento_id,versao,campos,assinantes,identificador_layout,publicado_por)
    VALUES(t,1,'{}','["Acolhido/testemunha","Representante"]','teste-a4',u) RETURNING id INTO m;
  INSERT INTO documento(instituicao_id,paciente_id,acolhimento_id,modelo_documento_id,dados,dados_paciente,dados_instituicao,dados_autor,assinantes,criado_por,data_desligamento,motivo_desligamento)
    VALUES(i,p,a,m,'{}','{}','{}','{}','["Acolhido/testemunha","Representante"]',u,'2026-10-05','Alta terapeutica') RETURNING id INTO d;
  PERFORM pg_temp.exigir_erro(format('UPDATE documento SET dados=%L WHERE id=%L','{"alterado":true}',d),'imutavel');
  PERFORM pg_temp.exigir_erro(format('DELETE FROM documento WHERE id=%L',d),'nao permite');
  INSERT INTO documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por)
    VALUES(i,d,'ORIGINAL','teste/original.pdf','application/pdf',100,repeat('a',64),u);
  INSERT INTO documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por)
    VALUES(i,d,'DIGITALIZACAO','teste/envio1.pdf','application/pdf',100,repeat('b',64),u) RETURNING id INTO f;
  IF EXISTS(SELECT 1 FROM acolhimento WHERE id=a AND encerrado_em IS NOT NULL) THEN RAISE EXCEPTION 'Envio encerrou acolhimento sem conferencia'; END IF;
  PERFORM pg_temp.exigir_erro(format('INSERT INTO documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por) VALUES(%L,%L,%L,%L,%L,100,%L,%L)',i,d,'DIGITALIZACAO','teste/pendente.pdf','application/pdf',repeat('c',64),u),'aguardando conferencia');
  PERFORM pg_temp.exigir_erro(format('INSERT INTO conferencia_assinatura(instituicao_id,documento_id,arquivo_id,decisao,conferido_por) VALUES(%L,%L,%L,%L,%L)',i,d,f,'APROVADA',outro),'administrador ativo');
  PERFORM pg_temp.exigir_erro(format('INSERT INTO conferencia_assinatura(instituicao_id,documento_id,arquivo_id,decisao,conferido_por) VALUES(%L,%L,%L,%L,%L)',i,d,f,'REJEITADA',u),'check constraint');
  INSERT INTO conferencia_assinatura(instituicao_id,documento_id,arquivo_id,decisao,justificativa,conferido_por)
    VALUES(i,d,f,'REJEITADA','Assinatura ilegivel',u);
  INSERT INTO documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por)
    VALUES(i,d,'DIGITALIZACAO','teste/envio2.pdf','application/pdf',100,repeat('d',64),u) RETURNING id INTO g;
  INSERT INTO conferencia_assinatura(instituicao_id,documento_id,arquivo_id,decisao,conferido_por)
    VALUES(i,d,g,'APROVADA',u);
  IF NOT EXISTS(SELECT 1 FROM acolhimento WHERE id=a AND documento_desligamento_id=d AND data_saida='2026-10-05' AND encerrado_por=u) THEN
    RAISE EXCEPTION 'Conferencia nao encerrou o acolhimento';
  END IF;
  IF (SELECT count(*) FROM documento_arquivo WHERE documento_id=d)<>3 THEN RAISE EXCEPTION 'Arquivo anterior perdido'; END IF;
  IF (SELECT count(*) FROM conferencia_assinatura WHERE documento_id=d)<>2 THEN RAISE EXCEPTION 'Conferencia anterior perdida'; END IF;
  PERFORM pg_temp.exigir_erro(format('INSERT INTO documento_arquivo(instituicao_id,documento_id,tipo,chave_armazenamento,mime_type,tamanho_bytes,hash_arquivo,enviado_por) VALUES(%L,%L,%L,%L,%L,100,%L,%L)',i,d,'DIGITALIZACAO','teste/apos-aprovacao.pdf','application/pdf',repeat('e',64),u),'ja aprovado');
  PERFORM pg_temp.exigir_erro(format('UPDATE conferencia_assinatura SET decisao=%L WHERE arquivo_id=%L','REJEITADA',g),'nao permite');
  UPDATE documento SET desconsiderado_em=now(),desconsiderado_por=u,justificativa_desconsideracao='Teste de preservacao' WHERE id=d;
  PERFORM pg_temp.exigir_erro(format('UPDATE documento SET desconsiderado_em=NULL WHERE id=%L',d),'nao pode ser reativado');
  INSERT INTO acolhimento(instituicao_id,paciente_id,data_entrada,criado_por) VALUES(i,p,'2026-10-06',u);
  IF (SELECT count(*) FROM acolhimento WHERE paciente_id=p)<>2 THEN RAISE EXCEPTION 'Readmissao perdeu periodo anterior'; END IF;
  IF EXISTS(SELECT 1 FROM auditoria WHERE depois ? 'senha_hash' OR depois ? 'token_hash') THEN RAISE EXCEPTION 'Credencial exposta no historico'; END IF;
  RAISE NOTICE 'PASS: isolamento por FK, acolhimento unico, imutabilidade, rejeicao, reenvio, aprovacao, desligamento e readmissao.';
END $$;
CREATE ROLE reabilitah_teste_leitura NOLOGIN;
GRANT USAGE ON SCHEMA reabilitah TO reabilitah_teste_leitura;
GRANT SELECT ON reabilitah.paciente TO reabilitah_teste_leitura;
SET LOCAL ROLE reabilitah_teste_leitura;
DO $$ BEGIN
  IF (SELECT count(*) FROM reabilitah.paciente)<>0 THEN RAISE EXCEPTION 'RLS deveria negar acesso sem politica'; END IF;
  RAISE NOTICE 'PASS: RLS nega acesso por padrao a papel sem privilegios.';
END $$;
RESET ROLE;
ROLLBACK;
