# Auditoria da base — 12/11/2026

> Registro histórico da Fase 1. A confirmação e análise posterior das RPCs, os achados de autorização e o roteiro atual estão em [Homologação da Fase 2](HOMOLOGACAO-FASE2.md). Não executar SQL 004: a RPC já existe.

## Situação

Foram feitas correções reais preservando componentes, cores, navegação e páginas. A base compila, mas a operação clínica ponta a ponta depende de homologação do Supabase. Não houve login com contas de teste nem acesso administrativo aos metadados. Build e smoke não comprovam funcionamento das RPCs/RLS remotas.

Nenhum dado clínico foi consultado ou alterado. Nenhuma RPC foi executada remotamente, nenhuma migração foi aplicada e nenhuma mensagem foi enviada.

## Ponto de restauração

Já havia alterações e arquivos não rastreados quando a auditoria começou. `git switch -c auditoria/mvp-base` falhou por restrição de escrita em `.git/refs`. Antes de editar, foi criado:

`C:\Users\PEDROO~1\AppData\Local\Temp\vacinacao-before-audit-20261112-095426.zip`

Contém `src`, `sql`, `public`, AGENTS.md, package.json, package-lock.json, tsconfig.json, next.config.ts, eslint.config.mjs e README.md anteriores às correções. Não contém `.env.local`, `.git` ou dependências. Para restaurar, extrair primeiro em outra pasta e comparar; extrair sobre o projeto não remove arquivos adicionados depois. Não sobrescrever trabalho posterior sem revisão.

## Estrutura e ambiente

`src/app/(ubs)` contém o painel profissional; `src/app/(pwa)`, a área do paciente. Os clientes Supabase estão em `src/lib/supabase`. `src/proxy.ts` substitui a convenção depreciada middleware. O único SQL anterior era `sql/002a_cadastro_transacional.sql`, que não representa um schema completo.

Foram lidos AGENTS.md e os guias instalados de proxy, autenticação, autenticação com Cache Components e cookies. Não houve mudança de versão de dependências.

| Variável | Necessária | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Sim | URL do projeto, usada no SSR, navegador e proxy. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sim | Chave pública anon/publishable compatível com o projeto. A segurança depende de RLS/grants. |
| `SUPABASE_SERVICE_ROLE_KEY` | Não | Presente no ambiente local, sem uso no código atual. Não foi utilizada nem exibida. |
| `SMOKE_BASE_URL` | Só teste, opcional | Padrão `http://127.0.0.1:3100`. |

As variáveis Supabase foram identificadas apenas por nome. `.env.example` não contém credenciais. Não há variável exigida de provedor WhatsApp/SMS ou conexão PostgreSQL. Nunca colocar chave secreta em variável pública.

## Problemas e correções

1. **TypeScript:** `exact` não existia em todos os tipos de item da sidebar. Foi tipado como opcional.
2. **ESLint:** componente criado dentro da renderização, `any` no perfil e variáveis sem uso. Corrigidos sem desativar regras.
3. **Cronograma fixo:** removidas as afirmações de cinco doses obrigatórias e padrão médico. Agora permite intervalos informados pelo profissional ou adição/remoção manual das datas. Exige confirmação profissional, reiniciada após mudança do cronograma. Validação estrutural aceita 1–20 datas reais, estritamente crescentes; o cálculo limita intervalos a 3650 dias. São limites técnicos, não prescrição. A confirmação está na interface e não constitui assinatura clínica persistida.
4. **Contratos SQL divergentes:** o SQL anterior tem outro nome, seis argumentos, nenhum nascimento e exatamente cinco datas. Criados diagnóstico somente leitura e proposta incremental de cadastro v2 que preserva qualquer função remota já existente.
5. **Erro de RPC mal interpretado:** o cadastro classificava qualquer erro contendo o nome da função como inexistência e mandava executar script. Agora verifica códigos de resolução e orienta revisar assinatura, permissões e cache. Aplicação/edição também evitam afirmar inexistência remota com base nesse erro.
6. **Auditoria não comprovada:** retiradas mensagens que garantiam auditoria/sincronização só pelo sucesso da RPC. O banco precisa ser inspecionado e o histórico conferido.
7. **Dose não elegível:** formulário agora oferece somente `pendente`/`atrasada`, sem aplicação válida ou conferência pendente. Quantidade não finita e seleção que deixou de existir são recusadas. Isso não substitui validação transacional no banco.
8. **PWA:** próxima dose inclui status `atrasada`. Erros de paciente/doses/perfil não aparecem mais como cadastro ausente ou falta de pendências.
9. **Sessão:** redirecionamentos preservam cookies renovados pelo SSR; login com sessão escolhe destino pelo papel. Autorização continua nas páginas e, principalmente, no banco.
10. **Dashboard:** consulta percorre páginas de pacientes, ordenadas por ID, e compara com contagem exata. Erro/inconsistência impede mostrar indicadores como completos. Não foram inseridos números fictícios. Para escala maior, migrar indicadores para agregações transacionais no banco.
11. **Faltosos:** atraso passa a ter prioridade sobre conferência documental na classificação quando as condições coexistem.
12. **Autorização:** edição bloqueia explicitamente UBS sem unidade. Outras páginas já tinham verificações de papel/unidade. Filtros da interface não substituem RLS contra acesso direto à API.
13. **Busca ativa:** dashboard explicita que WhatsApp abre link, o envio é manual e não há histórico. Não existe automação de WhatsApp/SMS implementada.

A vinculação automática por CPF já estava desativada no estado inicial e foi preservada. Não foi reintroduzida alteração de titularidade ou exclusão de contas com chave administrativa.

## RPCs identificadas

| RPC | Parâmetros enviados pelo frontend | SQL anterior | Remoto |
| --- | --- | --- | --- |
| `va_cadastrar_atendimento_v2` | `p_unidade_id`, `p_nome`, `p_cpf`, `p_whatsapp`, `p_data_acidente`, `p_data_nascimento`, `p_datas_previstas` | Não; há outra função sem nascimento | Não confirmado |
| `va_registrar_aplicacao_v1` | `p_paciente_id`, `p_esquema_id`, `p_vacina_id`, `p_lote_id`, `p_aplicada_em`, `p_via`, `p_local`, `p_quantidade`, `p_unidade_medida`, `p_observacoes` | Não | Não confirmado |
| `va_atualizar_paciente_v1` | `p_paciente_id`, `p_nome`, `p_cpf`, `p_whatsapp`, `p_data_nascimento`, `p_data_acidente`, `p_motivo` | Não | Não confirmado |

Nomes e tipos de parâmetros importam na resolução do PostgREST. O frontend verifica principalmente `error`; o retorno remoto ainda precisa ser documentado. A proposta de cadastro retorna UUID.

A leitura inicial de OpenAPI foi bloqueada pela rede do sandbox (`EACCES`). Com rede, retornou HTTP 401: `Secret API key required` / `Only secret API keys can be used for this endpoint.` A chave administrativa não foi usada para contornar isso. O resultado **não prova** inexistência de RPC, defeito da chave pública para login ou ausência de RLS.

## SQL entregue

- `003_auditoria_somente_leitura.sql`: inspeciona assinaturas/definições, grants, colunas, RLS, políticas, constraints, índices e triggers em transação somente leitura. Não consulta pacientes.
- `004_cadastro_v2_incremental.sql`: proposta **não executada**. Se qualquer função pública com esse nome existir, preserva-a e emite aviso, sem criar overload. Se não existir, exige tabelas com RLS ativo e colunas esperadas. Usa `SECURITY INVOKER`, `search_path` vazio, papel/unidade da sessão, validação estrutural e cadastro/doses atômicos. Revoga execução pública/anon e concede authenticated somente à função criada. Não modifica cronogramas existentes.
- `002a_cadastro_transacional.sql`: preservado. É contrato legado fixo de cinco datas, com verificações que também precisam tratar nulos explicitamente. Não aplicar como solução do fluxo atual.

004 não confirma adequação das políticas, tipos/defaults/constraints completos ou efeitos de triggers. Não foi inventada implementação de aplicação/edição ou política permissiva para fazer as telas funcionarem: faltam os contratos remotos de auditoria, estoque e schema. Os SQLs não foram executados nem validados em PostgreSQL nesta sessão.

## Passos manuais no Supabase

1. Executar **somente 003** no SQL Editor administrativo e revisar metadados. Exportar as definições para versionamento sem dados de pacientes. Não compartilhar credenciais.
2. Conferir os três contratos, overloads, tipos e nomes de parâmetros. Se existirem, comparar os corpos antes de mudar. Se cadastro v2 não existir, revisar/aprovar 004, testar em projeto separado e só depois aprovar produção. Nenhum desses passos foi realizado nesta auditoria.
3. Na RPC de aplicação, conferir: paciente/dose/lote da mesma unidade, vacina ativa, lote da vacina, validade na data aplicada, horário não futuro, quantidade positiva e profissional obtido por `auth.uid()`. Rejeitar status inadequado, conferência pendente e duplicidade concorrente. Exigir trava/constraint ou índice único adequado para uma aplicação válida por dose. Aplicação, sincronização e auditoria devem confirmar/falhar juntas.
4. Na edição, exigir papel/unidade, justificativa e auditoria na mesma transação. Não permitir mudar vínculo do usuário, unidade ou registros clínicos nesse fluxo.
5. Revisar RLS de pacientes, esquemas, aplicações, lotes, vacinas, notificações, perfis e unidades. Paciente lê apenas seu vínculo/doses e não escreve registros clínicos; UBS acessa sua unidade; administrador conforme regra institucional; anônimo sem dados clínicos. Policies permissivas se combinam por OR: uma ampla pode neutralizar outra restritiva.
6. Impedir que usuário altere seu próprio `perfis.role` ou `perfis.unidade_id`, inclusive diretamente pela API. Revisar grants, funções `SECURITY DEFINER`, dono, `search_path`, execução por PUBLIC/anon e triggers de autenticação. RLS ativo sozinho não comprova segurança.
7. Homologar contas de teste de admin, UBS A, UBS B e paciente. Provisionar e vincular por processo administrativo aprovado: CPF sozinho não comprova identidade. Login por CPF usa o alias `CPF@paciente.vacinacao.app` e depende desse provisionamento; também aceita e-mail.
8. Em projeto separado com dados sintéticos: cadastrar quatro/cinco/quantidade personalizada de doses; testar datas inválidas e rollback; aplicar e conferir histórico/esquema/profissional; reenviar e concorrer a mesma aplicação; testar lote de outra unidade/vacina, lote vencido e acesso direto à RPC por paciente ou UBS de outra unidade. Não enviar mensagens.
9. Versionar aplicação/edição remotas e correções incrementais de RLS depois de inspecionadas. Recarregar cache da API após mudança aprovada. Conferir catálogos de vacina, SI-PNI, lotes e unidades antes do ensaio.

## Comandos e resultados

Exploração: `Get-Content`, `Get-ChildItem`, `rg --files`, `rg -n`, `git status --short`, `git branch --show-current`. Preservação: `git switch -c auditoria/mvp-base` (falhou) e `Compress-Archive` (sucesso). Consultas Node `fetch` foram limitadas ao endpoint de metadados. Nenhum valor de ambiente foi impresso.

| Verificação | Resultado |
| --- | --- |
| `npx tsc --noEmit` inicial | Falhou no tipo `exact`; corrigido. |
| `npm run lint` inicial | Falhou em `any`/componente na renderização; corrigido. |
| `npm run lint` após correções | Aprovado, sem avisos. |
| `npm run build` sem rede | Bloqueado no download das fontes Google. |
| `npm run build` com rede | Aprovado: compilação, TypeScript e geração das 16 páginas. |
| `npm run typecheck` isolado após build | Aprovado. Tentativa simultânea ao build encontrou tipos `.next` sendo recriados; usar sequência. |
| `npm test` | 3 testes aprovados: quatro/cinco datas; intervalos inválidos/limites; datas reais, ano bissexto e virada de ano. Aviso de detecção de módulo do Node não afeta o resultado. |
| `npm run start -- --hostname 127.0.0.1 --port 3100` + smoke HTTP | 7 verificações aprovadas: `/login`, `/login-ubs`, `/registro`, manifesto 200; `/admin`, `/admin/cadastro`, `/admin/pacientes` 307 para login UBS sem sessão. |
| `git diff --check` | Aprovado; apenas avisos de normalização LF/CRLF. |

O smoke inicial com `node -e` precisou corrigir o verificador para aceitar `Location` relativo e depois passou integralmente. Versão reproduzível: `tests/smoke.mjs`, comando `npm run test:smoke`. O servidor usado foi encerrado.

**Bloqueados/não homologados:** execução PostgreSQL, inspeção remota completa, cadastro/aplicação/edição autenticados, RLS por identidade/unidade, concorrência, rollback e persistência de auditoria. Não houve revisão visual em navegador nem ensaio com contas. Não anunciar homologação clínica a partir do build/smoke.

## Arquivos alterados por esta auditoria

- `.gitignore`, `.env.example`, `package.json`, `README.md`.
- `src/proxy.ts` (migração de `src/middleware.ts`).
- `src/lib/cronograma.ts`, `tests/cronograma.test.mjs`, `tests/smoke.mjs`.
- `src/app/(ubs)/admin-sidebar.tsx`.
- `src/app/(ubs)/admin/cadastro/page.tsx`, `src/app/(ubs)/admin/page.tsx`, `src/app/(ubs)/admin/pacientes/page.tsx`.
- `src/app/(ubs)/admin/pacientes/[id]/page.tsx`, `form-aplicacao.tsx`, `editar/page.tsx`, `editar/form-editar.tsx`.
- `src/app/(pwa)/page.tsx`, `src/app/(pwa)/perfil/page.tsx`, `src/app/actions/vincular.ts`.
- `sql/003_auditoria_somente_leitura.sql`, `sql/004_cadastro_v2_incremental.sql`, este relatório.

Outras alterações no Git, incluindo estilos, ícones e exclusão do antigo login, já existiam e foram preservadas. Não houve commit, instalação de dependências ou deploy.

## Próxima implementação proposta: busca ativa

Após homologar os fluxos e o banco:

1. Criar histórico de tentativas com paciente, dose opcional, unidade, profissional da sessão, horário, canal, resultado (sem resposta, orientado, reagendado), observação limitada e próximo retorno. Abrir WhatsApp não comprova envio: o profissional registra o resultado real. Correções preservam rastreabilidade.
2. RPC transacional para contatos, RLS por unidade/autoria e auditoria. Paciente sem acesso a notas internas. Nenhum envio externo automático nesta etapa.
3. Fila por paciente com dose mais antiga em atraso, dias de atraso, última tentativa, responsável e retorno. Separar atraso de pendência documental e evitar tentativas repetidas indevidas.
4. Alertas internos deduplicados para novo atraso, retorno vencido e ausência de contato. Só anunciar automação após validar o processamento. Contato não altera prescrição ou datas clínicas.
5. Indicadores agregados no banco por unidade/período: pacientes atrasados, sem tentativa registrada, tentativas por resultado e comparecimento após contato. Definir denominadores; não atribuir causalidade ao contato. Erro de consulta não vira número fictício.

Essa fase foi proposta, não implementada, conforme a sequência solicitada. A prioridade antes das 19h é homologar RPCs/RLS com dados sintéticos e ensaiar os fluxos da apresentação.
