# Revisão da proposta 006-r2 — 12/11/2026

> Consolidação final para hoje: [checklist da entrega às 19h](ENTREGA-19H.md), com a sequência manual e o teste adicional de atrasos. Total atualizado: 16 cenários SQL locais aprovados; sem execução remota.

## Estado e escopo

Proposta revisada em `sql/006_proposta_correcao_rpcs_fase2.sql`, **não aplicada no Supabase**. O SQL 004 continua sem execução. Nenhuma conta, dado clínico, política ou grant remoto foi alterado; não houve mensagens externas nem uso de service_role. O arquivo `.env.homolog.local` não foi lido nem alterado nesta revisão.

Ponto de restauração local: `C:\Users\PEDROO~1\AppData\Local\Temp\vacinacao-before-006-review-20261112-103549.zip`, contendo fonte/SQL/documentação/testes/package.json anteriores à revisão, sem credenciais. Alterações locais anteriores foram preservadas.

## Regras revisadas

| Tema | Decisão e impacto |
| --- | --- |
| Validade de lote | O diagnóstico enviado informa `validade date NOT NULL`. A proposta preserva essa constraint e rejeita explicitamente NULL, `infinity` e `-infinity`, além de validade anterior à aplicação. Um lote vencido hoje pode ser usado para documentar aplicação histórica feita enquanto estava válido. |
| Acidente | Obrigatório, data finita e não futura no calendário `America/Sao_Paulo`. Não há limite de dias desde a exposição nem idade mínima do registro. Datas antigas são aceitas. |
| Nascimento | Pode ser desconhecido/NULL, respeitando o schema atual. Quando informado, deve ser finito, não futuro e anterior ou igual ao acidente. Não se impõe limite de idade. Cadastro foi ajustado para enviar NULL quando não conhecido, sem redesenhar a interface. Edição já admitia NULL. Não preencher data inventada para satisfazer validação. |
| Retrospectividade | Não se exige que acidente, primeira dose ou aplicação sejam de hoje, nem que dose seja aplicada exatamente na data prevista. Aplicação futura permanece rejeitada. Validações de vacina ativa e campos documentais continuam sendo regras propostas: acervo com catálogo hoje inativo precisa de decisão institucional/fluxo próprio antes de ser homologado. |
| Cronograma | Entre 1 e 5 datas finitas, estritamente crescentes, respeitando a constraint existente. Não há intervalos clínicos fixos nem exigência de cinco doses. Nenhum cronograma existente é alterado. |
| Autorização | Auth obrigatória, papel `ubs` ou `admin`; UBS só na unidade vinculada. O filtro de unidade ocorre antes do lock do paciente, evitando bloquear prontuário alheio antes de negar acesso. Paciente, perfil ausente/nulo e UBS sem unidade não ganham escrita profissional. |
| Admin | Mantido acesso central entre unidades, como expresso pelas políticas fornecidas. Isso é premissa da regra institucional atual, não nova concessão presumida. Se a instituição exigir admin limitado à unidade, aprovar outra matriz antes de executar. |
| Transações | Cadastro/doses/auditoria e aplicação/atualização/auditoria permanecem atômicos. Locks, índice único parcial e triggers existentes são mantidos. `lock_timeout=5s` e `statement_timeout=60s` limitam espera da migração. |

As verificações de data são de consistência cadastral. Não fazem prescrição nem determinam o protocolo aplicável. Caso seja necessário registrar informação aproximada ou suspeita, não inventar data: definir um fluxo institucional próprio.

## Grants, herança e impacto em outros fluxos

Os REVOKE anteriores em tabela não bastavam para remover concessões explícitas por coluna. A revisão:

1. Mantém REVOKE de execução das três RPCs para PUBLIC/anon e EXECUTE para authenticated. A autorização continua dentro das funções SECURITY DEFINER, que não podem depender do RLS do chamador.
2. Revoga INSERT/UPDATE/DELETE direto de PUBLIC/anon/authenticated em pacientes, esquemas, aplicações e histórico. Revoga também INSERT/UPDATE concedidos diretamente em cada coluna dessas quatro tabelas. SELECT de tabela/coluna permanece como estava; a leitura continua sujeita às políticas existentes.
3. Revoga TRUNCATE/TRIGGER/REFERENCES nas nove tabelas previstas e REFERENCES explícito por coluna. Não revoga automaticamente papéis herdados compartilhados, não muda memberships e não usa CASCADE.
4. Confere privilégios **efetivos** de anon/authenticated com `has_table_privilege`, `has_any_column_privilege` e `has_function_privilege`. Se herança, grantor diferente, ownership ou outra via deixar privilégio incompatível, lança exceção e reverte a transação inteira. Também rejeita papéis de API diretamente configurados com SUPERUSER/BYPASSRLS. Essa verificação não elimina a necessidade de revisar memberships e possibilidade de SET ROLE.
5. Não altera owners, policies, RLS/FORCE RLS, constraints, índices, triggers, default privileges ou concessões a outros beneficiários. Não promove ninguém a admin.

**Impactos previstos:** a interface atual escreve nessas quatro tabelas pelas RPCs, conforme busca em `src`. Clientes antigos, importadores, jobs ou BI que façam escrita direta podem parar de funcionar; integrações SECURITY INVOKER podem perder acesso. O cancelamento direto de aplicação também deixa de estar disponível para o papel de API: antes de oferecer esse fluxo, será necessária RPC auditada. Criação de FK/trigger e manutenção por papéis de API deixam de ser permitidas. O operador administrativo de banco não é substituído por uma conta de aplicação.

O diagnóstico revelou também `va_cadastrar_atendimento`, função legada SECURITY DEFINER ainda executável por authenticated e com seu próprio corpo. Ela não é modificada por 006. Assim, restringir escrita direta não garante que todos os caminhos alternativos tenham a mesma validação/auditoria. Inventariar consumidores e decidir separadamente sua descontinuação ou adequação; não revogar às cegas para evitar quebrar outro fluxo.

Antes de aprovar, executar **somente leitura** `sql/009_acl_dependencias_somente_leitura.sql`: inclui default ACLs, membros/opções de papéis, privilégios efetivos, ACLs por coluna, dependências de catálogo e corpos das funções públicas. `pg_depend` não encontra todo SQL dinâmico ou referências em PL/pgSQL. Conferir também jobs, integrações e consumidores fora do banco. Nenhum desses diagnósticos foi executado remotamente nesta revisão.

## Backup e rollback sem dados pessoais

1. Em homologação, antes de qualquer alteração aprovada, executar `sql/008_backup_definicoes_grants_somente_leitura.sql`. É uma transação READ ONLY/REPEATABLE READ que devolve um JSON único: corpos e fingerprints das funções `va_*`, owners, ACLs de tabela/coluna com grantor/grantee/grant option, políticas, constraints, índices, triggers, memberships e default ACLs. Não consulta linhas de pacientes/perfis/auth.users, senhas, tokens ou chaves. Não é backup de dados nem dump completo de schema.
2. Exportar o JSON retornado para uma pasta local `backups`, ignorada pelo Git. Pode ser o objeto `backup` ou o envelope `[ { "backup": ... } ]` do SQL Editor. Usar arquivo novo por revisão; conferir que o snapshot é anterior à alteração e pertence ao projeto correto.
3. Gerar localmente o rollback revisável, sem conexão de banco:

```powershell
node scripts/gerar-rollback-sql.mjs backups/antes-006-r2.json backups/rollback-006-r2.sql
```

O gerador não sobrescreve arquivo existente. Requer as três assinaturas sem overloads não revisados e as nove tabelas previstas. Produz restauração dos corpos anteriores das três RPCs e ACLs explícitas de PUBLIC/anon/authenticated das tabelas/colunas/funções afetadas; grants de outros beneficiários permanecem intactos. Checa proprietário original e exige execução como esse proprietário, nunca service_role. Rejeita automaticamente snapshot com múltiplos proprietários, grantor diferente do proprietário ou WITH GRANT OPTION para os beneficiários tratados: cadeias de concessão exigem restauração manual revisada em sua ordem, sem CASCADE.

Políticas, constraints, índices, triggers, memberships, defaults e ownership não são recriados pelo rollback, pois 006 não os altera. Seus metadados são guardados para comparação e recuperação manual se houver desvio fora do escopo. O gerador não restaura dados clínicos nem desfaz operações feitas depois da migração. Congelar mudanças independentes de código/grants durante o ensaio; não usar esse rollback sobre um estado com alterações posteriores não revisadas.

**Restaurar as funções antigas também restaura as vulnerabilidades conhecidas.** Preferir corrigir adiante; qualquer rollback remoto exige nova aprovação e análise de exposição. Ter o arquivo pronto não autoriza executá-lo.

## Roteiro transacional em homologação

`sql/010_ensaio_transacional_homologacao.sql` é um roteiro manual independente, **não aplica 006**. Somente após aprovação da migração, backup e conferência do novo diagnóstico:

1. Provisionar manualmente as contas/unidades/catálogos DEMO conforme o relatório da Fase 2. Não modificar contas existentes nem usar prontuários reais. Usar CPF sintético inédito e telefone não roteável. Não enviar convites, WhatsApp ou SMS.
2. Preencher placeholders do 010. A pré-checagem exige contas e unidades com nomes DEMO, paciente sem papel profissional e e-mail `demo-...@vacinacao.invalid`, vacina/lote DEMO e validade finita. Placeholders não preenchidos falham antes das escritas.
3. Executar em projeto de teste: `BEGIN`, `SET LOCAL ROLE authenticated`, claims de cada conta fictícia, cadastro com quatro datas personalizadas, reconsulta, isolamento A/B, paciente sem escrita profissional, leitura/edição de admin, aplicação/auditoria e rejeição de duplicidade.
4. O final é sempre `ROLLBACK`; não substituir por COMMIT. Se houver erro, executar ROLLBACK manual antes de continuar. O teste não cria usuários/perfis, não altera contas, não faz DELETE/TRUNCATE e não deve deixar registros clínicos persistidos.
5. Esse roteiro verifica SQL/RLS sob papel e claims definidos manualmente pelo operador. Não é prova de login, JWT assinado, provisionamento ou comportamento HTTP. Depois, usar `homolog:read` e o ensaio autorizado via API com contas reais de demonstração. O runner de escrita agora exige `HOMOLOG_REVISAO_APLICADA=fase2-006-r2`, além da revisão declarada; esses flags não substituem inspeção do banco.

Para concorrência real, após a correção aprovada, usar duas sessões autenticadas de UBS A sobre a mesma dose sintética. A primeira transação mantém o lock; a segunda deve esperar. Em ensaio separado com persistência sintética autorizada, confirmar a primeira e verificar rejeição da segunda e apenas uma aplicação válida/auditoria. Se a primeira sofrer ROLLBACK, a segunda poderá aplicar: isso não é falha de duplicidade. Não contar duas sessões simuladas sequencialmente em uma conexão como teste concorrente.

O ensaio de falha induzida na auditoria e a perturbação de validade NULL foram feitos **somente no banco local descartável**. Não desabilitar NOT NULL, triggers ou constraints remotos para repetir esses testes. Acesso administrativo de catálogo para backup não significa usar service_role no cliente/runner.

## Testes locais executados e limites

Foi instalado `@electric-sql/pglite@0.5.16` exclusivamente em pasta temporária, com `--ignore-scripts`, sem alterar dependências/lockfile do projeto. O PostgreSQL embarcado informou versão **18.6**. `tests/fixtures/sql-review.sql` usa um schema reduzido dos metadados fornecidos, políticas de teste equivalentes para os cenários exercitados e os dois corpos de triggers recebidos. As três definições anteriores usadas para testar rollback são baselines simuladas, explicitamente identificadas; não são apresentadas como cópia do Supabase. A tabela mínima local `auth.users` não contém senha/token e não cria contas externas.

Reprodução, sem conexão remota de banco:

```powershell
$sqlReviewTools = Join-Path $env:TEMP 'vacinacao-sql-review-tools'
npm install --prefix $sqlReviewTools --no-audit --no-fund --ignore-scripts @electric-sql/pglite@0.5.16
npm run test:sql
```

Se a instalação temporária estiver em outro caminho, definir `SQL_REVIEW_PGLITE_DIR` para esse diretório. A instalação do pacote precisa de rede; a execução dos testes SQL usa apenas arquivos locais e banco em memória, sem ler `.env` ou conectar ao Supabase.

**15 cenários SQL locais aprovados:**

- quatro datas personalizadas, cinco datas, recusa da sexta/duplicadas, UUID e auditoria;
- datas futuras/invertidas/infinita recusadas e nascimento desconhecido no cadastro/edição;
- UBS B sem leitura/escrita em A; paciente lê próprio vínculo sem escrita profissional;
- admin com acesso central previsto e cadastro em B;
- aplicação histórica com lote válido na data, dose sincronizada e duplicidade recusada;
- lote vencido na aplicação, horário futuro, numeric NaN e validade NULL/infinita recusados;
- índice único parcial, FK composta e triggers continuam protegendo operações;
- falha de auditoria reverte aplicação e acompanhamento;
- escrita direta/UPDATE por coluna/TRUNCATE efetivo não permitidos;
- 010 exercitado localmente com ROLLBACK e nenhuma linha nova persistida;
- 008 + gerador + rollback restauram fingerprints e grants explícitos de tabela/coluna;
- privilégio herdado residual causa erro e restaura integralmente o estado anterior à tentativa.

Também foi comparado o snapshot antes/depois de 006: políticas, constraints, índices e triggers permaneceram iguais. O teste de herança precisou ajustar a expectativa para comparar com o estado imediatamente anterior à migração, já contendo o grant sintético herdado; depois passou. Não houve correção remota para obter resultado verde.

**Ainda depende do Supabase:** versão real do PostgreSQL, schema/políticas/defaults/ACLs completos, grantors/cadeias reais, integrações e funções legadas, login/JWT e isolamento via sessões HTTP, concorrência real, reload da UI e decisão institucional sobre admin/acervo histórico. O backup remoto e a geração de rollback a partir dele ainda não foram realizados. A aprovação da aplicação remota permanece pendente.

## Arquivos e verificações finais

Alterados nesta revisão: SQL 006; novos SQLs 008/009/010; `scripts/gerar-rollback-sql.mjs`; `tests/sql-review.mjs` e fixture SQL; cadastro e contrato TypeScript para nascimento nullable; revisão exigida pelo runner e modelo de ambiente; `.gitignore`, package.json, README e documentação. Não foram alterados 004, schema remoto, contas ou dados reais.

| Comando final | Resultado |
| --- | --- |
| `npm run test:sql` | 15 cenários aprovados no PostgreSQL 18.6 embarcado local. |
| `npm test` | 5 testes unitários aprovados; aviso de detecção de módulo TypeScript do Node, sem falha. |
| `npm run lint` | Aprovado, sem avisos. |
| `npm run build` | Aprovado: compilação, TypeScript e geração de 16 páginas. Usa fontes Google existentes e requer rede. |
| `npm run typecheck` após build | Aprovado. |
| `node --check scripts/gerar-rollback-sql.mjs` e `node --check tests/homologacao.mjs` | Aprovados. |
| `git diff --check` | Aprovado. |
| Execução remota, backup real e homologação autenticada | Não executados; pendentes de aprovação/configuração. |

Não houve revisão visual em navegador nesta revisão; a alteração visual limita-se à indicação de nascimento opcional no campo existente. Os resultados locais não autorizam aplicação remota nem comprovam isolamento no ambiente implantado.
