# Primeira entrega — 12/11/2026, às 19h (São Paulo)

> Checklist histórico da primeira entrega. O prazo agora é **entrega final hoje às 19h**. O snapshot já foi localizado/verificado e o MVP ganhou busca ativa: consultar [o relatório atual](MVP-12-11-2026.md) para artefatos, ordem 006-r2 → 012 → 011 e pendências de homologação.

Projeto confirmado pelo responsável como **exclusivamente de desenvolvimento, com dados fictícios**: `https://nfwfogaklwbrabozqjan.supabase.co`.

Escopo: cadastro → cronograma → aplicação → acompanhamento → identificação de atrasos. Interface preservada. Nenhuma funcionalidade secundária acrescentada. **006 não foi executado remotamente.**

## Arquivos finais e ordem de uso

| Arquivo | Finalidade | Execução nesta entrega |
| --- | --- | --- |
| [008](../sql/008_backup_definicoes_grants_somente_leitura.sql) | Exportar definições e permissões atuais em JSON, sem linhas clínicas/credenciais | Preparado; captura real ainda depende do SQL Editor. |
| [Gerador de reversão](../scripts/gerar-rollback-sql.mjs) | Converter o snapshot anterior à mudança em SQL de rollback revisável | Testado com snapshot do banco local descartável. |
| [009](../sql/009_acl_dependencias_somente_leitura.sql) | Inspecionar grants efetivos, colunas, herança e dependências | Validado localmente; conferir no Supabase. |
| [006-r2](../sql/006_proposta_correcao_rpcs_fase2.sql) | Corrigir as três RPCs e restringir permissões diretas | Revisado e testado localmente; aplicação remota manual somente após aprovação. |
| [005](../sql/005_inspecao_fase2_somente_leitura.sql) | Conferir corpos/grants/políticas depois da aplicação manual | Somente leitura. |
| [010](../sql/010_ensaio_transacional_homologacao.sql) | Ensaiar SQL/RLS com dados sintéticos e ROLLBACK final | Validado localmente; não aplica a migração. |

**Não executar 004.** Não executar a fixture `tests/fixtures/sql-review.sql` no Supabase: ela serve exclusivamente ao banco local descartável.

## Checklist de pré-execução

- [ ] Conferir o projeto de desenvolvimento acima no SQL Editor; nenhuma migração será aplicada pelo agente.
- [ ] Salvar a revisão atual de 006 e ler seus REVOKE. Admin mantém acesso central entre unidades; UBS fica restrita à unidade vinculada, conforme as políticas fornecidas.
- [ ] Executar **008, somente leitura**, e exportar o resultado completo para `backups/antes-006-r2.json`. Esse snapshot real ainda não foi capturado pelo agente; não substituir por dados de teste ou pela saída antiga do diagnóstico.
- [ ] Gerar o rollback local com o comando abaixo e revisar o arquivo. Se o gerador recusar owners/grantors/cadeias, interromper e preparar reversão manual revisada; não remover as proteções do gerador.
- [ ] Executar **009, somente leitura**. Conferir permissões por coluna, papéis herdados, default ACLs e clientes que escrevam diretamente nas tabelas. Revogações podem afetar importadores, jobs, integração antiga e cancelamento direto. A função legada `va_cadastrar_atendimento` não é alterada; seus consumidores precisam ser identificados.
- [ ] Conferir que triggers de aplicação, índice único parcial, FK composta e constraints continuam correspondendo ao diagnóstico recebido. Não desabilitá-los para fazer o ensaio passar.
- [ ] Preparar manualmente contas DEMO de admin, UBS A, UBS B e paciente. UBSs precisam de unidades distintas; paciente usa `pacientes.user_id` e não recebe papel `ubs`/`admin`. Não criar `role='paciente'`, rejeitado pelo schema atual. Ver detalhes em [Homologação da Fase 2](HOMOLOGACAO-FASE2.md).
- [ ] Preparar vacina/lote DEMO e CPF sintético inédito, sem usuários ou registros reais; não enviar convites ou mensagens externas. Usar apenas chave pública nos clientes e runner.
- [ ] Aprovar explicitamente a aplicação manual de **006-r2**. Executar o arquivo inteiro em uma transação; se falhar, fazer ROLLBACK e analisar a causa, sem executar partes isoladas ou ignorar a checagem de herança.
- [ ] Após aplicação manual, executar 005/009 novamente e comparar com o backup: assinaturas/retornos preservados, `search_path` vazio nas RPCs, execução anônima removida, execução autenticada disponível e escrita direta bloqueada nas quatro tabelas clínicas previstas.

## Backup e reversão

Criar a pasta local `backups` se necessário e salvar ali a exportação JSON de 008. A pasta é ignorada pelo Git. O backup contém código e metadados de permissões, não dados pessoais ou linhas clínicas.

```powershell
node scripts/gerar-rollback-sql.mjs backups/antes-006-r2.json backups/rollback-006-r2.sql
```

O comando só gera um arquivo local novo: não conecta ao Supabase e não executa SQL. Manter o snapshot e o rollback juntos, sem sobrescrever revisões anteriores.

Se a aplicação de 006 falhar antes de COMMIT, a própria transação deve reverter tudo; executar ROLLBACK explícito se a sessão permanecer abortada. Se houver problema depois de COMMIT: interromper o ensaio, registrar o erro sem credenciais e revisar o rollback gerado antes de qualquer execução manual aprovada. Executá-lo como proprietário original, não como service_role. Revalidar definições/grants após a reversão.

O rollback restaura os três corpos anteriores e permissões explícitas dos beneficiários afetados; não desfaz dados criados depois nem restaura objetos fora do escopo. Não usar após mudanças independentes de código/permissões sem nova análise. **Os corpos antigos contêm falhas conhecidas; restaurá-los reintroduz essas falhas.**

## Testes que você deverá realizar no Supabase

Primeiro preencher e executar **010**, mantendo o ROLLBACK final. Esse ensaio verifica SQL/RLS sob `SET LOCAL ROLE authenticated` e claims fictícias; não comprova login/JWT. Depois, com contas DEMO reais, verificar o fluxo da interface:

| Teste | Resultado esperado |
| --- | --- |
| Cadastro com 4 datas | UUID retornado abre a ficha correta. Após recarregar, mesmo paciente e exatamente 4 doses pendentes, sem dose adicional. |
| Cadastro com 5 datas ou intervalos personalizados | Quantidade e datas prescritas preservadas; sem protocolo clínico obrigatório. Sexta data, datas duplicadas/nulas/invertidas devem ser rejeitadas. |
| Consistência cadastral | Nascimento desconhecido é aceito; acidente futuro ou anterior ao nascimento conhecido é rejeitado. Dados retrospectivos finitos são aceitos, sem limite de idade do registro. |
| Aplicação válida | UUID da aplicação, uma linha válida, profissional da sessão, esquema aplicado e auditoria correspondente. Recarregar ficha e painel para verificar persistência. |
| Lote e vacina | Lote vencido **na aplicação**, de outra vacina/unidade ou vacina inativa são rejeitados. Lote vencido hoje mas válido na data retrospectiva é aceito. Não afrouxar NOT NULL para testar NULL remotamente; essa defesa foi exercitada localmente. |
| Duplicidade | Segunda aplicação na mesma dose é rejeitada; uma única aplicação válida e auditoria correspondente. Concorrência real exige duas sessões e ensaio separado; não foi homologada remotamente. |
| UBS A × UBS B | UBS B não lê nem cadastra/edita/aplica em A; repetir chamadas diretas às RPCs, não apenas testar menus. Perfil sem unidade também não pode escrever. |
| Paciente e admin | Paciente lê somente o próprio vínculo/doses e não executa operações profissionais. Admin tem o acesso central previsto. |
| Permissões diretas | INSERT/UPDATE/DELETE diretos nas quatro tabelas clínicas são negados ao papel da aplicação, inclusive UPDATE por coluna. Consultar privilégios de TRUNCATE; não executar TRUNCATE como teste. |
| Atrasos | Usar o cenário sintético abaixo; conferir lista e indicadores antes/depois da aplicação. Erro de consulta deve aparecer como indisponibilidade, sem números inventados. |

### Cenário sintético de atrasos para a apresentação

Criar um paciente DEMO separado, com acidente em **04/11/2026** e cronograma de demonstração em **05/11, 08/11, 12/11 e 19/11/2026**. Isso é fixture de software, não recomendação clínica. Se o ensaio ocorrer em outro dia, adaptar as datas mantendo duas anteriores, uma no dia e uma futura.

Em 12/11/2026, antes das aplicações, devem existir **duas doses em atraso e um paciente com atraso** nesse cenário. A dose prevista para o próprio dia ainda não é atraso. Registrar uma aplicação sintética da primeira dose deve reduzir para **uma dose em atraso**, mantendo o mesmo paciente entre os faltosos. O cronograma original não deve ser reagendado automaticamente. Após aplicar também a segunda dose, esse paciente deve sair dos atrasos, salvo outra pendência atrasada. Esses números são expectativas do cenário, não resultados reais do dashboard.

O frontend já calcula atraso para `status='pendente'` com data anterior ao dia corrente, além do status persistido `atrasada`; não é preciso atualizar status por SQL para fabricar o indicador. Não abrir envio de WhatsApp/SMS durante o ensaio.

## Validação local e pendências

A revisão anterior passou em 15 cenários SQL locais. Esta consolidação acrescentou o cenário de atraso antes/depois da aplicação, sem mudar a interface ou criar funcionalidade nova.

| Verificação desta entrega | Resultado |
| --- | --- |
| `npm run test:sql` | 16 cenários SQL locais aprovados, incluindo atrasos e backup/reversão. |
| `npm test` | 5 testes unitários aprovados; aviso de detecção de módulo TypeScript do Node, sem falha. |
| `npm run lint` | Aprovado, sem avisos. |
| `npm run build` | Aprovado: compilação, TypeScript e geração das 16 páginas. |
| `npm run typecheck` após build | Aprovado. |
| `git diff --check` | Aprovado. |
| Backup atual e testes remotos | Não executados; dependem da exportação pelo SQL Editor e da sequência manual acima. |

Arquivos alterados nesta consolidação: comentário de orientação em 006, teste SQL de atrasos, README, nota na revisão e este checklist. A interface e as implementações das RPCs da revisão 006-r2 foram preservadas.

O banco local usa PostgreSQL 18.6 embarcado, schema reduzido e dados exclusivamente sintéticos. Backup, geração/reversão de código e ACLs, triggers, índice, rollback de auditoria e herança foram exercitados localmente. Isso não substitui o snapshot atual do Supabase, o teste com suas contas, a persistência no navegador nem a concorrência real.
