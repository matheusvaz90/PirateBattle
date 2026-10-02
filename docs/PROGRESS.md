# Progresso

## Marco atual

A implementação do jogo e dos dados está completa o suficiente para a verificação da entrega. O usuário confirmou o gameplay, salvamento das partidas, ranking e a direção visual anterior. Pickups de vida, ataque especial carregado, polimento focado da água/ilha e uma interface completa em português brasileiro estão implementados na versão de balanceamento `survival-v2`. A versão pública está disponível no Cloudflare. Existem seis referências visuais anteriores para Darwin e a última comparação delas passou, mas elas antecedem essas mudanças intencionais de texto/visual e precisam de revisão. Evidências funcionais atualizadas no navegador e medições de hardware continuam pendentes.

## Implementação

- Vite, React, TypeScript estrito, PixiJS 8, ESLint e Playwright estão configurados.
- TanStack Query, Axios e MSW 3 participam de consultas e registros REST mock reais.
- Todos os assets originais fornecidos foram importados do commit do desafio `315891441be81ca0bff75cf3c2b0cd2f27f119cd`; a proveniência está documentada.
- Menu, opções, resultado local com tempo, restauração do último resultado e erros explícitos de armazenamento estão implementados.
- Um motor de navegação com passo fixo controla avanço, rotação, colisões com ilha/bordas, pausa, abandono e tempo esgotado.
- O PixiJS renderiza água animada em alta resolução, uma ilha refinada em alta resolução, o barco do jogador, pickups de vida e indicadores de vida. O deslocamento da água acompanha o tempo ativo da simulação e congela durante a pausa.
- O disparo frontal lança um projétil; as laterais esquerda/direita lançam três projéteis paralelos de origens locais distintas no barco. Espaço/Q/E e botões de toque separados aceitam movimento/rotação/disparo simultâneos.
- Cada arma tem um cooldown independente configurado. Manter a entrada pressionada repete ataques. Cooldowns, projéteis e feedback usam o tempo da simulação e congelam durante pausa/conclusão.
- A colisão por segmento resolve o primeiro contato com ilha/limite, incluindo obstrução entre o barco e a boca do canhão. O percurso do projétil é limitado ao tempo de vida restante. Disparos removidos criam feedback breve de impacto quando apropriado.
- Chasers perseguem com rotação limitada, aplicam 25 de dano por contato, explodem uma vez e nunca concedem pontos pela autodestruição no contato. Shooters se aproximam, param a 300 unidades e disparam dentro do alcance (400 unidades) quando mira, linha de visão e cooldown de 1,6 segundo permitem.
- Ambos os tipos seguem desvios locais persistentes ao redor das ilhas e respeitam colisões com arena/ilha. Todo movimento e ataque inimigo usa o tempo da simulação.
- O surgimento padrão alterna os tipos no intervalo salvo, começando depois desse intervalo. Candidatos com seed nas bordas respeitam verificações de obstáculos, distância do jogador (320 unidades) e separação dos inimigos existentes. Buscas que falham tentam novamente com segurança depois de 0,5 segundo.
- Facções dos projéteis impõem o direcionamento jogador/inimigo e o impacto válido mais próximo. O dano é aplicado uma vez por projétil. Alvos letalmente atingidos são ignorados imediatamente e removidos antes de disparar; cada destruição causada pelo jogador concede um ponto.
- A colisão com movimento relativo trata o contato do Chaser. A morte encerra a partida uma vez, preserva a duração real e tem precedência sobre o tempo esgotado simultâneo. A conclusão congela dano, ataques, movimento, tempo de surgimento e pontuação.
- Treze texturas compartilhadas incluem barcos saudáveis/danificados, coração Retina, água/areia/rocha Retina e efeitos de destruição. Elementos visuais de inimigos/projéteis/efeitos são reutilizados por ID e destruídos na remoção ou desmontagem. Todo barco tem indicador de vida, flash de impacto e deterioração visual baseada na vida.
- Pickups opcionais de vida são ativados por padrão. Um coração posicionado com segurança aparece a cada 15 segundos ativos, dura 10 segundos, continua disponível com vida cheia e restaura até 20 de vida quando coletado.
- Ataques especiais opcionais são ativados por padrão. Cinco mortes por canhão armazenam uma carga; R ou o controle de toque destrói todos os inimigos vivos, remove projéteis hostis, concede os pontos normais e redefine a carga. Mortes pelo especial e por contato do Chaser não o recarregam, e uma arena vazia não consome a carga.
- Toda a interface visível ao usuário, rótulos de acessibilidade, erros recuperáveis de armazenamento/API, cenários de rede, ranking/histórico e painel de profiling usam português brasileiro. Identificadores internos estáveis, contratos e erros exclusivamente técnicos permanecem em inglês.
- Um especial pronto exibe dois anéis pulsantes dourado/verde ao redor do barco do jogador. A aura acompanha o barco e usa o tempo ativo da simulação, portanto congela durante a pausa. As instruções do menu principal e do jogo documentam explicitamente R como controle do especial.
- A configuração do resultado inclui valores de inimigos/surgimento/navegação/pickup/especial/feedback com a versão de balanceamento `survival-v2`. Resultados existentes de `combat-v1` continuam legíveis e são classificados separadamente. Opções da versão 1 migram com os recursos aprovados ativados; resultados do protótipo apenas de navegação continuam rejeitados sem excluir os dados armazenados.
- Origens independentes de teclado e ponteiro aceitam ações simultâneas; entradas obsoletas são limpas na pausa e na retomada.
- Perda de foco/visibilidade pausa o jogo. Um modal nativo exige retomada explícita.
- A inicialização do renderizador trata o descarte enquanto a inicialização/carregamento está pendente. As sessões limpam listeners, observador, ticker, canvas, entidades da simulação e objetos visuais controlados, preservando doze texturas compartilhadas.
- O dimensionamento responsivo da arena lógica e os controles de toque em paisagem estão implementados.
- Um build dedicado de teste ativa cenários iniciais com seed e observação de cópias do estado. Seu relógio congela antes do início do gameplay, impedindo que mortes das fixtures disputem com a configuração do teste. Entradas e avanço do relógio exercitam o motor/renderização reais. Um build normal de produção exclui o observador e o módulo de cenários.
- Todos os arquivos Markdown mantidos pelo projeto usam português brasileiro, incluindo README, arquitetura, plano, progresso, procedimento de profiling, instruções de implementação e proveniência dos assets. Comandos, caminhos, variáveis de ambiente, rótulos externos, nomes próprios e identificadores técnicos estáveis permanecem literais quando necessário.
- O README usa a URL real `matheusvaz90/PirateBattle` para clonagem e documenta a publicação no Cloudflare Worker com assets estáticos. O Node 24 está fixado em `.node-version`, e `public/_headers` evita cache obsoleto do Service Worker simulado. A versão pública está disponível em `https://piratebattle.matheusvaz90.workers.dev/`.
- As instruções de configuração do GitHub usam a URL HTTPS real do repositório e a pasta de checkout `PirateBattle`, sem depender de caminhos específicos da máquina. As instruções de testes controlados no navegador incluem comandos para macOS/Linux e Windows PowerShell.
- Uma identidade local e persistente do Captain, abas paginadas de Ranking/Histórico de partidas, cabeçalhos semânticos de tabela, navegação por teclado nas abas e estados de carregamento/vazio/erro/atualização em segundo plano estão implementados.
- Contratos compartilhados e validados, além de chaves canônicas da configuração completa, comparam configurações equivalentes sem depender da ordem das propriedades nem sofrer colisões de hash. O ranking usa pontuação/data/ID para desempate; o histórico mostra data UTC, duração, motivo e configurações.
- Uma coleção versionada de partidas confirmadas sustenta as duas abas. O ID primário da partida torna idempotentes novas tentativas de registro idênticas; payloads conflitantes recebem HTTP 409. Dados confirmados persistem depois da atualização.
- Uma fila durável e separada de pendências é gravada antes do envio. Várias partidas podem permanecer pendentes enquanto outra é jogada. Os recibos são gravados antes da remoção daquela pendência. A recarga aciona uma tentativa; controles explícitos de nova tentativa recuperam falhas posteriores. Falhas de armazenamento são exibidas em vez de relatadas como sucesso durável.
- Mutations bem-sucedidas cancelam/invalidam ranking e histórico. O Axios consome sinais de cancelamento das consultas, e um limite mínimo de revisão rejeita/consulta novamente respostas anteriores aos dados confirmados conhecidos.
- Controles públicos de cenário fornecem fixtures de sucesso/vazio/múltiplas páginas, latência lenta/variável/fora de ordem, timeout, erros de conexão, HTTP 400/500, falhas por aba, respostas perdidas depois do commit e indisponibilidade/recuperação. A seleção persiste e os scripts são redefinidos deterministicamente.
- A redefinição limpa apenas dados mock confirmados e recibos, restaura Sucesso e preserva resultados pendentes, identidade, opções e último resultado. Ela é bloqueada durante envios ativos.
- O worker do MSW foi gerado com a CLI instalada; package.json registra public/ como `workerDirectory`. O MSW 3 usa `onUnhandledFrame`, não a opção antiga `onUnhandledRequest`. A inicialização do mock é independente do acesso ao jogo e está ativada em builds normais publicados.
- Resultados locais existentes podem ser registrados explicitamente com Registrar partida. Não há preenchimento retroativo automático do histórico nem backend real. O armazenamento local à origem do navegador e as fixtures estão documentados.
- A criação do ID da partida também funciona quando `randomUUID` não está disponível, mas `getRandomValues` existe, compatível com o fluxo documentado de desenvolvimento local em dispositivos móveis.
- Uma configuração visual separada do Playwright cobre menu, arena estável e resultado registrado em desktop/dispositivo móvel. Ela fixa hora/localidade/fuso horário, aguarda o estado dos assets/API, usa entradas e regras reais e armazena PNG específicos por plataforma/projeto. A geração de referências ausentes não sobrescreve referências existentes.
- Relatórios visuais usam visual-report/ e test-results/visual/, separados dos relatórios funcionais. Existem seis referências para Darwin em desktop/dispositivo móvel; a execução anterior registrada passou, mas a referência da arena/HUD está agora intencionalmente obsoleta depois deste incremento.
- Builds normais ativam profiling somente com `profile=1`; builds controlados de teste o desativam. O painel de menu/resultado permite checkpoints manuais, entrada da referência de hardware, inspeção das métricas e exportação de JSON.
- O profiling coleta intervalos brutos ativos do ticker, FPS ponderado, p95 pelo posto mais próximo, intervalo máximo, quantidade de frames lentos, contagens de entidades por segundo ativo e pico de cada frame. Os arrays de intervalos brutos são limpos depois do resumo. A gravação nunca publica atualizações por frame no React.
- Leases idempotentes de recursos rastreiam os ciclos de vida controlados de renderizador/canvas/ticker/observador/entrada/inscrição. Estimativas opcionais do heap do navegador e metadados de canvas/resolução/build são incluídos. Os contadores não substituem a investigação da GPU/heap.
- O FrameClock descarta deltas nas fronteiras de inicialização/retomada, inclusive em transições entre callbacks de RAF, para que o tempo com a aba oculta não entre na simulação/métricas como recuperação limitada. Travamentos ativos normais continuam incluídos; velocidades/dano/surgimento do gameplay não mudaram.
- Um marcador de execução de referência completa exige build otimizado, canvas renderizado, simulação concluída de 180 segundos e medições brutas correspondentes de frames. Ele indica apenas cobertura, não que o desempenho atingiu a meta de 60 FPS.
- docs/PROFILING.md contém o procedimento do usuário e um modelo de relatório explicitamente não medido para combate de três minutos e cinco ciclos de iniciar/jogar/sair.

## Verificação

- Node.js v26.4.0 e npm 11.17.0 estão disponíveis.
- A instalação das dependências foi concluída e o npm não relatou vulnerabilidades conhecidas no momento da instalação.
- `npm run typecheck`: passou.
- `npm run lint`: passou.
- `npm test`: 91 passaram, 0 falharam. A nova cobertura determinística verifica tempo do pickup, coleta, limite de cura, preservação com vida cheia, congelamento na pausa, carga após cinco mortes, limpeza de inimigos/projéteis, ausência de recarga em cadeia pelo especial, preservação da carga com arena vazia, comportamento dos recursos desativados, validação da configuração, migração das opções e compatibilidade com resultados `combat-v1`. A cobertura existente do jogo/dados/profiling continua passando.
- Testes do MSW em Node instalam interceptação estrita de requisições e usam armazenamento em memória; nenhum servidor da aplicação, socket de rede, serviço real ou banco de dados é iniciado.
- `npm run build`: passou. O Vite emitiu um aviso de tamanho para o chunk principal minificado de aproximadamente 633,49 kB (192,76 kB gzip). A camada mock permanece em um chunk separado com carregamento lazy de aproximadamente 396,10 kB. Reavalie o carregamento lazy do menu/jogo depois das medições, em vez de alterar o limite do aviso.
- `npm run build:test`: passou, com o mesmo aviso de tamanho do chunk.
- Descoberta padrão do Playwright: 20 casos no Chromium para desktop/dispositivo móvel, cobrindo navegação e abas de dados. Descoberta completa com build controlado: 62 casos em quatro arquivos, incluindo gameplay e registro/recuperação. Descoberta não significa execução.
- Descoberta visual dedicada: 6 casos no Chromium para desktop/dispositivo móvel, cobrindo menu, arena e resultado. Descoberta não significa geração ou comparação de capturas de tela.
- O build final gerado é um build normal de produção: símbolos/módulo do observador de teste do gameplay estão ausentes, enquanto mockServiceWorker.js e o módulo mock de rede obrigatório estão presentes.
- Nenhum servidor da aplicação ou navegador foi iniciado pelo agente.
- O deploy público no Cloudflare foi verificado por HTTP. A página principal, os bundles e `mockServiceWorker.js` responderam com status 200; o worker foi servido como JavaScript com `Cache-Control: no-cache, no-store, must-revalidate`. Essa verificação confirma a disponibilidade estática, não o gameplay no navegador.
- Os sete arquivos Markdown mantidos pelo projeto receberam revisão estática depois da localização. Seus 28 delimitadores de blocos de código estão balanceados e os cinco links locais apontam para destinos existentes. A busca residual não encontrou títulos ou frases em inglês; termos técnicos, nomes externos e identificadores literais foram preservados intencionalmente. Nenhuma verificação de execução foi necessária para essas alterações apenas documentais.
- Verificação do usuário antes deste incremento: bloqueio da ilha, estilo visual, verificações dos canhões, intervalos de ataque, salvamento e ranking foram aprovados; o combate foi relatado como funcional e agradavelmente desafiador. O usuário aprovou as regras de pickup, especial, água e ilha, mas ainda não avaliou sua implementação.
- Existem seis PNG visuais e um estado visual anterior aprovado. Eles não verificam este build alterado. Nenhum resultado funcional atual no navegador ou trace foi executado pelo agente. Gameplay atualizado em desktop/dispositivo móvel, referências visuais, medições reais de frames/memória e evidências do ciclo de vida continuam pendentes.

## Próxima tarefa concreta

Próxima tarefa concreta: o usuário deve jogar a versão pública e verificar o ajuste dos textos em português, a aura do especial pronto, coleta do coração, ativação por R/toque, movimento da água, emendas da ilha, controles móveis, ranking e histórico. Depois, deve revisar/atualizar todas as referências para Darwin, executar novamente as suítes visuais e funcionais e coletar profiling do build otimizado com `profile=1`.

## Limitações conhecidas

- Gameplay, integração da API, preparação visual, instrumentação de profiling e deploy público estão implementados; a execução e as evidências funcionais/visuais obrigatórias continuam pendentes.
- O estado da API é local à origem e não fornece serviço multiplayer remoto compartilhado nem garantias transacionais entre abas. O histórico do Captain com múltiplas páginas é composto explicitamente por fixtures simuladas.
- O cenário Vazio remove fixtures, não registros confirmados do usuário. Redefina os dados de demonstração confirmados antes de testar listas completamente vazias; registros pendentes são preservados intencionalmente.
- Uma falha de escrita no armazenamento do navegador não garante persistência até que o armazenamento se recupere; a fila informa isso e impede o envio de um resultado não persistido.
- HTTP em uma rede LAN física pode não aceitar Service Workers. A inicialização da API relata falhas e permite nova tentativa; HTTPS/localhost são os ambientes de referência. O gameplay continua disponível de forma independente.
- O desvio é uma condução local baseada em círculos para a arena atual, não uma malha de navegação geral. Barcos inimigos não bloqueiam uns aos outros; grupos densos podem se sobrepor visualmente durante a perseguição.
- Toda recuperação extrema entre frames além de 0,25 segundo é descartada; o tempo ativo é o tempo simulado, não o tempo decorrido no relógio real.
- A colisão usa uma aproximação circular dos desenhos fornecidos do barco e da ilha; a sensação visual precisa da avaliação do usuário.
- A cobertura de toque com dois ponteiros emulado pelo navegador e de combate inimigo está criada; a execução e o teste físico do combate em dispositivo móvel continuam pendentes.
- Os PNG visuais existentes antecedem a mudança intencional na água/ilha/HUD. Relatórios/traces atuais do navegador e JSON de profiling/investigação do heap ainda não existem. Uma execução de três minutos pode exigir novas tentativas se o barco morrer cedo; nenhum atalho de gameplay foi introduzido para o profiling.
- Estimativas do heap são opcionais/aproximadas e excluem memória da GPU. Contadores de leases são contabilização explícita, não descoberta automática de vazamentos. O profiling retém dados compactos do relatório até a atualização; exporte antes de atualizar.
- Nenhuma licença upstream separada para os assets foi encontrada na raiz inspecionada; a exigência de uso dos assets e a fonte do desafio estão documentadas sem declarar direitos mais amplos de redistribuição.

## Entrega restante

A avaliação do usuário sobre o polimento implementado, evidências/referências atualizadas do navegador, profiling e revisão final continuam pendentes. O deploy público está disponível no Cloudflare. Consulte IMPLEMENTATION_PLAN.md para os critérios de aceitação. Não marque o desafio como concluído antes de existirem os demais itens obrigatórios da entrega.
