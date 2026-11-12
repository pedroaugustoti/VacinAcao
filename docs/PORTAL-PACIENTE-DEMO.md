# Portal do paciente — ativação DEMO e testes, 12/11/2026

## Auditoria do que já existia

`/login` usa Supabase Auth `signInWithPassword`: e-mail ou CPF transformado no alias `11digitos@paciente.vacinacao.app`, com senha fornecida separadamente. Não usa CPF/nascimento como senha nem busca cadastro pelo CPF. Esse alias só funciona se tiver sido provisionado exatamente dessa forma; não é descoberta automática de conta ou caixa postal. O normalizador agora rejeita identificadores malformados em vez de extrair dígitos de qualquer texto.

`/`, `/doses` e `/perfil` já autenticavam no servidor e buscavam `pacientes.user_id=auth.uid()`. A ausência de vínculo gera orientação, não cadastro automático. `perfis` é reservado à equipe, com papéis admin/ubs; não criamos `role=paciente`. A ação legada `vincularCpf` permanece desativada. O login profissional e o proxy existentes foram preservados.

O diagnóstico 024 foi recebido e revisado, capturado em 12/11 às 14:39:55 São Paulo. SHA-256 `a43e2e0878c344056f8dea837582f8a4f3e303855df148442be89f005ab2daaf`, arquivo ignorado pelo Git. Confirma RLS ativo, zero vínculos profissionais, zero contas com múltiplos cadastros e nenhum trigger de banco em auth.users. O default ubs é aplicado a uma linha inserida em perfis, não cria a linha automaticamente. Auth Hooks externos ao banco e configurações de envio ainda precisam ser conferidos no Dashboard. A exportação recebida antecede os campos adicionais de privilégios efetivos/papéis da versão final do 024; esses campos não foram declarados como verificados nesse arquivo. O guard do 025 confere SUPERUSER/BYPASSRLS, atualização direta de user_id e ausência de políticas de escrita de perfis; divergência aborta para revisão.

As políticas confirmadas restringem o cadastro ao user_id, doses/aplicações ao paciente vinculado e notas internas à equipe. Isso é evidência de catálogo, não prova de execução com uma conta de paciente real. Foi identificada ausência de leitura da unidade pelo paciente: o 025 propõe policy SELECT apenas para a unidade do próprio vínculo, preservando as policies anteriores.

## O que foi completado

- Orientações simples de primeiro acesso, vínculo ausente e recuperação assistida em `/registro`, também acessíveis do login. Nenhum botão dispara mensagem.
- Página inicial com instruções de retorno conforme a pendência já persistida, sem remarcação ou prescrição automática.
- Calendário apresentado como linha do tempo e histórico separado das até 50 aplicações documentadas. Registros antigos do esquema não são apresentados como documentos confirmados por inferência.
- Formulário administrativo na ficha para vincular conta existente por UUID + e-mail exato, confirmação institucional e justificativa. Não cria conta, senha ou perfil; somente admin pode executar a RPC, verificada novamente no servidor.
- Proposta 025: transação auditada, conta Auth confirmada, sem linha em perfis, sem substituição de outro vínculo; índice único parcial limita este MVP a uma conta por cadastro e um cadastro por conta. Inclui leitura da própria unidade por RLS. Se houver múltiplos cadastros legítimos por usuário, interromper e revisar o modelo antes de aprovar esse índice. Não há consolidação ou exclusão automática.

## Convite e recuperação no Supabase

Supabase Auth oferece convite administrativo e recuperação por e-mail. Convite exige ambiente confiável/Dashboard; não se coloca chave administrativa no navegador. Referências oficiais: [convites e usuários](https://supabase.com/docs/guides/auth/users), [senha e recuperação](https://supabase.com/docs/guides/auth/passwords).

Esses recursos não provam que SMTP, remetente, templates, Auth Hooks e URLs de redirecionamento deste projeto estejam configurados. **Não foram verificados nem foi enviado e-mail.** O app atual não tem callback completo de convite/recovery; não distribuir esses links para o app como se o fluxo estivesse homologado. Para hoje, o caminho demonstrável é provisionamento manual autorizado, com confirmação administrativa e senha definida privadamente. Alias CPF/reserved `.invalid` não recebe e-mail: recuperar por atendimento institucional após conferência de identidade. Não usar CPF/nascimento como segredo nem senha compartilhada por todas as contas.

## Passo a passo para ativar uma nova conta DEMO

1. **Antes de criar conta:** executar somente leitura `024_diagnostico_acesso_paciente_somente_leitura.sql` e salvar JSON em `backups/diagnostico-024.json`. Revisar os corpos dos triggers de auth.users. Se algum criar automaticamente perfil admin/ubs (inclusive default ubs), **parar**; preparar correção específica para aprovação, sem promover/rebaixar contas existentes. Conferir também Auth Hooks/notificações no Dashboard, que o SQL não inspeciona. Não copiar tokens ou campos de senha.
2. Confirmar destino de desenvolvimento, preservar snapshots 008/018/024 e backup de dados; obter aprovação explícita para **criar uma nova conta DEMO** e **aplicar 025**. Uma autorização não implica a outra. Nenhuma dessas ações foi executada pelo agente.
3. Com 024 revisado e criação autorizada, operador usa Authentication → Users → criação administrativa de novo usuário, não “Send invitation” nem recuperação. Identificador sugerido: `demo-paciente-20261112@vacinacao.invalid`, somente se ainda não existir. Se existir, escolher identificador novo, sem alterar conta anterior. Definir senha forte em ambiente privado e confirmação administrativa do e-mail, sem envio. Não pôr senha neste documento, no código ou nos logs.
4. Conferir imediatamente que a nova conta **não possui linha em public.perfis** e não recebeu papéis profissionais. Não preencher role com o default ubs. O paciente é identificado pelo vínculo em pacientes, não por perfil profissional. Registrar o UUID da nova conta apenas no ambiente local ignorado.
5. Criar ou selecionar ficha exclusivamente fictícia, sem user_id, com prefixo `DEMO`, cronograma conferido e sem alterar fichas preexistentes de outras pessoas. Cadastro clínico continua distinto da criação de Auth. Se precisar testar aplicação, preparar estoque DEMO conforme o plano do 019, mediante aprovação separada. Não mudar prescrição para fabricar resultado.
6. Aplicar manualmente o **025 aprovado**, inteiro, como proprietário. Ele não cria/edita usuários Auth; adiciona policy de leitura da própria unidade sem substituir as policies atuais. Se detectar múltiplos vínculos, ROLLBACK e revisão, sem limpar dados para forçar execução. A aplicação desse SQL depende da revisão do 024, não apenas dos testes locais.
7. Como admin no VacinAção, abrir a ficha DEMO → “Ativar acesso individual do paciente”. Conferir UUID da conta no Dashboard e e-mail exato; cumprir o procedimento institucional de identidade (não CPF isolado), justificar e confirmar. Alternativa para operador: adaptar o roteiro **026**, que está comentado e termina em ROLLBACK; só trocar para COMMIT após aprovação e revisão. O servidor rejeita perfil profissional, conta não confirmada, e-mail divergente e vínculos já ocupados.
8. Reconsultar pacientes.user_id e histórico `VINCULO_CONTA_PACIENTE`. O formulário também reconsulta o vínculo antes de anunciar sucesso. Repetir a mesma vinculação não duplica auditoria; substituição não é suportada. Nenhuma credencial é salva no histórico.
9. Em sessão separada, entrar em `/login` com o e-mail DEMO e senha definida. Testar CPF apenas se essa conta tiver sido criada originalmente com o alias exato e exclusivamente sintético; uma conta com e-mail normal não ganha alias automaticamente.

## Teste do portal e chamadas diretas à API

Preencher localmente, sem enviar senhas pelo chat, as variáveis já documentadas: `HOMOLOG_PACIENTE_EMAIL`, `HOMOLOG_PACIENTE_PASSWORD`, `HOMOLOG_PACIENTE_ID` e `HOMOLOG_OUTRO_PACIENTE_ID`. O último é outra ficha sintética que não pertence à conta; nunca usar a mesma fixture para afirmar isolamento.

```powershell
npm run homolog:read:paciente
```

Runner usa apenas chave pública e conta existente. Confere login/identidade, ausência de perfil profissional, vínculo próprio, consulta direta de pacientes e doses sem filtro de usuário, rejeição/vazio para outra fixture e notas internas. Erro de schema não vale como isolamento aprovado. Não cria conta, muda senha, envia mensagem ou executa RPC. Configuração incompleta produz **pendente, zero aprovados**.

Na UI, testar em sessão limpa: início/próxima dose → calendário/linha do tempo → histórico documentado → perfil/unidade → recarga completa. Conferir datas e quantidades com registros persistidos. Pendência documental precisa continuar distinta de aplicação confirmada. Não abrir links de contato para envio real. Testar logout e acesso sem sessão, que deve pedir login. Conta sem vínculo deve receber orientação. Testar senha errada sem indicar se uma conta existe.

Em outra sessão autenticada, UBS B/paciente não podem executar a RPC de vínculo, alterar pacientes.user_id ou inserir perfil profissional diretamente. Rodar o ensaio completo com contas próprias quando disponíveis; o runner de leitura não tenta escrita para provar essas rejeições. Uma inspeção administrativa não homologa login de paciente, e ocultar botões não substitui RLS.

## Contenção/rollback

Falha antes do COMMIT do 025: ROLLBACK. Depois de aplicado, não apagar a conta nem desvincular automaticamente: revogar EXECUTE da nova RPC para PUBLIC/anon/authenticated, após aprovação, e preservar índice/vínculo/auditoria para análise. O login/leitura do vínculo existente não é suspenso por essa revogação. Se houver vínculo incorreto, conter a conta pelo procedimento administrativo autorizado e preparar correção auditada específica com revisão de todos os acessos; revogar uma RPC não revoga sessões existentes. Não desfazer todo o Supabase ou restaurar versões inseguras de RPCs.

## Evidências e pendências

- **Local:** oito cenários SQL de autorização/vínculo/RLS passaram, inclusive repetição sem auditoria duplicada, conflito, conta não confirmada, profissional rejeitado, alteração direta/autoelevação bloqueada, acesso somente à própria ficha/doses e rollback da vinculação por falha de auditoria. Schema reduzido PostgreSQL 18.6; não equivale ao Supabase 17.11.
- **Unitários:** 21 testes passaram, incluindo e-mail/alias e recusa de identificadores malformados.
- **Remoto paciente:** runner executado apenas no preflight; faltam configuração/conta/fixtures. Resultado **pendente**, nenhum login, zero aprovações. 024 recebido e revisado nos campos exportados; nenhuma conta criada e 025 não aplicado. Envio de e-mails/SMS/WhatsApp não realizado.
- **Build, lint e TypeScript:** aprovados; build com 18 páginas/rotas. O teste de vínculo também confere leitura da própria unidade e bloqueio da outra. As consultas diretas de isolamento do paciente real permanecem pendentes.
- **Navegador público e HTTP:** oito verificações de layout/teclado/proteção anônima e oito verificações HTTP aprovadas; nenhum formulário enviado. A aparência e o login de paciente autenticado não foram declarados aprovados. Ponto de revisão local em `%TEMP%/vacinacao-patient-review-20261112-144315.zip`, sem credenciais.
- **Recuperação por e-mail/callback/SMTP:** recurso do provedor identificado, não implementado ou homologado como fluxo automático neste app. A interface usa orientação assistida para a entrega.

Arquivos: novos SQLs 024/025/026, `src/lib/patient-login.ts`, `src/components/pwa/VincularContaPaciente.tsx`, testes `patient-login.test.mjs`, `paciente-vinculo-sql.mjs` e `paciente-read.mjs`; ajustes no login, orientações, início/calendário do paciente, ficha administrativa, package.json e modelo de ambiente. Credenciais reais, políticas e contas existentes não foram alteradas.
