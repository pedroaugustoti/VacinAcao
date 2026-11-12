# Gestão de equipe e ativação — entrega de 12/11/2026

**Código implementado; SQL 028, configuração privada, criação de contas, bloqueios e envios continuam sem execução pelo agente.** A leitura administrativa e os testes locais não homologam provisionamento Auth, envio de e-mail ou isolamento remoto com paciente/UBS B.

## O que mudou

- `/admin/equipe`: consulta, busca por nome/e-mail, filtros por unidade/estado e paginação de 50 profissionais após 028. Inclusão com função e papel fixo UBS; contas administrativas não podem ser criadas/promovidas por esse fluxo. Sem 028, consulta parcial de até 100 perfis, sem inventar e-mail ou estado Auth.
- `/admin/unidades`: listagem, cadastro e edição não destrutiva. Não oferece exclusão ou transferência de vínculos clínicos. Seletores/listagem de unidades limitados a 100 nesta entrega.
- Ficha: abas Visão geral, Vacinação, Histórico, Busca ativa e Acesso ao portal. Criação de conta é opcional e separada da transação clínica; cadastro/aplicação não dependem dela. O vínculo usa exclusivamente a RPC auditada do 025.
- Acesso ao portal: não ativado, pendente, ativo ou bloqueado a partir de vínculo, provisionamento, último login e bloqueios reais. Quando não há configuração suficiente, informa **não verificado**. Conta confirmada, sozinha, não significa acesso ativo nem mensagem entregue.
- Navegação: Administração recolhível e restrita ao administrador. Estoque em abas; dashboard mantém quatro métricas persistidas; pacientes com ações progressivas; PWA destaca próxima dose. Não houve mudança de prescrição, contratos clínicos, cálculo de saldo ou histórico.
- Recuperação: solicitação explícita por conta gerenciada, condicionada à configuração e autorização de e-mail. Callback `/auth/confirm` aceita somente recovery/invite e redireciona internamente para `/definir-senha`. Nenhuma mensagem foi enviada para testar esse fluxo.

## Segurança e estados parciais

Toda Server Action confere `getUser`, perfil admin no banco e acesso habilitado. O cliente não escolhe role, não recebe chave privada e não grava perfis. A chave Auth Admin fica em módulo `server-only`; as RPCs administrativas repetem a autorização no PostgreSQL. Não há alteração de papel/unidade de profissionais existentes nesta entrega; somente inclusão e bloqueio/liberação. Nem o próprio admin nem outro admin podem ser bloqueados por essas ações.

Provisionamento reserva uma operação persistente, cria **somente conta nova**, com senha aleatória não exibida e em quarentena, e depois finaliza perfil UBS ou vínculo do paciente. A criação usa `createUser`, não convite/signup. A documentação do [Auth Admin](https://supabase.com/docs/reference/javascript/auth-admin-createuser) distingue esse método do envio de convite; hooks e notificações específicos do projeto ainda exigem revisão.

Falhas não apagam usuários. A mesma operação, pelo mesmo administrador, com mesmo e-mail e dados, pode ser retomada. `app_metadata.va_operation_id` identifica somente a conta criada por aquela operação. E-mail já existente fora da operação não é adotado nem tem senha redefinida silenciosamente. Conflito de dados exige revisão manual, sem criar outra identidade. As últimas 100 operações são consultadas pela interface.

Conta incompleta permanece em quarentena. Se o banco concluiu e a liberação Auth falhou, usar **Liberar acesso** após conferência; repetir um provisionamento já concluído não remove bloqueio intencional. Operações pendentes não podem ser liberadas pelo atalho. Bloquear combina política restritiva no banco, guarda nas RPCs e ban no Auth; histórico e unidade permanecem. Falha parcial retorna orientação, sem afirmar conclusão de ambos os provedores.

## Banco: aplicar apenas o necessário e aprovado

| Ordem | Objeto/arquivo | Situação e impacto |
| --- | --- | --- |
| 1 | Backup de dados + metadados atuais | Confirmar backup recuperável de dados pelo responsável. JSON de metadados não substitui esse backup. |
| 2 | 030, somente leitura | Captura definições/ACLs, owners, políticas, RLS, ACL por coluna e herança; salvar fora do Git em `backups/antes-028.json`. Não consulta contas, operações ou dados clínicos. |
| 3 | 006-r2, 011/015, 012, 019, 025 | Objetos compatíveis nos snapshots finais 018/024 recebidos. **Não reaplicar.** Os snapshots não provam ausência de mudanças posteriores. |
| 4 | **028, proposta nova** | Somente após aprovação explícita e comparação do backup atual. Adiciona função profissional, operação recuperável, bloqueios/auditoria e RPCs administrativas. Não cria contas nem envia mensagens. |
| 5 | Verificações abaixo + 030 novamente | Guardar `backups/depois-028.json` e hash. Só depois habilitar configuração privada no servidor. |
| 6 | Contas e ensaios DEMO | Exigem autorização operacional separada. E-mails exigem autorização adicional. |

028 roda em uma transação, com timeout de lock, e falha diante de objetos conflitantes. **Não é um script para reaplicar.** Espera dez RPCs PL/pgSQL existentes, guarda suas definições em `va_gestao_definicoes` e acrescenta somente a checagem de acesso no início. Preserva assinaturas, ACLs, triggers, índices, policies existentes e regras clínicas. Adiciona policy restritiva em 12 tabelas, sem substituir as policies de isolamento por unidade.

Os fingerprints de dez funções mudam intencionalmente depois do 028. O comparador histórico 018/019/025 passa a apontar esses corpos como diferentes: **não usar essa diferença para reaplicar SQL antigo**. Comparar a adição da guarda com as definições arquivadas e manter os dois snapshots.

### Checklist antes de executar 028

- [ ] Confirmar projeto de desenvolvimento, aprovação do responsável e ausência de mudança concorrente.
- [ ] Guardar backup de dados e JSON 030 atual; conferir que `.env*` reais e `backups/` estão ignorados. Usar `Get-FileHash backups/antes-028.json -Algorithm SHA256`, sem imprimir seu conteúdo.
- [ ] Conferir ausência de `perfis.funcao`, objetos `va_gestao_*`, `va_acessos_bloqueados` e policy `va_acesso_habilitado_restritivo`. Se presentes, comparar; não reaplicar.
- [ ] Confirmar dez assinaturas esperadas no bloco de guarda do 028 e ausência de overload inesperado. Rever diffs se o backup atual divergir dos snapshots recebidos.
- [ ] Confirmar RLS/grants anteriores, ausência de escrita direta em paciente/vínculo e ausência de policies de escrita de perfis para usuários comuns.
- [ ] Revisar triggers de `auth.users`, Auth Hooks e notificações no Dashboard. Não permitir criação automática de perfil profissional para paciente. O 024 anterior não encontrou triggers de banco, mas não inspeciona hooks externos.
- [ ] Manter flags de escrita/provisionamento/e-mail desativadas durante a aplicação. Executar o SQL inteiro no SQL Editor pelo responsável autorizado.

### Verificação pós-migração pelo responsável

Executar somente consultas, sem criar contas:

```sql
select count(*) as corpos_anteriores from public.va_gestao_definicoes; -- esperado: 10
select tablename, policyname, permissive from pg_policies
where schemaname='public' and policyname='va_acesso_habilitado_restritivo'; -- 12, RESTRICTIVE
select has_function_privilege('anon',
 'public.va_gestao_finalizar_equipe(uuid,uuid)','EXECUTE') as anon_finaliza,
 has_table_privilege('authenticated','public.va_gestao_operacoes','INSERT') as usuario_insere;
-- ambos false; conferir também privilégios por coluna e papéis herdados no backup
select tgname, tgenabled from pg_trigger
where tgrelid='public.aplicacoes_vacinais'::regclass and not tgisinternal;
-- triggers clínicos e de estoque continuam habilitados
```

Reexecutar 017/023 somente leitura e comparar com o baseline; os fingerprints clínicos diferem pela guarda documentada. Testar, com sessões autorizadas separadas, que UBS/paciente recebem 42501 nas novas RPCs administrativas, que paciente continua sem linha em perfis e que as queries clínicas de outra unidade não retornam dados. Não inferir esse isolamento de um HEAD administrativo.

## Configuração de servidor, sem expor segredos

Usar somente arquivo local ignorado ou variáveis privadas do servidor. `.env.example` contém nomes e padrões desativados. **Não preencher chave privada em `.env.homolog.local`, runner de homologação, variável NEXT_PUBLIC ou frontend.** Não imprimir arquivos de ambiente nem respostas Auth brutas.

1. Após aprovação, configurar `SUPABASE_SECRET_KEY` apenas no servidor Next. É a credencial administrativa privada; chave pública continua sendo usada pelo navegador e pelas RPCs com sessão do administrador.
2. Após aplicar/verificar 028 e autorizar operações, configurar `VACINACAO_GESTAO_ESCRITA=autorizada`.
3. Após revisar hooks/triggers/notificações, configurar `VACINACAO_PROVISIONAMENTO_REVISADO=sim` para permitir criação. Reiniciar o servidor. Não habilitamos essas variáveis no ambiente real.
4. Manter `VACINACAO_EMAIL_AUTORIZADO=nao` e `VACINACAO_EMAIL_TEMPLATE_CONFIRMADO=nao` até aprovação de envio e validação do canal.

**Dependência de ativação:** a conta criada pelo aplicativo tem senha aleatória desconhecida. Para entrar, o titular precisa concluir recuperação autorizada ou procedimento assistido no ambiente administrativo confiável. A interface não fornece senha provisória, link secreto nem redefinição indiscriminada de senha. Sem canal/procedimento configurado, a conta permanece pendente; não anunciar ativação concluída.

### Canal de recuperação, somente quando autorizado

Conferir SMTP, remetente, notificações, Site URL e URLs permitidas; configurar `VACINACAO_ORIGIN` como origem HTTPS controlada, sem caminho. No template **Recovery**, usar o callback de token hash:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">Definir minha senha</a>
```

Conferir Site URL do projeto apontando para o aplicativo. Esse fluxo não depende de um cookie PKCE do navegador do administrador. Não habilitar envio com o template padrão de fragmento/código sem testar sua compatibilidade. Referência: [templates Auth e verificação de token](https://supabase.com/docs/guides/auth/auth-email-templates).

Depois de aprovação, configurar as duas flags de e-mail como `sim`, reiniciar e solicitar recuperação **uma vez**, com confirmação, para o destinatário autorizado. A solicitação aceita não comprova entrega. O titular abre o link em seu próprio navegador, define senha pessoal e entra novamente. Contas bloqueadas não são liberadas por recuperação; aliases de CPF e endereços `.invalid` não recebem envio por esta ação. Convite Auth não é disparado pelo aplicativo; o callback admite convite apenas para futura configuração aprovada.

## Roteiro de demonstração

### Enfermeira DEMO pelo aplicativo

1. Obter autorização específica para nova conta fictícia. Confirmar 028/configuração e o procedimento de definição de senha antes de provisionar.
2. Admin → Administração → Unidades: selecionar unidade DEMO existente ou cadastrar uma nova, sem editar unidade de outro fluxo.
3. Equipe → Incluir: nome **DEMO Enfermeira**, e-mail individual inédito, função Enfermeira, unidade correta e confirmação institucional. Role é UBS e não tem seletor de admin. Conferir operação concluída e status pendente antes do primeiro login.
4. Definir acesso pelo canal autorizado acima. Para apresentação sem envio, usar o procedimento manual de conta nova abaixo; não apertar recuperação nem distribuir senha comum.
5. Entrar em sessão separada em `/login-ubs`. Verificar unidade, ausência de administração de equipe/unidades e impedimento de dados de UBS B. Desativar somente quando autorizado e comprovar bloqueio de leitura e de RPC com sessão já aberta; liberar depois, sem mudar papel/unidade.

### Alternativa DEMO sem envio, por operador do Supabase

Usar **uma conta nova**, separada da criada pelo aplicativo. No Dashboard → Authentication → Users, escolher criação administrativa **Create user**, com senha definida privadamente e confirmação administrativa de e-mail; não escolher convite, recuperação ou signup. Conferir previamente que a modalidade não envia mensagens. Se a versão do painel não oferecer essa modalidade, interromper e configurar o canal autorizado; não improvisar edição de `auth.users`, senha via SQL, ou script com chave privada no runner.

Para enfermeira criada manualmente, o responsável autorizado insere o perfil profissional após conferir UUID novo, unidade DEMO, inexistência de perfil e de vínculo paciente. O bloco abaixo é **procedimento de escrita para revisão**, não foi executado. Substituir UUIDs e só trocar ROLLBACK por COMMIT mediante aprovação:

```sql
begin;
do $$
declare novo uuid := '00000000-0000-0000-0000-000000000000';
        unidade_demo uuid := '00000000-0000-0000-0000-000000000000';
        admin_responsavel uuid := '00000000-0000-0000-0000-000000000000';
begin
 if not exists(select 1 from public.perfis where id=admin_responsavel and role='admin')
    or not exists(select 1 from auth.users where id=novo and email_confirmed_at is not null
                  and lower(email) like 'demo-%@vacinacao.invalid')
    or not exists(select 1 from public.unidades_saude where id=unidade_demo)
    or exists(select 1 from public.perfis where id=novo)
    or exists(select 1 from public.pacientes where user_id=novo) then
   raise exception 'Conta nova DEMO, responsável ou unidade não conferidos';
 end if;
 insert into public.perfis(id,nome,role,unidade_id,funcao)
 values(novo,'DEMO Enfermeira','ubs',unidade_demo,'Enfermeira');
 insert into public.va_gestao_eventos(autor_id,usuario_id,acao)
 values(admin_responsavel,novo,'PROFISSIONAL_DEMO_MANUAL');
end $$;
rollback;
```

Esse procedimento exige 028 para função/auditoria; não altera contas existentes e não é retomada do provisionamento pela interface. O caminho do aplicativo usa a RPC administrativa; esta alternativa é manutenção manual autorizada do proprietário. Não usar e-mail real no exemplo e não incluir senha em SQL, logs ou relatório.

### Paciente DEMO

1. Selecionar ficha exclusivamente sintética, sem vínculo, com cronograma profissional. Cadastro e primeira aplicação oferecem orientação opcional para abrir a aba de acesso; não ativam nada automaticamente.
2. **Via aplicativo:** admin → ficha → Acesso ao portal → conferir identidade/titularidade além do CPF → e-mail inédito → criar e vincular. A conta permanece sem perfil profissional; recuperar senha somente pelo canal autorizado.
3. **Sem envio:** criar uma nova conta DEMO pelo procedimento administrativo anterior, com senha privativa. Não inserir linha em `perfis`. Na ficha → Acesso ao portal → Já existe conta conferida? → UUID + e-mail exatos + justificativa + confirmação; usa o 025 existente. Não inserir `user_id` diretamente nem substituir vínculo.
4. Em navegador separado, entrar em `/login` com e-mail e senha individual. CPF é apenas alias se provisionado explicitamente; nunca senha. Conferir início, próxima dose, `/doses`, `/perfil` e aplicações documentadas.
5. Admin/UBS registra aplicação DEMO com lote e saldo disponíveis; recarregar ficha e PWA. Conferir uma aplicação, uma baixa de estoque, histórico, status e próxima pendência; repetir dose deve ser rejeitado sem segunda baixa. Preservar datas prescritas.
6. Testar query direta à API, com chave pública e sessão do próprio paciente, para UUID de outra ficha/dose: nenhum dado acessível. Testar também impedimento de estoque, notas internas, vínculo e operações administrativas. Nunca usar chave administrativa nesses testes.
7. Busca ativa: confirmar dose mais antiga em atraso, registrar contato simulado e recarregar histórico. WhatsApp é manual; abrir link não comprova contato nem envio. Não enviar mensagens da demonstração.

## Contenção e reversão

- **Antes de COMMIT do 028:** falha/ROLLBACK reverte toda a migração. Não remover validações para forçar aplicação.
- **Depois:** desabilitar flags de escrita/e-mail/provisionamento no servidor e reiniciar. Com aprovação, 029 revoga execução das RPCs administrativas mutáveis e verifica privilégio herdado residual. Preserva dados, bloqueios, guards e auditoria. 030 foi exercitado localmente como backup executável; 029 como contenção, não como desinstalação.
- Voltar o código pelo ponto de restauração, preservando os `.env` atuais, não desfaz contas ou unidade já criadas. O ZIP anterior está em `%TEMP%/vacinacao-before-management-20261112-161936.zip`, sem ambientes reais.
- Não restaurar RPCs antigas enquanto existirem contas bloqueadas: isso retiraria a proteção das funções SECURITY DEFINER. As dez definições originais estão arquivadas com acesso do proprietário; remoção integral requer revisão de contas pendentes/bloqueios e aprovação específica. Não apagar tabelas ou perfis para “reverter”.
- Efeitos Auth e banco não formam uma única transação. Conferir operações pendentes e quarentena antes de qualquer recuperação manual. Backup de metadados não recupera contas ou dados apagados.

## Evidências e limites

| Verificação | Resultado nesta entrega |
| --- | --- |
| Lint / TypeScript / build | Aprovados; build com 22 páginas/rotas |
| Unitários | 24 aprovados |
| SQL gestão 028 + backup 030 + contenção 029 | 9 cenários aprovados em PostgreSQL embarcado 18.6; não é validação do serviço Supabase/PG17 |
| SQL clínico / estoque / vínculo / busca ativa | 16 / 10 / 8 / 16 cenários locais aprovados |
| Fluxo SQL combinado | Aprovado localmente: cadastro, vínculo, aplicação/baixa, atraso/contato e leitura do paciente |
| Navegador público | 12 verificações aprovadas em desktop/mobile: páginas, teclado, callback inválido e bloqueio anônimo |
| Smoke HTTP | 8 verificações aprovadas |
| Navegador administrativo | 8 telas em desktop e celular, abas da ficha/estoque e menu por teclado aprovados com admin existente; somente leitura, sem erros JS |
| Bundle do navegador | 27 artefatos verificados, zero identificadores privados/segredo conhecido encontrados; não é auditoria universal |
| Auth Admin real, criação, bloqueio e redefinição | **Pendentes: não executados** |
| Envio e callback com token válido | **Pendentes: canal não homologado, nenhum envio realizado** |
| Login paciente/UBS A/B e isolamento remoto | **Pendentes: contas/fixtures e autorização de escrita necessárias** |
| Persistência remota após escrita, consumo concorrente e PWA autenticado | **Pendentes; não inferir aprovação do build/navegação admin** |

Artefatos locais de navegador: `backups/preview-visual/relatorio.json` e imagens em `backups/preview*`, ignorados pelo Git. Screenshots podem conter nomes do banco de desenvolvimento; não publicar. Nenhum dump de sessão/senha foi gravado pelo teste.

## Arquivos e reprodução

| Área | Arquivos principais |
| --- | --- |
| Servidor e validação | `src/lib/management-server.ts`, `management-policy.ts`, `src/app/(ubs)/admin/gestao-actions.ts` |
| Equipe/unidades | `src/app/(ubs)/admin/{equipe,unidades}/page.tsx`, `src/components/management/ManagementPage.tsx` |
| Acesso | `src/components/pwa/PortalAccess.tsx`, `src/app/auth/confirm/route.ts`, `src/app/definir-senha/page.tsx`, `src/app/registro/page.tsx` |
| UX | `src/components/ui/WorkspaceTabs.tsx`, sidebar/layout UBS, dashboard, pacientes, ficha, cadastro, aplicação, estoque, PWA início/perfil/doses/login |
| Banco proposto | `sql/028_gestao_usuarios_incremental.sql`, `029_contencao_gestao_sem_excluir.sql`, `030_backup_gestao_somente_leitura.sql` |
| Checks | `tests/management-policy.test.mjs`, `management-sql.mjs`, `browser-publico.mjs`, `browser-visual-admin.mjs`, ajustes de seletores no E2E opt-in, `scripts/verificar-bundle-gestao.mjs` |
| Configuração/documentação | `.env.example`, `package.json`, README e checklist final |

```powershell
npm run lint
npm test
npm run test:gestao:sql
npm run test:sql
npm run test:estoque:sql
npm run test:paciente:sql
npm run test:busca-ativa:sql
npm run test:final:sql
npm run build
npm run typecheck
node scripts/verificar-bundle-gestao.mjs
```

Build e typecheck devem ser sequenciais. Aviso Node sobre módulo TypeScript sem `type: module` permanece sem falha. Não alteramos a configuração de módulos para eliminar um aviso durante esta entrega.

Em outro terminal, iniciar `npm run start -- --hostname 127.0.0.1 --port 3100`. Com esse servidor:

```powershell
npm run test:browser:publico
npm run test:smoke
node --env-file-if-exists=.env.homolog.local tests/browser-visual-admin.mjs
```

Os testes de navegador usam Playwright instalado temporariamente em `%TEMP%/vacinacao-ui-review-tools`, fora do package.json. Se ausente em outra máquina, preparar Playwright/Chromium antes de repetir. `.env.homolog.local` contém somente chave pública e contas existentes para testes, nunca chave administrativa. Porta alternativa aceita `SMOKE_BASE_URL`; o ensaio final desta entrega usou `http://127.0.0.1:3101`.

**Próxima decisão do responsável:** revisar/aprovar 028 e configurar servidor; depois autorizar as contas DEMO e testar escrita/ativação. Autorizar SQL não autoriza mensagens automaticamente.
