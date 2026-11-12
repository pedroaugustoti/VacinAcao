# Plano baseado no diagnóstico 014 — 12/11/2026

**Nenhuma migração executada pelo agente.** Este plano substitui a ordem anterior 006 → 012 → 011. Preserva a interface e todos os registros. Entrega prevista: 12/11/2026, 19h, São Paulo.

## Comparação com o estado remoto

Fonte: JSON do SQL 014 fornecido pelo usuário no chat, capturado às 16:28:21 UTC, PostgreSQL 17.11. Não inferimos schema por HEAD. Não inferimos histórico de execução a partir da presença de objetos.

O contrato do 011 já está presente: **14 colunas**, tipos/defaults/nulabilidade esperados; **10 constraints validadas**, **4 índices válidos/prontos**, RLS ativo, uma política SELECT para equipe e um trigger de imutabilidade habilitado. As três funções de busca ativa existem com as assinaturas esperadas. Não há coluna extra ou necessidade identificada de backfill/recriação.

Os corpos das três funções e do wrapper legado correspondem aos arquivos locais. Reproduzimos os quatro fingerprints recebidos convertendo somente as quebras de linha internas para CRLF; evidência derivada em `backups/evidencia-014-hashes.json`. Esse arquivo **não é exportação bruta nem backup integral**. O comparador agora admite apenas essa diferença CRLF/LF, preservando diferenças reais no corpo.

Faltam **SELECT na tabela e EXECUTE nas duas RPCs de busca para authenticated**. As ACLs atuais concedem acesso apenas ao proprietário e ao papel de infraestrutura service_role; nenhuma chave desse papel foi utilizada. Grants por coluna estão vazios. Privilégios efetivos anon/authenticated na tabela são todos falsos, explicando o HTTP 403/42501 observado. A política RLS existe, mas não concede sozinha o privilégio SQL de leitura.

A direção de `pg_auth_members` importa: authenticator pode assumir authenticated/anon sem herança; isso não torna authenticated membro de service_role. Não aparece herança adicional para os dois papéis da API no diagnóstico. Os testes de grants efetivos permanecem necessários após aplicar, pois a configuração pode mudar.

As três RPCs clínicas continuam com as definições antigas: v2 aceita unidade sem validar vínculo e itera cinco doses; atualização não verifica autorização institucional; aplicação precisa das validações completas do 006-r2. Os grants EXECUTE de PUBLIC/anon em v2/aplicação devem ser fechados. A ausência de EXECUTE anônimo na atualização não resolve o acesso indevido entre usuários autenticados.

**Legado:** a definição remota já valida papel/unidade e encaminha à v2 com nascimento NULL. Portanto não propomos reaplicar 012. Isso fecha a gravação legada sem auditoria, mas a segurança completa ainda depende de corrigir a v2. Não há chamada ao legado no código atual de `src`; consumidores externos devem ser conferidos. A função legada permanece disponível com autorização e passa a receber as validações do 006-r2, sem alterar sua assinatura.

## Tabela de migrações

| Arquivo | Já presente | Necessário agora | Risco/impacto | Ordem recomendada |
| --- | --- | --- | --- | --- |
| 008 + 014 | Snapshots anteriores/parcial no chat | Exportações atuais integrais para arquivos ignorados | Metadados apenas; não substituem backup de dados | Pré-execução, somente leitura |
| 006-r2 | Três RPCs existem, corpos antigos | Sim: corrigir autorização, datas, cronograma, lote e ACLs | Alto impacto em permissões; escritas diretas passam a falhar; validações mais rigorosas | 1, após aprovação explícita |
| 012 | Wrapper legado correspondente já existe | Não reaplicar neste estado | Reaplicação desnecessária; rollback antigo poderia reabrir contorno da auditoria | Pular |
| 011 | Estrutura, política, trigger, índices e funções existem | Não executar o bootstrap | Evitar substituir objetos ou mascarar drift por IF NOT EXISTS | Pular |
| 015 | Três grants ainda ausentes | Sim: SELECT e EXECUTE direcionados | Habilita dados internos da equipe sob RLS e RPCs com escopo; sem escrita direta | 2, após 006-r2 e aprovação explícita |
| 017 + 014 | Verificadores somente leitura | Sim | Não provam escrita ou isolamento funcional | Após cada aplicação pertinente |
| 016 | Reversão dos três grants do 015 | Somente se necessária e aprovada | Retira disponibilidade; preserva contatos e auditoria | Reversão do 015 |
| 013 | Reversão ampla de disponibilidade existente | Não aplicar junto do 015 | Revoga mais direitos; preferir 016 para este delta | Reserva histórica |

O 015 é repetível. Verifica colunas, constraints, índices, política única, trigger habilitado, proprietário e fingerprints das sete funções verificadas (três clínicas, legado e três da busca), normalizando CRLF/LF. Aborta integralmente se o 006-r2 estiver ausente ou se houver drift nesses objetos; não tenta corrigi-lo automaticamente. Após GRANT, rejeita escrita direta, acesso anônimo ou privilégios excessivos herdados/por coluna. Não altera helpers, memberships, PUBLIC, service_role ou registros. A revisão do novo snapshot deve também conferir os helpers `va_is_admin`/`va_my_unidade`, que participam da política e não são substituídos.

## Checklist antes da aprovação/aplicação

1. Confirmar projeto de desenvolvimento, janela sem mudanças concorrentes, identidade institucional: admin com acesso central; UBS somente à unidade vinculada; paciente sem notas profissionais. Caso admin deva ser limitado a unidade, revisar a proposta antes de aplicar.
2. Executar **somente leitura** 008 e 014 e exportar os JSONs completos como `backups/antes-aplicacao-006.json` e `backups/diagnostico-014.json`. O 014 recebido no chat ainda não foi confirmado como arquivo bruto local. Não substituir os backups antigos. Conferir data, 11 funções atuais e wrapper legado, owner, grants por coluna e herança. O 008 cobre as nove tabelas clínicas; o 014 complementa contatos, política, trigger e ACLs.
3. Auditar e gerar rollback local, sem `--incluir-legado`, pois 006 não altera o wrapper já corrigido:

   ```powershell
   node scripts/auditar-backup.mjs backups/antes-aplicacao-006.json backups/auditoria-antes-aplicacao.json
   node scripts/gerar-rollback-sql.mjs backups/antes-aplicacao-006.json backups/rollback-006-atual.sql
   ```

   O gerador não conecta ao banco e recusa sobrescrita. Revisar o SQL antes de usá-lo. Validar o novo arquivo em cópia local/homologação; os testes atuais validaram o gerador com o snapshot anterior, não esse futuro arquivo. Não usar `rollback-006-012.sql` antigo sobre o wrapper atual. Confirmar também mecanismo de backup de dados do projeto: nenhum desses JSONs contém linhas de pacientes.
4. O snapshot antigo permanece integral: `sql8/sql8.json` e `backups/antes-006-r2.json`, 112.060 bytes, SHA-256 `2d50d896b943802019ccb5b6ba9f09cef6c5721f41567d636564407bc7367ca1`. Arquivos ignorados/não rastreados; varredura não encontrou padrões de JWT, chave secreta, chave privada ou senha literal. É evidência histórica, não backup atual completo. Não incluir ambientes reais no Git.
5. Revisar dependências de escritas diretas: pacientes, cronograma, aplicações e histórico passam a aceitar gravação da aplicação pelas RPCs; eventual integração externa de escrita direta precisará adaptação. Cadastro de vacinas/lotes e leitura continuam conforme as políticas existentes. Cancelamento direto não será disponibilizado sem RPC apropriada.
6. Conferir 006-r2: validade do lote já é NOT NULL no snapshot; a RPC rejeita também NULL/infinito e vencimento **na data da aplicação**, permitindo registro retrospectivo. Acidente/nascimento devem ser finitos, não futuros e nascimento não posterior ao acidente; nascimento pode ser desconhecido. Datas prescritas configuráveis, de 1 a 5, crescentes, sem protocolo clínico fixo. Triggers, FK composta e índice único parcial são preservados.
7. Solicitar aprovação explícita para os arquivos **006-r2 e 015**. Depois da aprovação, operador executa cada arquivo inteiro no SQL Editor como proprietário, verifica o resultado antes do seguinte e guarda os snapshots posteriores. Não executar 004, fixtures ou bootstrap 011.

## Pós-migração e homologação no Supabase

1. Executar 017: as 17 verificações devem retornar `aprovado=true`. Exportar 014 novamente e conferir grants, corpos/RLS/trigger. Executar `npm run homolog:read:admin`: contatos deve sair de 403 para HEAD 2xx. Nenhum desses passos comprova cadastro ou aplicação.
2. Confirmar/criar **manualmente** as contas DEMO e vínculos conforme `HOMOLOGACAO-FASE2.md`. Não colocar senhas no relatório. UBS A e B precisam de unidades diferentes; paciente vinculado à sua fixture em pacientes.user_id; perfil admin com acesso central conforme regra acordada. Sem essas contas, marcar isolamento remoto e PWA autenticado como pendentes.
3. Com dados sintéticos inéditos, executar o ensaio transacional `010_ensaio_transacional_homologacao.sql` conforme suas instruções/identidades e conferir o ROLLBACK. Não usar identidade administrativa para declarar que o acesso do paciente foi testado. Esse ensaio não substitui persistência entre requisições.
4. Cadastro: criar ficha DEMO via aplicação com datas prescritas, experimentar 1/4/5 doses; recarregar, conferir UUID, datas e auditoria. Rejeitar 0/6 doses, ordem inválida e unidade B por UBS A. Datas retrospectivas válidas devem passar. Testar também chamada legada autorizada, conferindo que produz o mesmo histórico e rejeita outra unidade.
5. Aplicação: lote/vacina/unidade compatíveis, validade na data e data real sintética do ensaio. Confirmar uma aplicação válida, sincronização da dose e auditoria após recarga. Rejeitar duplicidade (inclusive sessões concorrentes), esquema de outro paciente, lote incompatível/vencido/não finito, aplicação futura e acesso cruzado. Testar falha sem gravação parcial. Não relaxar NOT NULL/constraints para fabricar cenário remoto de lote NULL.
6. Busca ativa: doses pendentes vencidas aparecem agrupadas pelo paciente e pela mais antiga; aplicar uma dose e conferir a próxima. Doses com aplicação válida ou conferência documental pendente devem ser excluídas. Registrar tentativa **simulada**, canal/resultado/responsável e próximo retorno; recarregar histórico. Repetir mesma chave com mesmos dados retorna o mesmo contato; alterar os dados com a mesma chave deve falhar. Tudo permanece `contexto=demonstracao`.
7. UBS B não lê nem escreve no paciente/contato de A; paciente não consulta fila nem notas internas; admin acessa o escopo central. Conferir chamadas diretas à API além dos menus e rejeição de INSERT/UPDATE/DELETE diretos nas tabelas protegidas. Não concluir isolamento apenas de HEAD, catálogo ou teste local.
8. WhatsApp exige confirmação, abre texto pronto e não registra contato por si só. Não enviar mensagem real no ensaio. Conferir PWA autenticado, recarga, cronograma/atrasos e navegação em sessão separada.

## Reversão

Falha antes de COMMIT: ROLLBACK e revisão; não insistir removendo guards. Para indisponibilizar o delta aprovado 015, revisar/aprovar/executar **016**: remove somente os três grants, verifica privilégios residuais e preserva dados. Para 006, usar apenas rollback recém-gerado do snapshot imediatamente anterior, com aprovação, como proprietário e sem alterações concorrentes. Esse rollback restaura corpos e ACLs-alvo, inclusive por coluna; não restaura dados nem memberships e reintroduz falhas conhecidas, portanto correção adiante é preferível. Não desfazer o wrapper legado correto por engano.

## Evidência e pendências

SQL local usa PostgreSQL 18.6/PGlite, schema reduzido e identidades simuladas; servidor remoto é 17.11. A referência ignora constraints NOT NULL de catálogo `contype=n`, introduzidas na versão local, mas compara nulabilidade por coluna. A inspeção do JSON recebido é revisão de catálogo, não teste funcional remoto. O arquivo bruto 014 ainda precisa ser exportado/preservado antes da execução.

Não houve migração, RPC de escrita, mensagem ou criação/alteração de conta remota. Interface preservada nesta etapa. Resultados locais atualizados constam abaixo; escritura persistida, concorrência real, isolamento remoto com UBS A/B/paciente e navegação autenticada ponta a ponta continuam pendentes.

| Verificação executada nesta revisão | Resultado |
| --- | --- |
| `npm test` | 19 testes unitários aprovados, incluindo HEAD 403 e comparação CRLF/LF |
| `npm run lint` | Aprovado |
| `npm run build` | Aprovado, 17 rotas/páginas |
| `npm run typecheck` | Aprovado |
| `npm run test:sql` | 16 cenários clínicos locais aprovados |
| `npm run test:busca-ativa:sql` | 16 cenários locais aprovados, incluindo 015 repetível, pré-requisito ausente, escrita herdada por coluna, 017 com 17 checks e reversão 016 preservando contato |
| `npm run test:backup` | Snapshot histórico/gerador/rollback validados localmente; quatro fingerprints e ACLs-alvo das nove tabelas |
| Auditoria do backup antigo | JSON integral, ignorado/não rastreado, sem padrões sensíveis detectados |
| `git diff --check` | Aprovado; avisos de conversão LF/CRLF do Git sem erro de whitespace |

Ponto de restauração anterior à comparação: ZIP seletivo em `%TEMP%/vacinacao-before-schema-compare-20261112-131939.zip`, sem ambientes reais. O aviso Node sobre detecção de módulo TypeScript não causou falha. Não foram adicionadas dependências ao projeto nem modificada a interface nesta revisão.
