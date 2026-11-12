# Homologação — Fase 2, 12/11/2026

> A proposta 006 foi revisada: consulte [006-r2](REVISAO-006-R2.md) para regras de datas, backup/rollback, grants por coluna/herança e testes PostgreSQL locais. O runner exige agora `HOMOLOG_REVISAO_APLICADA=fase2-006-r2`. Nada foi aplicado remotamente.

## Resultado real até aqui

O usuário confirmou o projeto de teste `https://nfwfogaklwbrabozqjan.supabase.co` e forneceu o diagnóstico 005 completo. As três RPCs existem e seus argumentos coincidem com o frontend. Foram examinados seus corpos, proprietários, grants, políticas, constraints, índices e os dois triggers enviados. **Não houve login remoto, cadastro, edição, aplicação ou alteração de conta nesta fase.** A homologação operacional ainda não está aprovada.

As contas de demonstração não foram confirmadas pelo responsável. `.env.homolog.local` foi criado a partir do modelo sem senhas/chave, e o Git confirmou que o ignora. `npm run homolog:check` interrompe com chave pública ausente, sem autenticar ou consultar o banco. Não foi utilizada `service_role`. Não executar `004_cadastro_v2_incremental.sql`; recebeu aviso explícito de arquivo histórico.

Ponto de restauração anterior às alterações da Fase 2:
`C:\Users\PEDROO~1\AppData\Local\Temp\vacinacao-before-phase2-20261112-101617.zip`.
Contém fonte, SQL, relatórios, testes, package.json, README e exemplo público, sem credenciais. Não houve commit, deploy ou execução de migrações.

## Contratos e correções do frontend

| RPC | Contrato confirmado | Comportamento atual |
| --- | --- | --- |
| `va_cadastrar_atendimento_v2` | 7 argumentos, `RETURNS uuid` | Valida string UUID escalar e abre `/admin/pacientes/{id}`; não navega com retorno nulo/inesperado. |
| `va_registrar_aplicacao_v1` | 10 argumentos, `RETURNS uuid` | Valida UUID, reconsulta a aplicação por ID/paciente e confere esquema antes de anunciar sucesso; atualiza a ficha. |
| `va_atualizar_paciente_v1` | 7 argumentos, `RETURNS void` | Não exige UUID de edição. Verifica erro e atualiza a página; persistência será conferida no ensaio. |

Os parâmetros agora usam `satisfies RpcArgs<...>` em TypeScript. UUID/date/timestamptz são strings na API; `date[]` é `string[]`, numeric é número, observações e nascimento na edição admitem null. Aplicação converte horário local em ISO com offset explícito e numeric com `Number` finito/positivo. Os nomes dos parâmetros não foram alterados.

Retorno inválido não significa rollback: a interface avisa para consultar ficha/histórico antes de repetir. Testes locais recusam null, objeto, lista e URL no lugar do UUID. As checagens de navegador continuam não sendo barreira de autorização contra chamadas diretas à API.

O limite técnico foi corrigido de 20 para **5**, conforme a constraint `numero_dose <= 5` efetivamente enviada. Isso não seleciona protocolo médico. Quatro, cinco ou outra quantidade entre 1 e 5 continuam configuráveis pela prescrição. O backend atual, porém, força cinco e precisa da correção proposta para aceitar quatro; não acrescentar uma dose para contornar essa falha.

## Achados comprovados no diagnóstico fornecido

1. **Cadastro v2:** `SECURITY DEFINER`, dono `postgres` com BYPASSRLS, `search_path=public`; verifica apenas `auth.uid()` não nulo antes de gravar na unidade recebida. Não confere papel/unidade da sessão. Executa `FOR i IN 1..5`: quatro datas geram tentativa de quinta data NULL e falha pela constraint NOT NULL; acima de cinco datas seriam ignoradas. Possui EXECUTE para PUBLIC/anon, apesar de auth.uid nulo impedir o caminho anônimo normal.
2. **Edição:** mesmo dono/BYPASSRLS e search_path; não verifica sessão, papel ou unidade antes do UPDATE. Uma UBS pode editar paciente de outra unidade via RPC. Não depender de uma eventual falha da FK de auditoria como controle de acesso para contas sem perfil. Justificativa não é validada e o histórico atual só contém motivo, sem antes/depois.
3. **Aplicação:** usa `auth.uid()` como profissional e o trigger `va_validar_aplicacao` confere papel/unidade desse profissional e correspondência esquema/paciente. A FK composta protege lote/vacina/unidade. Entretanto não há, no corpo ou trigger enviados, validação de vacina ativa, validade do lote, horário futuro, campos obrigatórios completos ou estado documental da dose. `esquema_id` admite NULL no banco. Numeric é nullable e o CHECK só exige positivo quando preenchido.
4. **Duplicidade:** existe índice único parcial `aplicacoes_esquema_valida_unique`, garantindo no máximo uma aplicação válida por esquema não nulo. É evidência estrutural; concorrência e comportamento transacional ainda não foram testados. A RPC grava aplicação, atualiza esquema e registra histórico na mesma chamada PostgreSQL, sem capturar erros parciais no corpo enviado.
5. **Proteção de aplicação:** `va_proteger_aplicacao` recusa DELETE e permite apenas transição para cancelamento com campos limitados e autor autenticado. Não foi testado cancelamento e não será usado na apresentação desta fase.
6. **RLS:** está ativo nas nove tabelas enviadas, sem FORCE. As políticas de leitura expressam separação por unidade/vínculo e acesso administrativo. As RPCs pertencem a papel BYPASSRLS, logo essas políticas não corrigem a falta de autorização nos corpos. Não confundir análise das políticas com teste autenticado aprovado.
7. **Escrita direta:** policies ALL de pacientes/esquemas e grants de escrita permitem que UBS contorne RPC/auditoria dentro da própria unidade. Aplicações/histórico também têm INSERT direto concedido. A proposta retira DML direto dessas quatro tabelas e mantém a escrita pelas RPCs revisadas; o código atual não usa insert/update/delete direto nelas.
8. **Grants excessivos:** anon/authenticated recebem privilégios amplos, inclusive TRUNCATE em tabelas do diagnóstico. TRUNCATE não é coberto por RLS. Não foi tentado executá-lo. A proposta revoga TRUNCATE/TRIGGER/REFERENCES das nove tabelas para PUBLIC/anon/authenticated. Revisar heranças e grants explícitos por coluna após aplicar; a proposta não substitui auditoria completa de ACLs/default privileges.
9. **Conta de paciente:** `perfis_role_check` permite só `admin`/`ubs`; role é nullable e o default é `ubs`. Portanto não criar `role='paciente'`, nem atribuir `ubs` ao paciente. O vínculo usado pelo PWA é `pacientes.user_id -> auth.users.id`. As políticas permitem a esse usuário consultar seu próprio cadastro/doses/aplicações.
10. **Perfil profissional:** só há políticas SELECT para perfis no diagnóstico; isso bloqueia UPDATE normal apesar dos grants amplos. Não foi provada exploração de autoelevação. É necessário inspecionar triggers de `auth.users`, não incluídos no primeiro diagnóstico, antes de provisionar contas.

## Proposta segura para revisão, não executada

`sql/006_proposta_correcao_rpcs_fase2.sql` contém alteração incremental revisável, preparada **depois** do exame dos corpos. Mantém assinaturas e retornos; não usa 004, não altera tabelas/constraints/políticas nem dados existentes:

- autenticação e papel explícitos, UBS restrita à unidade; admin autorizado conforme regra atual;
- `search_path` vazio e relações qualificadas;
- datas/quantidade configuráveis dentro do limite técnico existente, com validação estrutural;
- edição com justificativa e antes/depois na auditoria;
- aplicação com locks em paciente/dose, checagem de estado, catálogo/lote e validação dos campos, preservando índice único e triggers;
- execução das RPCs retirada de PUBLIC/anon e concedida a authenticated;
- redução de grants de escrita direta e privilégios administrativos desnecessários.

Não foi aplicada nem executada em PostgreSQL. Requer aprovação explícita antes de alteração remota, exportação das funções/grants atuais para rollback de código e teste em homologação. Alterar grants afeta clientes que escrevam diretamente nessas tabelas; confirmar que não há integrações externas dependentes. Cancelamento deverá ganhar RPC própria antes de ser oferecido na interface. Não remover índices duplicados ou dados nesta fase.

## Preparação manual das contas fictícias

1. Confirmar no Dashboard o projeto de homologação acima. Executar `sql/007_provisionamento_somente_leitura.sql` para examinar triggers de `auth.users`, defaults/constraints e privilégios efetivos. O arquivo não lê e-mails, senhas, tokens ou registros de pacientes. Se um trigger criar automaticamente perfis profissionais para todo usuário, revisar esse comportamento antes de criar paciente; não modificar contas já existentes para contornar o problema.
2. Em Authentication > Users, procurar **apenas os identificadores de demonstração pretendidos**. Não reutilizar contas reais ou promover usuários existentes. Se já houver uma conta DEMO, conferir seu papel e unidade; se não corresponder, interromper e escolher um novo identificador fictício.
3. Se necessário, o responsável cria manualmente quatro usuários fictícios: `demo-admin@vacinacao.invalid`, `demo-ubs-a@vacinacao.invalid`, `demo-ubs-b@vacinacao.invalid`, `demo-paciente@vacinacao.invalid`. Usar criação administrativa com senha definida localmente e confirmação manual/automática de e-mail, sem convite, recuperação de senha ou disparo de e-mail. Não usar signup do app. Não salvar senhas em arquivos rastreados ou relatório.
4. No Table Editor, criar manualmente duas unidades claramente identificadas `DEMO HOMOLOG UBS A` e `DEMO HOMOLOG UBS B`, somente se ainda não existirem. Não alterar unidades reais. Registrar seus UUIDs localmente.
5. Para cada **novo** usuário profissional, criar a linha correspondente em `public.perfis`: `id` igual ao UUID de Authentication, nome DEMO, role `admin` ou `ubs`. UBS A recebe a unidade A; UBS B, a B. Admin pode ter unidade NULL ou a unidade de demonstração. Se a linha já existir, conferir; não sobrescrever perfil de conta existente automaticamente.
6. Para o paciente, não criar papel profissional e não tentar usar `role='paciente'`. Preferir ausência de linha em perfis, desde que os triggers de provisionamento permitam. Uma linha com role NULL é tecnicamente aceita pelo schema, mas não é necessária ao PWA. Se o fluxo de criação atribuir `ubs` por default, interromper e revisar o provisionamento antes de usar a conta; não alterar perfis existentes às cegas.
7. Após correção aprovada do cadastro, criar um paciente **exclusivamente sintético**, nome começando por `DEMO HOMOLOG `, com CPF de teste validado pelo responsável, telefone não roteável (`00000000000`, nunca contatar) e datas de demonstração. Vincular manualmente **somente esse registro sintético** em `pacientes.user_id` ao UUID de Authentication do paciente DEMO. Conferir que não há outro vínculo para a mesma conta. A RPC de cadastro não cria usuário nem atribui `user_id`; são operações distintas.
8. Preparar vacina/lote de demonstração na unidade A, vacina ativa e lote válido na data sintética, sem alterar catálogo/estoque real. Anotar IDs no arquivo local. As aplicações de teste são simulação em projeto de teste, nunca comprovação de aplicação real.
9. Preencher `.env.homolog.local` a partir de `.env.homolog.example`, inclusive os quatro pares de credenciais, fixture vinculada, chave **pública** e IDs sintéticos. Nunca usar service_role. A URL é conferida pelo runner e precisa ser o projeto autorizado.

Não há criação automática de usuários, upsert em perfis, modificação de contas ou limpeza de registros no código de testes. Se houver falha após uma escrita sintética, preservar os registros para inspeção; não repetir com o mesmo CPF sem conferir o estado.

## Testes remotos preparados, ainda não executados

```powershell
npm run homolog:check
npm run homolog:read
# Somente depois de aprovação/aplicação da correção e revisão do novo diagnóstico:
npm run homolog:write
```

`--check` só valida configuração local. `--read` autentica as quatro contas, confere identidade/papel, o vínculo sintético do paciente, leitura UBS A/admin e bloqueio UBS B/anon por IDs conhecidos. Não varre cadastros.

`--write` exige `HOMOLOG_SQL_REVISADO=sim` e `HOMOLOG_REVISAO_APLICADA=fase2-006`; esses campos são declaração operacional, não prova automática do schema. O responsável deve conferir as definições após a mudança. O ensaio prepara cadastro sintético de quatro datas, reconsulta de persistência, rejeição de cadastro/edição/aplicação por papel/unidade indevidos, edição UBS/admin com retorno void, registros de auditoria, aplicação com UUID, acompanhamento atualizado e duplicidade sequencial rejeitada sem histórico duplicado. A nova ficha criada não é automaticamente vinculada ao paciente DEMO; a fixture vinculada separada testa o PWA.

Rejeições com `42501` são reconhecidas como autorização. `P0001` genérico em teste de autorização é inconclusivo e interrompe o ensaio, para não contar erro de validação como prova de isolamento. Nenhum teste envia WhatsApp/SMS. Não há DELETE/TRUNCATE ou alteração de conta.

Ainda precisam de ensaio específico: concorrência simultânea, rollback com falha induzida, quatro/cinco datas pela UI, lote vencido/incompatível, catálogo inativo, data futura, escrita direta bloqueada e verificação completa das políticas. Não afirmar cobertura total pelo runner.

## Roteiro para demonstrar às 19h

1. Aplicar somente a correção SQL que tiver aprovação e homologação; manter 004 sem execução. Reexecutar diagnóstico para conferir corpos/grants. Preparar contas conforme acima.
2. Entrar como UBS A, cadastrar paciente sintético com o cronograma prescrito para a simulação. A aplicação deve abrir a ficha pelo UUID retornado. Recarregar a página inteira e procurar o mesmo paciente na listagem, conferindo quantidade/datas sem criar uma quinta dose para contornar erro.
3. Registrar aplicação sintética na ficha. Conferir identificação retornada, histórico, status/data da dose e indicador de aplicação documentada. Recarregar e repetir a tentativa sobre a mesma dose apenas no teste de duplicidade; não deve gerar segunda aplicação válida.
4. Abrir sessão separada de UBS B e conferir bloqueio da ficha/consultas do paciente de A. Admin deve ter leitura prevista pela regra. Login paciente deve mostrar somente sua fixture vinculada; recarregar também doses e perfil.
5. Mostrar lista de atrasos com dados sintéticos datados para esse fim e explicar que o WhatsApp só abre um link manual. Não clicar em envio e não anunciar SMS/automação.

## Verificações locais e arquivos

Executados: leitura de AGENTS/guias locais e fontes, `rg`, `git status`, ZIP de restauração, `git check-ignore .env.homolog.local`, `npm run homolog:check`, `node --check tests/homologacao.mjs`, `npm run lint`, `npm test`, `npm run build`, `npm run typecheck`, `git diff --check` e smoke HTTP local.

| Verificação final | Resultado real |
| --- | --- |
| `npm run lint` | Aprovado, sem avisos. |
| `npm test` | 5 testes aprovados: 3 de cronograma e 2 de retorno UUID. O Node emite aviso de detecção de módulo TypeScript, sem falha. |
| `npm run build` | Aprovado com acesso às fontes Google: compilação, TypeScript e geração das 16 páginas. |
| `npm run typecheck` após build | Aprovado. |
| `node --check tests/homologacao.mjs` | Aprovado; é checagem de sintaxe, não teste remoto. |
| `git diff --check` | Aprovado. |
| `git check-ignore .env.homolog.local` | Confirmou arquivo ignorado. |
| `npm run test:smoke` com servidor de produção local | 7 verificações aprovadas: login paciente/UBS, registro e manifesto 200; admin/cadastro/pacientes sem sessão redirecionam 307 ao login UBS. Servidor encerrado ao final. |
| `npm run homolog:check` | Bloqueado por falta de chave pública/credenciais; não foi feita chamada remota pelo runner. |
| `npm run homolog:read` / `homolog:write` | Não executados: contas pendentes e correção SQL não aprovada/aplicada. |
| SQL 006 em PostgreSQL | Não executado nem homologado; proposta para revisão. |

Os cinco testes unitários e o smoke não comprovam persistência, autorização nem duplicidade no Supabase. Reload no navegador com sessão também não foi testado.

Alterados nesta fase: `.gitignore`, `.env.homolog.example`, `package.json`, `README.md`; cadastro, formulário de aplicação e formulário de edição; `src/lib/cronograma.ts`, `src/lib/rpc-contracts.ts`; testes de cronograma/UUID e `tests/homologacao.mjs`; aviso em SQL 004; SQLs 005/006/007 e este relatório. `.env.homolog.local` é local e ignorado.

Os bloqueios restantes são concretos: falta configuração das contas/chave de demonstração e falta aprovar/aplicar/homologar a correção dos problemas SQL encontrados. Não é necessária nem apropriada uma chave administrativa no runner para contornar esses bloqueios.
