# VacinAção — checklist operacional final, 12/11/2026 às 19h (São Paulo)

**Não há homologação remota de escrita concluída. Nenhuma migração, conta, mensagem ou exclusão foi executada pelo agente nesta revisão.** Este é o roteiro do responsável; não executar comandos de escrita apenas porque o arquivo existe.

**Atualização definitiva dos snapshots recebidos em 12/11 às 15:53 (São Paulo): 019 e 025 já têm seus objetos presentes e compatíveis. Não reaplicar nenhuma das duas migrações.** A sequência atual é backup de dados confirmado → verificações 017/023 → contas DEMO autorizadas → vínculo/estoque pela interface → ensaio de escrita e persistência. Presença de objetos não é homologação de escrita nem comprova histórico de execução de um arquivo específico.

## 1. Congelar e conferir o estado

- [ ] Confirmar projeto exclusivamente de desenvolvimento e parar mudanças concorrentes, inclusive outros ensaios no lote DEMO.
- [ ] Guardar snapshots atuais de metadados: 008, 018 e 024, em arquivos novos e ignorados, sem sobrescrever os anteriores. Para a comparação final: `backups/final-018.json` e `backups/final-024.json`.
- [ ] Preservar também um backup dos dados pelo procedimento administrativo do projeto, separado do Git. Metadados não recuperam dados apagados. Não copiar credenciais ou conteúdo de auth.users para relatórios.
- [ ] Conferir `git check-ignore backups/final-018.json backups/final-024.json .env.homolog.local` e guardar SHA-256 com `Get-FileHash`.
- [ ] Comparar sem conexão remota: `node scripts/revisao-final-snapshot.mjs`. Saída em `backups/revisao-final.json`. Divergência de corpo/objeto exige revisão; não forçar CREATE nem apagar objetos.

**Comparação final concluída:** `final-018.json` (225.019 bytes; captura 15:53:34) e `final-024.json` (15.952 bytes; captura 15:53:47), íntegros e ignorados pelo Git. SHA-256, respectivamente: `e777e2a2115ab51148a3e638e2262fcc0acd1843876b182b32749f3f5b34e859` e `9f31c4e128bf4cfc3c31c53fae87d6f30668d8f5a8f139c1df4f3d93d7908089`. Resultado em `backups/revisao-final.json`: dez corpos de funções compatíveis (três clínicas, seis de estoque e vínculo), duas tabelas de estoque com tipos/defaults/nulabilidade compatíveis, 15 constraints, cinco índices, três triggers de estoque habilitados, duas policies esperadas e nenhuma policy adicional de estoque. Índice único de vínculo e policy da própria unidade também compatíveis. ACLs das RPCs permitem authenticated, sem EXECUTE anônimo/PUBLIC nos objetos revisados.

Nenhum trigger de banco em auth.users, zero vínculos profissionais, zero contas com múltiplos cadastros; anon/authenticated sem SUPERUSER/BYPASSRLS. INSERT/UPDATE/DELETE efetivos de pacientes e esquemas são falsos. Perfis mantém grants de escrita, porém não há policy RLS de escrita; não confundir grant com autorização para inserir/alterar perfis. O teste autenticado com paciente continua necessário. Auth Hooks/notificações externos ao banco devem ser conferidos no Dashboard.

## 2. Ordem exata, sem reaplicação indiscriminada

| Ordem | Ação manual | Condição de avanço |
| --- | --- | --- |
| 1 | Preservar snapshots finais recebidos e confirmar backup de dados | Metadados guardados com data/hash; backup de dados continua confirmação do operador |
| 2 | SQL 017 somente leitura | Corpos comparados; verificar privilégios efetivos; qualquer false interrompe |
| 3 | **Pular 019** | Objetos presentes e compatíveis no snapshot final; não executar CREATE novamente |
| 4 | SQL 023 somente leitura | Saldo/ledger sem divergências; RLS/EXECUTE corretos e três triggers de aplicação habilitados |
| 5 | **Pular 025** | Função/índice/policy presentes e compatíveis; não reaplicar |
| 6 | Criar nova conta DEMO **somente com aprovação explícita separada** | Sem envio, sem perfil profissional e sem alteração de conta existente |
| 7 | Criar/selecionar ficha DEMO, conferir cronograma e vincular pela interface admin | UUID/e-mail exatos; conta confirmada; justificativa institucional; reconsulta/auditoria corretas |
| 8 | Preparar vacina/lote e entrada DEMO pela interface | Saldo suficiente; lote vigente; unidade correta; evidências guardadas |
| 9 | Homologar escrita/persistência e busca ativa | Roteiro abaixo, registrando cada evidência e pendência |

Não reaplicar 006, 011, 012 ou 015 quando seus objetos já estiverem compatíveis. 019 e 025 não são migrações repetíveis; ambas usam CREATE para falhar diante de conflito. 020 e 026 são roteiros comentados com ROLLBACK, não seeds automáticos. SQLs devem ser executados inteiros pelo proprietário no SQL Editor, sem service_role no navegador/runner.

## 3. Compatibilidade confirmada localmente

`npm run test:final:sql` instala as revisões juntas em PostgreSQL local e executa: catálogo/entrada → cadastro/cronograma → vínculo → aplicação/baixa → atraso/contato → leitura do paciente atualizada. Preserva datas prescritas e isola estoque/notas internas do paciente.

019 não substitui o corpo/assinatura da RPC de aplicação: adiciona baixa AFTER INSERT na mesma transação. Cada aplicação consome **uma unidade DEMO**, independente de mL. Sem saldo, toda aplicação/status/auditoria reverte. O índice parcial impede duplicidade; as proteções anteriores continuam. 025 altera apenas vínculo auditado e leitura da própria unidade, sem mudar profissional_id da aplicação ou unidade clínica. Portanto conta paciente não vira aplicador/profissional. Conta de paciente continua sem linha em perfis.

**Limites:** estoque não controla frasco multidose; não recebe carga ou baixa retroativa automática; cancelamento não devolve saldo sozinho. Unique user_id limita este MVP a uma conta por ficha; outro modelo de episódios exige revisão. Concorrência real permanece pendente.

## 4. Conta DEMO mínima, sem e-mail

1. Após aprovação e revisão dos triggers/Auth Hooks/notificações, abrir Authentication → Users → **criação administrativa**, sem “Send invitation”, signup ou recuperação. Usar novo e-mail reservado, por exemplo `demo-paciente-20261112@vacinacao.invalid`, se ainda não existir; se existir, escolher outro. Não alterar conta existente.
2. Definir senha forte privadamente e confirmação administrativa do e-mail, conferindo que a ação não enviará mensagens. Se o painel/procedimento disponível não permitir isso, parar e ajustar o procedimento com o responsável. Não compartilhar senha no chat/relatório nem usar CPF/nascimento como senha.
3. Confirmar que o UUID criado não possui linha em `public.perfis`. Não inserir role paciente, admin, ubs ou default ubs. Se um hook criar perfil, interromper antes de vincular.
4. Selecionar ficha sintética sem vínculo, preferencialmente `DEMO HOMOLOG ...`, com telefone não roteável, CPF de teste e cronograma validado. Não reutilizar ficha de outra conta.
5. Após 025 aprovado/aplicado, admin abre ficha → **Ativar acesso individual do paciente** → UUID Auth + e-mail exato + justificativa + confirmação institucional. CPF isolado não é prova. Conferir sucesso na reconsulta de pacientes.user_id e evento VINCULO_CONTA_PACIENTE. Uma conta já vinculada a outra ficha ou com perfil profissional deve ser rejeitada.

## 5. Ensaio real mínimo com evidências

Utilizar o mesmo paciente vinculado para verificar PWA depois da aplicação. Usar sessões separadas de admin/UBS A/UBS B/paciente. Guardar apenas UUIDs sintéticos, horários, contagens e resultados em relatório ignorado; nunca tokens, cookies, senhas ou dumps de rede.

| Passo | Ação | Evidência obrigatória |
| --- | --- | --- |
| A | Cadastro sintético pela UBS A e recarga completa | UUID persistido, quantidade/data das doses e evento de cadastro; prescrição intacta |
| B | Vínculo autorizado e login paciente | Sem perfil profissional; início, doses e perfil mostram a mesma ficha; unidade legível |
| C | Entrada DEMO de 10 unidades em lote vigente de A | Após recarga: saldo 10, um movimento com motivo/autor/contexto DEMO |
| D | Aplicar uma dose elegível desse paciente | Um UUID de aplicação; saldo 9; uma baixa -1 vinculada; status/data e auditoria atualizados após recarga |
| E | Repetir mesma dose | Rejeição; continua uma aplicação válida, uma baixa e saldo 9 |
| F | Recarregar PWA da mesma conta | Dose aplicada/histórico visíveis, próxima pendência correta, datas prescritas inalteradas; notas internas ocultas |
| G | Busca ativa com fixture sintética atrasada | Um paciente por linha, dose mais antiga; após aplicar, atraso correspondente reduzido |
| H | Registrar contato **simulado** | Histórico persistido, autor/canal/resultado/retorno e contexto demonstração; mesma chave não duplica; nenhum envio externo |
| I | Sessão UBS B e paciente, chamadas diretas à API | Outra ficha/doses indisponíveis; estoque/notas internos bloqueados ao paciente; paciente não escreve/aplica/vincula |
| J | Duas sessões tentam consumir a última unidade para doses distintas | Uma confirmação; outra falha sem saldo negativo ou gravação parcial — pendente até executar |

Não criar atraso em prescrição real; usar dados fictícios previamente aprovados. Não enviar WhatsApp: abrir link não é contato realizado. Todos os cenários de escrita exigem autorização operacional; nenhuma falha deve ser “corrigida” removendo RLS/constraints.

## 6. Comandos do responsável

Configuração somente em `.env.homolog.local`, ignorado pelo Git. Preencher contas DEMO confirmadas, `HOMOLOG_PACIENTE_ID`, `HOMOLOG_OUTRO_PACIENTE_ID`, vacina/lote da UBS A e CPF sintético inédito. Não imprimir o arquivo.

```powershell
npm run homolog:check
npm run homolog:read:admin
npm run homolog:read:paciente
npm run homolog:read
```

Para escrita **após autorização explícita e conferência do banco**: declarar `HOMOLOG_SQL_REVISADO=sim`, `HOMOLOG_REVISAO_APLICADA=fase2-006-r2`, `HOMOLOG_ESTOQUE_APLICADO=sim` e `HOMOLOG_BUSCA_ATIVA_APLICADA=sim`. Esses valores não são prova de migração ou autorização automática.

```powershell
npm run homolog:write
```

O runner agora exige saldo antes da primeira escrita e confere saldo reduzido em uma unidade/baixa única após aplicação e tentativa duplicada. Cria uma **nova ficha**, preserva os dados e não a vincula automaticamente à conta já vinculada. Logo seu PASS **não prova atualização do PWA da fixture anterior**: executar B–F pela interface na mesma ficha vinculada. Se faltar conta/fixture ou ocorrer falha parcial, parar, guardar UUIDs e conferir histórico; não repetir cegamente.

## 7. Reversão e contenção

- Antes de COMMIT: ROLLBACK. Não contornar guard para prosseguir.
- Após escrita de estoque: 021 aprovado suspende as quatro RPCs, preservando consumo/dados/auditoria. Não remover apenas trigger de baixa. Não é desinstalação nem bloqueio global de operadores privilegiados/clientes diretos de catálogo. Fazer correção adiante com revisão.
- Para impedir novos vínculos: após aprovação, `REVOKE EXECUTE ON FUNCTION public.va_vincular_conta_paciente_v1(uuid,uuid,text,text,boolean) FROM PUBLIC,anon,authenticated;` e conferir privilégios herdados. Isso não desvincula pacientes nem encerra sessões. Vínculo errado exige contenção administrativa autorizada da conta e correção auditada específica.
- Não apagar conta/ficha/movimentos, desfazer todas as políticas ou restaurar rollback antigo 006/012. Recuperação de dados depende do backup de dados, não dos JSONs. Não executar 022 como limpeza: ele apenas lista candidatos para revisão.

## 8. Status comprovado nesta revisão

| Item | Status |
| --- | --- |
| Lint, TypeScript e build | Aprovados; 18 páginas/rotas |
| Unitários | 21 aprovados |
| SQL local clínico / estoque / vínculo / busca ativa | 16 / 10 / 8 / 16 cenários aprovados |
| Fluxo combinado local | Aprovado; inclui leitura do paciente após aplicação e baixa |
| Configuração local | URL/chave pública presentes; apenas admin configurado; UBS A/B e paciente ausentes no preflight |
| Leitura admin remota | Repetida e aprovada nesta revisão: login, identidade, papel e dez HEAD; sem RPC ou escrita |
| Login/isolamento paciente remoto | Pendente: conta/fixtures não configuradas; zero testes aprovados no preflight |
| Escrita/persistência/contato/PWA remoto e concorrência | Pendentes; não executados pelo agente |
| Comparação definitiva 019/025 | Concluída: objetos presentes e compatíveis; ambas devem ser puladas |

Os arquivos finais, anteriormente vazios, foram preenchidos e comparados. O teste local de rollback histórico também passou, mas seu resultado não autoriza usar aquele snapshot antigo para desfazer o banco atual. SQLs 017/023 e os ensaios de dados ainda dependem da execução manual indicada acima.

Checks reproduzíveis antes de apresentar:

```powershell
npm run lint
npm test
npm run test:sql
npm run test:estoque:sql
npm run test:paciente:sql
npm run test:busca-ativa:sql
npm run test:final:sql
npm run build
npm run typecheck
```

Não executar build e typecheck simultaneamente. Node mantém aviso de detecção de módulo TypeScript, sem falha; Git informa conversão LF/CRLF. Nenhuma funcionalidade nova foi adicionada nesta etapa: somente revisão, ensaio combinado, verificação de estoque no runner e este checklist.
