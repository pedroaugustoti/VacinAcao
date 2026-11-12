# Revisão visual — VacinAção, 12/11/2026

Entrega prevista para hoje às 19h, São Paulo. Implementação no projeto existente, com interface azul, verde-água e superfícies claras. Não houve alteração de contratos RPC, consultas, cálculos clínicos, autenticação, RLS ou banco. As propostas 006-r2 e 015 continuam aguardando aprovação explícita.

## Alterações

- Sidebar clara, marca preservada, navegação ativa azul, contexto da equipe e identificação explícita de demonstração. Retirada a indicação visual de “Ambiente Seguro”, que não era uma verificação técnica de segurança.
- Cabeçalho com unidade e operador, espaçamento consistente e ajuste dos dois cabeçalhos fixos no celular.
- Dashboard com indicadores maiores derivados das consultas existentes, cartões compactos em duas colunas no celular, categoria de atrasos destacada e atalho de busca ativa. Nenhum gráfico, percentual ou número de demonstração foi adicionado.
- Listagem com maior legibilidade, destaque dos pacientes cujo status já era calculado como atrasado, acesso à busca ativa, nome sem truncamento e tabela rolável por teclado com descrição acessível. Busca, paginação, ordem e cálculos preservados.
- Cadastro organizado em identificação/atendimento e cronograma prescrito, sem alterar validação, número de doses, confirmação ou envio. Erros são anunciados com `role=alert`.
- Ficha com acesso por âncoras ao calendário, aplicação e contatos; painéis padronizados e vazios informativos, preservando informações e formulários existentes.
- Busca ativa com prioridade visual para atrasos e retornos já calculados. Mensagem de indisponibilidade explica como proceder sem sugerir execução de SQL ao profissional. O botão “Consultar novamente” apenas atualiza a consulta da página.
- Área do paciente com cabeçalho da marca, cartão de acompanhamento azul/verde-água, acesso ao calendário, navegação inferior consistente, cartões de doses e indicação de atraso por texto e cor. Estados de carregamento e erro próprios.
- Foco visível, tratamento de movimento reduzido, rótulos de busca e remoção de `maximumScale: 1`, permitindo zoom. Isso é melhoria direcionada de acessibilidade, não certificação WCAG.

## Arquivos desta etapa

| Área | Arquivos modificados/criados |
| --- | --- |
| Base | `src/app/globals.css`, `src/app/layout.tsx` (somente remoção da restrição de zoom) |
| Estrutura administrativa | `src/app/(ubs)/layout.tsx`, `src/app/(ubs)/admin-sidebar.tsx` |
| Telas administrativas | `src/app/(ubs)/admin/page.tsx`, `admin/loading.tsx`, `admin/cadastro/page.tsx`, `admin/pacientes/page.tsx`, `admin/pacientes/[id]/page.tsx`, `admin/busca-ativa/page.tsx` — todos sob `src/app/(ubs)/` |
| Busca ativa na ficha | `src/components/busca-ativa/ContatoPaciente.tsx` |
| Área do paciente | `src/app/(pwa)/layout.tsx`, `page.tsx`, `doses/page.tsx`, `perfil/page.tsx`; novos `loading.tsx` e `error.tsx` |
| Componentes | `src/components/pwa/PwaNav.tsx`, `ListaDoses.tsx`, `ListaDosesSkeleton.tsx`; novos `src/components/ui/PageLoading.tsx` e `RefreshReadButton.tsx` |
| Verificação/documentação | Novo `tests/browser-visual-admin.mjs`, este relatório e referência no README |

As demais alterações já existentes na árvore de trabalho são de etapas anteriores. Nenhum arquivo SQL, configuração de credenciais, proxy de autenticação ou biblioteca de regras/RPC foi alterado nesta revisão visual. Não foram adicionadas dependências.

## Verificações

| Verificação | Resultado |
| --- | --- |
| `npm run lint` | Aprovado, sem avisos do ESLint |
| `npm test` | 19 testes aprovados |
| `npm run build` | Aprovado, 17 páginas/rotas |
| `npm run typecheck` após build | Aprovado |
| Navegador público | Oito verificações aprovadas em desktop/celular: login paciente, login UBS, registro e proteção anônima da busca ativa |
| Smoke HTTP local | Oito verificações aprovadas |
| Navegador administrativo | Login existente e inspeção somente leitura de cinco telas/estados em desktop e celular (dez verificações), mais menu mobile e nova consulta em dois tamanhos; 13 verificações aprovadas. Sem overflow horizontal da página ou erros JavaScript; zoom permitido. |
| `git diff --check` | Aprovado |

Capturas em `backups/preview-visual/`, ignoradas pelo Git, com relatório sem dados de sessão. Foram examinadas as capturas do painel desktop/celular, cadastro desktop/celular e ficha no celular; a conta utilizada lê registros persistidos do projeto de desenvolvimento com dados fictícios confirmado pelo usuário. O script não cria fixtures e não envia formulários clínicos, mensagens ou contatos; somente o formulário de login foi enviado. Não salva tokens, cookies ou senhas. O erro inicial da automação foi um seletor ambíguo durante a transição de login; corrigido para o conteúdo administrativo específico, sem alterar a autenticação.

Para reproduzir a inspeção administrativa, com o servidor local na porta 3100 e as credenciais existentes apenas no arquivo ignorado:

```powershell
node --env-file-if-exists=.env.homolog.local tests/browser-visual-admin.mjs
```

Utiliza o Playwright temporário já instalado em `%TEMP%/vacinacao-ui-review-tools`, sem acrescentá-lo ao projeto. Os ensaios de escrita existentes não foram executados.

## Limites e problemas encontrados

- A fila e o histórico de contatos continuam indisponíveis para a sessão atual por permissões remotas. Sua mensagem de erro foi verificada; **a fila preenchida e o registro de contato não foram homologados**. A interface não transforma falha em indicadores zerados.
- A aparência autenticada de início/calendário/perfil do paciente permanece pendente de conta DEMO vinculada. Build aprovado e login público inspecionado não substituem essa verificação.
- A ficha inspecionada mostra ausência de vacinas ativas no catálogo disponível para a sessão administrativa. O formulário mantém a aplicação indisponível. Configurar/confirmar catálogo e lote de demonstração será necessário na homologação de escrita; nenhum catálogo foi alterado nesta etapa.
- Cadastro, aplicação, contato e persistência após escrita continuam dependentes das migrações aprovadas e da homologação sintética. Esta revisão não aprova esses fluxos.
- O Node emite o aviso já existente de detecção de módulo TypeScript; os testes passam. O Git informa conversão LF/CRLF, sem falha de whitespace.
- Ponto de restauração seletivo anterior aos ajustes em `%TEMP%/vacinacao-before-visual-20261112-134350.zip`, sem arquivos de ambiente. Capturas e credenciais ficam fora do Git. Não foi criado commit nesta etapa.
