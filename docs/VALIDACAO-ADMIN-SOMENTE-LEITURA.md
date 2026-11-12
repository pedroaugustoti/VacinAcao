# Validação administrativa parcial — 12/11/2026

## Resultado remoto real

`npm run homolog:check` validou localmente a URL do projeto autorizado e o formato da chave pública. O arquivo `.env.homolog.local` continua ignorado pelo Git e não foi reescrito. Foram examinados apenas indicadores de presença das variáveis: admin configurado, UBS A/UBS B/paciente ainda sem credenciais configuradas. Nenhuma senha, chave, token, UUID de usuário ou linha clínica foi impressa.

Em seguida, `npm run homolog:read:admin` foi executado contra o Supabase de desenvolvimento com a conta administrativa existente informada pelo responsável. **13 verificações remotas parciais foram aprovadas:**

| Verificação | Resultado |
| --- | --- |
| Login por e-mail/senha da conta existente pela API | Aprovado. |
| `auth.getUser()` e correspondência da identidade da sessão | Aprovado. |
| Leitura do próprio perfil e `role=admin` | Aprovado. |
| SELECT HEAD de `unidades_saude` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `perfis` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `pacientes` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `esquemas_vacinais` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `vacinas` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `lotes_vacinas` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `aplicacoes_vacinais` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `historico_pacientes` | Aprovado para as colunas consultadas. |
| SELECT HEAD de `notificacoes`, filtrado pelo usuário da sessão | Aprovado. |
| SELECT HEAD de `contatos_busca_ativa` | Aprovado para as colunas consultadas. |

As consultas HEAD verificam resolução de colunas e admissibilidade da consulta sob as permissões da sessão, sem retornar linhas. Resultado sem erro, inclusive em tabela vazia, **não comprova** completude, acesso entre unidades, integridade do conteúdo ou funcionamento de gravações. Nenhuma contagem de registros foi exibida.

A disponibilidade da leitura de `contatos_busca_ativa` é uma constatação nova. Não demonstra que o SQL 011 foi executado integralmente, nem que suas funções/policies correspondem à proposta. **Não reaplicar 011 às cegas:** ele cria a tabela e deve ser confrontado com as definições/políticas remotas atuais antes de qualquer execução aprovada. Nenhuma migração foi executada pelo agente e nenhuma aprovação foi inferida desse resultado.

## O que não foi executado

- Nenhuma RPC, incluindo as três RPCs clínicas ou as RPCs de busca ativa.
- Nenhum INSERT, UPDATE, DELETE, cadastro, aplicação, contato ou mudança de conta.
- Nenhuma migração 006-r2, 012, 011 ou reversão.
- Nenhum WhatsApp, SMS, convite ou recuperação de senha.
- Nenhum uso de service_role ou chave administrativa. O cliente usado é comum, com chave pública e sessão da conta existente, sem persistência local ou renovação automática de tokens.

O login é uma autenticação real no serviço Auth, não uma simulação de claims. Esta etapa não abriu sessão autenticada no navegador nem validou cookies SSR/reload da interface.

## Pendências preservadas

Isolamento UBS A/UBS B, vínculo/acesso do paciente, autorização de escrita por papel/unidade, cadastro/persistência após escrita, aplicação/duplicidade, contatos/fila ponta a ponta, login/reload de telas autenticadas e homologação das migrações permanecem **pendentes**. Não foram marcados como aprovados por falta das contas ou pela aprovação das consultas administrativas.

## Ajuste do runner

- `homolog:check`: valida somente destino/tipo de chave e informa contas configuradas sem seus valores; não confunde disponibilidade local com autenticação aprovada.
- Novo `homolog:read:admin`: exige apenas credenciais ADMIN; autentica, verifica a identidade/papel e realiza leituras HEAD. Não exige fixtures de paciente ou contas UBS para esse escopo.
- `homolog:read` e `homolog:write` continuam exigindo as quatro contas e a fixture. As proteções de escrita e aprovação declarada das migrações não foram relaxadas.
- Falha de login, identidade inconsistente ou papel diferente de admin interrompe antes das consultas clínicas. Consulta recusada é registrada como falha. Códigos são exibidos de forma limitada, sem conteúdo de erro ou credenciais.
- `runAdminRead` foi isolado em helper sem chamadas a RPC/métodos de escrita. Testes locais verificam o escopo, a interrupção por falha e a manutenção das pendências.

Reexecutar, sem alterar dados clínicos:

```powershell
npm run homolog:check
npm run homolog:read:admin
```

## Arquivos e verificação local

Alterados: `tests/homologacao.mjs`, `package.json`, `.env.homolog.example`, README e nota no relatório do MVP. Novos: `tests/helpers/homolog-config.mjs`, `tests/helpers/admin-read.mjs`, `tests/admin-read.test.mjs` e este relatório. Nenhuma interface ou SQL foi modificado.

Ponto de restauração anterior às alterações: `C:\Users\PEDROO~1\AppData\Local\Temp\vacinacao-before-admin-read-20261112-130921.zip`, sem arquivos de ambiente reais.

Executados e aprovados: `npm run lint` sem avisos, `npm test` com 12 testes aprovados (5 novos do runner parcial), `npm run typecheck`, `git diff --check` e `git check-ignore .env.homolog.local`. O Node mantém o aviso de detecção de módulo TypeScript, sem falha. O build da aplicação não precisou ser repetido nesta etapa, pois apenas o runner, seus testes e a documentação foram alterados; o build aprovado do MVP permanece referente à etapa anterior.

Atualização após repetição da leitura e diagnóstico 014: login/identidade/admin e nove consultas clínicas HEAD passaram; contatos retornou 403/42501 e permanece pendente. O catálogo confirma tabela e funções presentes com ausência de SELECT/EXECUTE para authenticated. Isso não invalida o registro histórico dos dez HEAD acima, mas substitui seu uso como evidência do estado atual. Ver [plano revisado](PLANO-MIGRACOES-014.md). Esta validação administrativa parcial não autoriza alterações remotas nem comprova escrita/isolamento.
