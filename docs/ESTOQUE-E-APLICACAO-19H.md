# Estoque DEMO e aplicação — entrega de 12/11/2026, 19h

## Estado verificado agora

O JSON `backups/diagnostico-018.json` foi salvo pelo usuário e lido integralmente: 174.851 bytes, capturado em 12/11/2026 às 17:08:44 UTC (14:08:44 São Paulo). SHA-256 `3688c520bf92fea7ecdd75f22a52d27b115422cab82f590ee3896014ceddd704`. Está ignorado pelo Git; varredura não encontrou padrões de JWT, chave secreta ou chave privada. Não contém linhas clínicas. Não substitui backup de dados.

O diagnóstico lista dez tabelas públicas e não identifica tabelas de saldo/movimentações no escopo inspecionado. `vacinas` contém id, nome, si_pni, apresentacao opcional, ativo e created_at; `lotes_vacinas` contém vacina/unidade, número, fabricante, validade NOT NULL e created_at. A proposta preserva essas tabelas e suas constraints, índices, políticas e registros. Não recria Authentication, usuários, perfis ou unidades.

**O estado mudou desde o 014:** hashes normalizados das três RPCs clínicas correspondem ao 006-r2; legado continua wrapper auditado; as duas RPCs de busca ativa já concedem EXECUTE a authenticated e a tabela contatos já concede SELECT. Nas quatro tabelas clínicas, authenticated possui SELECT sem INSERT/UPDATE/DELETE de tabela. O relatório de comparação local está em `backups/comparacao-018.json`. Isso demonstra definições/grants presentes, sem inferir quem executou qual migração. A leitura administrativa remota foi repetida: login, identidade, papel admin e dez HEAD aprovados, incluindo contatos. Nenhuma RPC ou gravação foi executada pelo agente nessa validação.

| SQL | Situação e ação |
| --- | --- |
| 006-r2 | Corpos corrigidos já presentes no 018; não reaplicar automaticamente. Conferir privilégios efetivos com 017. |
| 015 | Grants esperados já presentes; não reaplicar automaticamente. Não confundir grants com homologação de contato. |
| 011 / 012 | Estrutura de busca e wrapper presentes; não reaplicar bootstrap. |
| 019 | **Nova proposta para aprovação**, somente depois do checklist abaixo. |
| 020 | Roteiro sintético comentado, com ROLLBACK; não é seed automático. |
| 021 | Contenção de disponibilidade, se necessária e aprovada; preserva dados. |
| 022 | Consulta opcional de candidatos DEMO para revisão humana; não exclui. |
| 023 | Verificação de saldo/ledger, RLS, grants e triggers após 019. |

Este documento substitui a sequência histórica 006 → 015 para o snapshot atual. Se um novo snapshot divergir, interromper e revisar.

## Modelo implementado e limites

- `/admin/estoque`: catálogo, edição/ativação/desativação de vacina (admin), criação de lote para unidade autorizada (admin ou UBS vinculada), saldo, entradas/saídas e últimos 50 movimentos. Módulo indisponível não vira saldo zero.
- Estoque exclusivamente DEMO em **unidades de aplicação**. Cada aplicação válida consome **1 unidade**, independentemente da quantidade clínica em mL. Não calcula doses por frasco, perdas técnicas ou conversões; não serve como inventário real/multidose. Essa semântica faz parte da proposta que será aprovada.
- Saldo inicial não é inventado. Lotes existentes não recebem carga automática nem baixa retroativa das aplicações anteriores. Uma entrada sintética explícita é necessária.
- Saldo não negativo por constraint e UPDATE condicional atômico. Entrada/saída manual usa chave idempotente por responsável, exige motivo e registra autor/data. Repetir a mesma chave e dados retorna o mesmo movimento; reutilizá-la com dados diferentes é rejeitado.
- A baixa é trigger AFTER INSERT da aplicação na mesma transação da RPC existente. Não altera sua assinatura nem corpo, cronograma, regras de prescrição, triggers anteriores ou índice único parcial. Falha na baixa/auditoria reverte aplicação, saldo, movimento e status da dose.
- Movimentos imutáveis. Correções por movimento compensatório com motivo. Lote já movimentado não pode ser alterado para outra vacina/unidade/fabricante/validade; cadastrar outro lote se necessário. Entrada rejeita validade vencida/não finita; aplicação continua conferindo validade na data clínica, preservando registros retrospectivos legítimos.
- Cancelamento clínico não repõe estoque automaticamente. Não há cancelamento novo nesta entrega; reposição física exige decisão profissional e movimento documentado, sem inventar retorno de uma dose utilizada.
- RLS SELECT: admin central, UBS somente unidade vinculada; paciente sem acesso. RPCs validam papel/unidade e não confiam no cliente. Sem escrita direta nas duas novas tabelas. service_role não é usado no cliente, runner ou provisionamento.

## Checklist de aplicação pelo operador

1. Confirmar projeto exclusivamente de desenvolvimento e a regra de unidade de estoque acima. Parar mudanças concorrentes e não fazer limpezas para preparar a demonstração.
2. Guardar snapshots atuais 008, 014 e 018 em arquivos distintos e ignorados, com data/hash; guardar backup de dados separadamente. O 008 antigo não representa os corpos/grants atuais e não deve ser usado para voltar às RPCs inseguras. O 018 complementa o catálogo e confirma o estado atual. Reexecutar 017 para verificar privilégios efetivos, inclusive herança/coluna; qualquer `false` exige revisão antes de prosseguir.
3. Revisar **019 inteiro** e obter aprovação explícita. Não precisa reaplicar 006/015 no estado observado. O guard do 019 verifica corpo da aplicação e permissões básicas; criação sem IF NOT EXISTS aborta diante de objetos conflitantes, em vez de esconder drift. Guard não substitui a leitura do snapshot.
4. Executar manualmente 019 inteiro como proprietário no SQL Editor, sem chave administrativa em scripts. Se houver erro antes do COMMIT, ROLLBACK e diagnóstico; não remover guards ou constraints para forçar passagem. 019 não é repetível: se já aplicado, inspecionar objetos antes de qualquer nova ação.
5. Executar 023: zero divergências de saldo/ledger; RLS e permissões corretos; trigger de consumo habilitado junto dos dois triggers clínicos anteriores. Conferir 017 novamente. Exportar 018 posterior e guardar evidências.
6. Criar dados sintéticos pela página ou adaptar 020: vacina com nome/código DEMO (código não oficial, não usar em integrações SI-PNI), lote DEMO, fabricante fictício, unidade DEMO existente, validade futura e entrada de 10 unidades com motivo e chave única. Não criar/alterar usuários automaticamente. O 020 permanece comentado e termina em ROLLBACK para revisão.
7. Homologar escrita conforme o roteiro abaixo. Sem aplicação aprovada de 019, a interface de aplicação exige consulta de estoque e fica bloqueada; isso é intencional e será apresentado como indisponibilidade, não sucesso.

## Reversão e contenção

Antes do COMMIT, a transação permite ROLLBACK integral. Depois do COMMIT, **não apagar tabelas ou movimentos nem remover apenas o trigger**: isso perderia rastreabilidade ou permitiria aplicação sem baixa. Proposta 021 revoga escrita das novas RPCs e execução da aplicação, mantendo dados, trigger e leitura para investigação. É contenção, não desinstalação ou restauração de dados. Conferir também acessos herdados e interromper outros clientes durante a contenção. Reabrir somente após correção revisada, novo backup e aprovação; GRANT de EXECUTE apenas aos quatro contratos necessários, nunca PUBLIC/anon.

O 021 suspende as quatro RPCs; não é bloqueio global de outros clientes que já possuam acesso direto ao catálogo pelas políticas antigas, nem de operadores privilegiados. Interromper esses clientes na janela de contenção. O 019 não substitui funções existentes nem modifica ACLs das tabelas antigas, portanto não exige restaurar corpos clínicos para reverter seu código. Qualquer desinstalação futura após movimentos depende de plano específico de reconciliação/arquivamento aprovado. Não usar rollback antigo de 006/012: reintroduziria falhas conhecidas. Backup de metadados não recupera dados excluídos.

## Roteiro funcional de apresentação e homologação

1. Admin entra e abre Vacinas e estoque. Criar vacina DEMO, editar nome, desativar/reativar e conferir recarga. Nenhum número deve aparecer antes da consulta persistida.
2. Cadastrar lote DEMO vigente na unidade A; duplicar o mesmo número/vacina/unidade deve falhar. Registrar entrada de 10, recarregar e conferir histórico/autor. Saída de 11 deve falhar sem alterar saldo. Repetir a mesma chave de entrada não duplica saldo. Entradas em lote vencido devem falhar.
3. UBS A cadastra paciente fictício com datas prescritas e confirmadas (1 a 5, sem alteração automática da prescrição); recarrega ficha. Usar fixture sintética já revisada para atraso, sem forçar agendamento clínico real.
4. Registrar uma aplicação simulada com lote de saldo 10. Depois da recarga: saldo 9, uma baixa vinculada ao UUID da aplicação, status da dose e auditoria atualizados. Segunda aplicação da mesma dose deve falhar, mantendo saldo 9.
5. Testar duas sessões simultâneas tentando consumir a última unidade para doses diferentes: apenas uma deve confirmar, outra deve falhar sem saldo negativo ou status/histórico parcial. Este teste real de concorrência está **pendente**.
6. Buscar faltoso na fila; conferir dose mais antiga, contagem e atualização após aplicação. Registrar contato sintético manual e conferir histórico e próximo acompanhamento; WhatsApp apenas prepara link/texto, sem envio real ou automático.
7. UBS B não vê/movimenta lote de A nem aplica dose de A; paciente não administra catálogo, estoque ou contatos internos. Confirmar chamadas diretas da API além dos menus. Admin central conforme regra acordada.
8. Conferir paciente/PWA em sessão DEMO vinculada e recarregar doses/perfil. Sem conta correspondente, registrar esse item como pendente.

## Limpeza seletiva

Nenhum registro foi classificado como seguramente descartável. 022 oferece candidatos por prefixo DEMO com contagens de dependências, sem nomes/telefones no relatório. Prefixo não prova obsolescência. Não executar exclusões; aprovar uma lista explícita e plano de preservação de auditoria antes de futura limpeza. Não é necessário limpar o projeto para a apresentação.

## Testes e arquivos

SQL local em PostgreSQL 18.6/PGlite com schema reduzido: dez cenários de estoque aprovados (`npm run test:estoque:sql`), mais 16 cenários clínicos e 16 de busca ativa. Incluem saldo insuficiente/idempotência, consumo, duplicidade, autorização, cadastro/edição de vacina, lote duplicado/unidade incorreta, rollback de auditoria e proteção de lote movimentado. Não comprovam concorrência real nem políticas completas do Supabase 17.11.

Lint, 19 unitários, build (18 páginas/rotas) e TypeScript passaram. Leitura remota administrativa passou com dez HEAD, sem RPC/escrita. A homologação de escrita e concorrência remota continua pendente; o código e o SQL preparado não são aprovação funcional.

A inspeção de navegador somente leitura passou em desktop 1440×1000 e celular 390×844, incluindo a nova página de estoque: sem overflow da página, sem erros JavaScript e menu móvel operável por teclado. Capturas de estoque examinadas em `backups/preview-visual/`, ignoradas pelo Git. Na sessão atual, catálogo/lotes estão vazios e o módulo de saldo ainda indisponível, coerente com 019 não aplicado. A busca ativa já apresenta a fila/estado vazio consultado, em vez do erro anterior. Nenhum formulário de catálogo, lote, aplicação ou contato foi enviado. PWA autenticado continua pendente de conta DEMO. Aviso Node de módulo TypeScript e avisos Git LF/CRLF preexistentes não causaram falha.

Novos: SQLs 018–023; `src/app/(ubs)/admin/estoque/page.tsx`; `tests/estoque-sql.mjs`; `scripts/conferir-018.mjs`; este documento. Ajustados: sidebar, ficha e formulário de aplicação, script de inspeção visual administrativa, rótulo de pendência do runner somente leitura, package.json e README. Os arquivos 006/015 foram preservados. Ponto de restauração seletivo: `%TEMP%/vacinacao-before-stock-20261112-140612.zip`.
