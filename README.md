# VacinAção

MVP de acompanhamento da profilaxia antirrábica para UBS e pacientes. Next.js 16, React, TypeScript, Tailwind e Supabase. Entrega final: **12/11/2026 às 19h, horário de São Paulo**.

O projeto configurado é exclusivamente de desenvolvimento com dados fictícios. Não há envio automático de WhatsApp/SMS. Contatos são registrados manualmente e identificados como demonstração.

A revisão visual do painel e da área do paciente está descrita em [alterações, arquivos e verificações da interface](docs/REVISAO-VISUAL-12-11-2026.md). A homologação de escrita continua separada da aprovação visual.

Para acesso individual do paciente, ver [ativação DEMO, vínculo auditado, recuperação assistida e testes](docs/PORTAL-PACIENTE-DEMO.md). SQL 025 e criação de conta exigem aprovações explícitas separadas; CPF não é senha nem prova de titularidade.

## Iniciar

1. Execute `npm ci` se as dependências ainda não estiverem instaladas.
2. Configure `.env.local` conforme `.env.example`: URL Supabase e chave pública anon/publishable. Nunca use chave administrativa no cliente.
3. Execute `npm run dev` e abra `http://localhost:3000`.
4. Para produção local: `npm run build` e `npm run start -- --hostname 127.0.0.1 --port 3100`.

## Banco e homologação

Para encerrar a entrega, seguir o [checklist FINAL com sequência manual, backups, contenção e evidências](docs/CHECKLIST-FINAL-19H.md). Os relatórios anteriores registram estados históricos; não reaplicar migrações a partir deles sem comparação atual.

Snapshots finais das 15:53 de 12/11 confirmam objetos **019 e 025 presentes e compatíveis**. Pular ambas; prosseguir com verificações somente leitura e homologação autorizada de dados/contas conforme o checklist.

**Atualização pelo snapshot 018:** os corpos 006-r2 e grants 015 já estão presentes. O próximo SQL proposto é o 019 de estoque DEMO, sem execução automática. Ver [estado atual, aplicação, contenção e roteiro da apresentação](docs/ESTOQUE-E-APLICACAO-19H.md), que substitui a sequência histórica abaixo para o estado capturado às 14:08 de 12/11.

As migrações **não foram aplicadas pelo agente**. O diagnóstico 014 confirmou estrutura de busca ativa e wrapper legado já presentes. A ordem revisada, após aprovação explícita, é **006-r2 → 015**; não reaplicar 011/012 neste estado. Ver [comparação, backup, reversão e testes no Supabase](docs/PLANO-MIGRACOES-014.md). Não execute 004.

O snapshot remoto está preservado em `sql8/sql8.json` e `backups/antes-006-r2.json`, ambos ignorados pelo Git. Rollbacks e verificação estão em `backups`. Backup de metadados não substitui backup de dados.

## Demonstrar

Entrar como UBS A → cadastrar paciente DEMO e datas prescritas → recarregar a ficha → registrar aplicação simulada → conferir histórico e atrasos → abrir Busca ativa → registrar tentativa simulada e próximo retorno → recarregar histórico → conferir UBS B e PWA do paciente em sessões separadas. Os dados e contas do ensaio devem ser fictícios.

Prepare contas manualmente conforme [o roteiro de homologação](docs/HOMOLOGACAO-FASE2.md). `.env.homolog.example` documenta a configuração local ignorada pelo Git. Não crie usuários automaticamente ou use CPF como prova de identidade.

## Verificar

`npm run lint`, `npm test`, `npm run build` e depois `npm run typecheck`. Não execute build e typecheck simultaneamente. O build baixa as fontes Google existentes e requer rede.

Com o servidor local na porta 3100: `npm run test:smoke`. SQLs locais: `npm run test:sql`, `npm run test:busca-ativa:sql` e `npm run test:backup` usam PostgreSQL embarcado temporário, descrito no relatório. `npm run test:browser:publico` usa navegador temporário e não envia formulários.

`npm run homolog:check` valida a configuração básica e mostra disponibilidade das contas sem expor valores. `npm run homolog:read:admin` testa somente login/sessão, perfil admin e leituras HEAD com a conta existente, sem exigir UBS A/B ou paciente e sem executar RPCs. Resultado atual: [validação administrativa parcial](docs/VALIDACAO-ADMIN-SOMENTE-LEITURA.md).

Os ensaios completos `homolog:read`, `homolog:write` e `test:e2e` continuam exigindo suas contas/fixtures e, para escrita, migrações aprovadas. Aprovação da leitura parcial não equivale à homologação completa.
