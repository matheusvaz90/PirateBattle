# Arquitetura

## Escopo atual

O incremento atual implementa o fluxo de jogo/dados, a preparação determinística dos testes visuais, a instrumentação opcional de profiling e uma interface naval responsiva. O deploy público está disponível; a execução atual no navegador, a revisão das baselines e evidências reais de hardware/desempenho continuam pendentes. Este documento diferencia o comportamento implementado do comportamento verificado.

## Responsabilidades

O React controla telas, opções, diálogos, HUD semântico e botões de ataque por toque. O GameEngine é independente de framework e controla o estado e o tempo da simulação, incluindo o destino de navegação, pickups de vida e carga do especial. O GameRenderer controla exclusivamente os objetos Pixi do gameplay e os sincroniza com o motor. O InputController traduz teclado e coordenadas de ponteiro para ações ou destinos no mundo lógico sem depender de atualizações por frame no React. O menu inicial usa React, CSS e imagens estáticas oficiais; ele não cria outro contexto gráfico antes da arena.

## Tempo e pausa

O motor usa um passo fixo de simulação de 1/60 de segundo. O tempo decorrido entre frames é acumulado e, no máximo, 15 passos são processados por frame; o excesso é descartado para limitar a recuperação durante travamentos graves. O cronômetro representa o tempo ativo simulado, portanto travamentos extremos podem ampliar a duração no relógio real. A pausa limpa o tempo acumulado e as entradas, e a retomada exige uma ação do usuário. O FrameClock observa as publicações de estado e descarta o primeiro delta depois da inicialização/retomada, inclusive em transições entre callbacks de RAF. O tempo com a aba oculta não pode entrar na simulação como recuperação limitada. Travamentos ativos reais continuam sendo entradas válidas. A atualização final é limitada ao tempo restante da sessão.

## Arena e movimento

As coordenadas usam X para a direita, Y para baixo e radianos no sentido horário a partir da direita. Um mundo lógico fixo de 1280 × 720 é ajustado ao canvas disponível com letterbox. A proporção de pixels do dispositivo controla a densidade do raster, limitada a 2 para reduzir o uso inicial de recursos em dispositivos móveis. O redimensionamento não altera a geometria do mundo. Os barcos usam colisores circulares. O movimento usa velocidades por segundo da configuração; a colisão impede penetração e permite movimento por um eixo válido quando possível.

Teclado e ponteiro são alternativas de navegação. W/A/D e setas produzem as ações de movimento existentes. Manter o botão principal do mouse ou um toque sobre a arena converte a posição da viewport, inclusive o letterbox, para um destino limitado ao mundo lógico. A cada passo fixo, o motor gira pelo caminho angular mais curto e avança na velocidade configurada; soltar o ponteiro remove o destino. O destino nunca altera diretamente a posição do barco e é limpo na pausa, conclusão ou desmontagem.

## Recursos e Strict Mode

Cada tela de jogo cria seu próprio motor, renderizador, controlador de entrada, callback do ticker e ResizeObserver. A limpeza remove listeners controlados, limpa entradas e entidades do motor, interrompe e destrói a aplicação Pixi e libera objetos visuais. A inicialização assíncrona deve verificar o descarte antes de criar uma sessão, anexar um canvas ou iniciar o ticker. Texturas compartilhadas são reutilizadas por Pixi Assets e não são destruídas com sprites individuais; somente o cache limitado dos treze assets de textura selecionados permanece entre partidas. Os elementos visuais de inimigos, projéteis e efeitos são indexados pelo ID da simulação, reutilizados entre frames e destruídos quando a entidade é removida. Seus mapas são limpos na desmontagem. A geometria da vida é redesenhada apenas quando a vida muda. Texturas danificadas e tints breves fornecem deterioração e feedback de impacto. Água, areia, rocha e coração usam os assets fornecidos em alta resolução; o movimento da água deriva do tempo ativo da simulação e, por isso, congela durante a pausa.

## Menu inicial e áudio

O menu inicial combina a cena de batalha, a moldura, o logotipo e os estados de botão fornecidos no pacote de assets. Os controles continuam elementos HTML semânticos sobre a composição estática, preservando teclado, foco e leitores de tela. Como não existe canvas decorativo, a entrada na partida não precisa liberar outro renderer ou contexto WebGL antes de criar o canvas PixiJS.

O AudioController usa Web Audio API e os WAV fornecidos. O primeiro gesto em Jogar cria/desbloqueia o AudioContext e inicia o carregamento sem bloquear os assets do Pixi. O GameEngine publica eventos tipados de feedback, separados dos snapshots e das regras; um ataque lateral gera um evento de arma mesmo criando três projéteis. O controlador traduz eventos em sons, controla sobreposição, variação, ambiente e alertas únicos. Pausa, abandono e conclusão interrompem o loop do oceano. A preferência de som é persistida em uma chave própria e não participa da configuração, do resultado nem do agrupamento do ranking.

## Sincronização da interface

O motor emite snapshots do HUD somente quando o tempo exibido, vida, pontuação, carga do especial ou estado mudam. Posições contínuas permanecem fora do React. O renderizador é atualizado pelo ticker. Listeners de foco e visibilidade do navegador pausam o motor; eles nunca o retomam automaticamente. Botões nativos e um diálogo modal fornecem controles semânticos. Mudanças na pontuação e na disponibilidade do especial são anunciadas de forma não intrusiva; movimento por frame e atualizações do cronômetro não são anúncios ao vivo.

## Armazenamento local

As opções são validadas na leitura e na escrita. Opções da versão 1 migram para a versão 2 com os recursos aprovados de vida e especial ativados. A preferência booleana de áudio usa armazenamento versionado separado. Resultados concluídos por tempo esgotado/morte são persistidos; sair do gameplay abandona a sessão. Falhas de armazenamento são retornadas à interface em vez de relatadas silenciosamente como sucesso. A configuração atual do resultado usa `survival-v2` e contém todos os parâmetros de armas, inimigos, surgimento, navegação, pickup, especial e feedback. Resultados existentes de `combat-v1` continuam válidos e preservam sua chave independente de ranking. Resultados anteriores, apenas de navegação, são rejeitados com um aviso explícito e não são excluídos durante a leitura.

## Canhões e colisão de projéteis

Ações tipadas cobrem disparos frontal/esquerdo/direito. Uma entrada mantida repete de acordo com cooldowns independentes no tempo da simulação. O disparo frontal cria um projétil; as laterais criam três projéteis paralelos de origens locais distintas no barco. As origens são rotacionadas para coordenadas do mundo no lançamento; depois, cada projétil preserva essa direção. Dano, raio, velocidade, tempo de vida, direção, origens e cooldown são configurados e incluídos no snapshot de cada partida. O alcance efetivo é velocidade × tempo de vida.

O movimento de um projétil verifica o segmento percorrido em cada passo fixo contra círculos expandidos pelo raio do projétil. O primeiro contato válido com alvo, ilha ou limite da arena remove o projétil e cria um efeito breve de impacto. O terreno vence empates exatos de contato, preservando a cobertura. Disparos do jogador consideram somente inimigos vivos; disparos inimigos consideram somente o jogador vivo. Segmentos do centro do barco até a boca do canhão usam as mesmas verificações de alvo/terreno. O movimento é limitado pelo tempo de vida restante antes da colisão; um projétil expirado não pode viajar além. Flashes de disparo, impactos, efeitos de destruição, flashes de dano e cooldowns usam o tempo da simulação e congelam durante pausa/conclusão. Disparos inimigos já lançados podem permanecer ativos depois que seu autor é destruído.

## Inimigos e surgimento seguro

Chasers giram e avançam em direção ao jogador, aplicando dano de contato uma vez antes de se autodestruírem. Shooters se aproximam, param na distância configurada, giram em direção ao jogador e disparam quando alcance, linha de visão, alinhamento e cooldown permitem. As taxas angulares e de movimento são baseadas no tempo. O movimento inimigo é resolvido contra a mesma geometria da arena/ilha usada pelo jogador.

Se a rota direta atravessar um colisor expandido da ilha, o inimigo escolhe persistentemente um lado de desvio horário/anti-horário e segue em direção a um waypoint ao redor da ilha com a folga configurada. Ele retoma a perseguição direta quando a rota fica livre. Isso é um desvio local para a arena atual, não uma malha de navegação geral. Barcos inimigos não bloqueiam uns aos outros durante o movimento.

O surgimento padrão alterna Chaser/Shooter. O primeiro ocorre depois do intervalo configurado. Uma busca limitada de candidatos usa posições aleatórias com seed nas bordas e verifica distância da arena/ilha, distância mínima do jogador e separação dos inimigos existentes. Buscas que falham tentam novamente depois de um atraso configurado. Surgimentos bem-sucedidos transferem o excesso do cronômetro para o próximo intervalo. Shooters recém-criados começam com o cooldown completo. Um ID de partida determina o seed de produção; configurações de teste fornecem um seed fixo.

## Ordem de dano, pontuação e conclusão

Cada passo atualiza o movimento do jogador, os cronômetros de feedback e o movimento/cooldowns dos inimigos. As armas do jogador disparam e depois as colisões dos projéteis são resolvidas. O contato do Chaser usa uma verificação por segmento com movimento relativo. Inimigos letalmente atingidos são ignorados imediatamente pela lógica de colisão/contato e removidos antes da fase de disparos inimigos. Somente a transição da vida inimiga positiva para zero, causada por disparos do jogador, concede um ponto e cria um efeito de destruição. A autodestruição por contato do Chaser nunca pontua.

Os disparos inimigos são executados apenas por barcos sobreviventes e contra um jogador vivo. A duração ativa avança e a conclusão é avaliada antes do surgimento. A morte vence a ocorrência simultânea de morte/tempo esgotado. Quando a vida chega a zero, projéteis/contatos posteriores não podem causar dano nem conceder pontos naquele passo. Atualizações concluídas são inertes e a conclusão é emitida uma vez. Resultados por morte preservam a duração ativa real; resultados por tempo esgotado usam a duração configurada. Uma nova sessão cria estado, cronômetros, gerador aleatório, pontuação e entidades novos.

## Pickups de vida e ataque especial

O agendamento, tempo de vida, colisão e cura do pickup, além da carga do especial, usam o tempo de simulação em passos fixos. Existe no máximo um coração. O posicionamento seguro rejeita terreno, inimigos próximos e posições perto demais do jogador. A vida cheia não consome o pickup; a coleta limita a vida ao máximo configurado. A pausa e a conclusão congelam o estado do pickup.

Somente mortes inimigas causadas por canhões avançam a carga do especial. A entrada registra uma solicitação na transição de subida, portanto manter R pressionado não pode consumir automaticamente uma carga futura. Um especial pronto é preservado quando não há inimigos. Um uso bem-sucedido destrói todos os inimigos vivos, remove projéteis inimigos, concede um ponto por inimigo destruído, redefine a carga e nunca conta as próprias mortes para a próxima carga. Dois anéis pulsantes acompanham o jogador enquanto a carga está pronta; sua animação deriva do tempo ativo da simulação e congela durante a pausa.

## Contratos da API e estado mock consistente

`api/contracts.ts` estende o resultado do motor com ID/nome do jogador persistidos localmente e uma chave canônica da configuração completa. A ordenação recursiva e estável das chaves do objeto identifica a configuração completa sem colisões de hash ou dependência da ordem das propriedades. Consultas de ranking carregam essa chave; consultas de histórico carregam o ID do jogador. A paginação e os corpos de registros/respostas são validados sem outra dependência. As datas usam strings ISO canônicas em UTC.

Handlers do MSW 3 são executados em desenvolvimento, teste e produção. O worker oficial é gerado em public/ e copiado para os builds. A configuração do navegador é lazy e single-flight, usando o caminho do worker relativo à base. A aplicação renderiza independentemente da inicialização da API; apenas as consultas de dados aguardam o estado pronto. Uma falha de inicialização permite nova tentativa e não impede o jogo. Frames não tratados são ignorados para que os assets continuem sendo recursos estáticos comuns.

O `MockMatchStore` persiste uma coleção de registros confirmados do usuário com uma revisão monotônica. O registro verifica o ID da partida e o payload completo de forma síncrona, retornando um registro idêntico existente ou HTTP 409 em caso de conflito. Ranking e histórico derivam dessa coleção e de fixtures determinísticas. As fixtures padrão representam oponentes; o cenário com múltiplas páginas adiciona explicitamente um histórico fictício do Captain. O cenário vazio oculta fixtures sem ocultar registros confirmados. Esses são mocks locais à origem do navegador, não um backend multiusuário compartilhado nem um banco de dados transacional entre abas.

O ranking ordena pela pontuação decrescente, data de conclusão crescente e, depois, ID crescente. O histórico ordena pela data decrescente e, depois, pelo ID. As fixtures e os grupos de configuração são idênticos em desenvolvimento, testes e demonstração. A redefinição limpa registros confirmados e recibos, restaura Sucesso e preserva identidade, preferências, último resultado e envios pendentes. Ela é bloqueada enquanto há envios em andamento.

## Axios, TanStack Query e respostas tardias

O cliente usa Axios com timeout de dois segundos e consome os AbortSignals das consultas. O TanStack Query controla consultas, mutations, cache, novas tentativas transitórias e invalidação. As chaves incluem recurso, filtro de configuração/jogador, cenário de rede selecionado e página. O cache permanece por cinco minutos, os dados ficam obsoletos depois de dez segundos e a exibição de uma aba os consulta novamente. Estados de carregamento/erro em segundo plano podem coexistir com dados previamente armazenados no cache.

Atualizações, mudanças de cenário, redefinições e invalidações após mutations bem-sucedidas cancelam leituras relevantes antes de consultar novamente. Um limite mínimo de revisão no cliente avança com as respostas observadas de consulta/registro. Uma página anterior a esse limite é consultada novamente uma vez ou descartada com erro visível, em vez de substituir dados confirmados mais novos. Respostas inválidas ou incompatíveis de páginas/registros são rejeitadas. Novas tentativas de consulta permitem uma tentativa adicional para falhas transitórias de rede/5xx; falhas 4xx/de contrato não são repetidas automaticamente.

## Ciclo de vida durável dos envios

O DataProvider permanece montado entre menus, resultados e gameplay. Seu callback de conclusão é estável, portanto atualizações da fila em segundo plano não recriam o motor. Ele adiciona metadados do jogador fora do motor e persiste um registro pendente completo antes que a mutation do TanStack envie o HTTP. Um conjunto em memória impede envios simultâneos do mesmo ID; a idempotência do backend cobre atualização, novas tentativas e respostas perdidas. Várias partidas diferentes podem ficar pendentes independentemente.

Ao receber a confirmação, um recibo local é salvo antes de remover aquele registro pendente. Falhas de escrita do recibo/fila preservam um resultado pendente que permite nova tentativa. Na recarga, registros pendentes recebem uma tentativa inicial depois da configuração do mock; recuperações posteriores usam controles explícitos de nova tentativa. Uma falha no armazenamento da fila impede o envio e é exibida sem alegar durabilidade. Partidas/opções continuam acessíveis. Resultados anteriores à integração da API podem ser registrados por uma ação explícita de Registrar partida; não há migração automática dos resultados legados.

Cenários de rede são persistidos separadamente das preferências do jogo. O comportamento é capturado no início da requisição e a latência é programada por recurso. O cenário de resposta perdida faz o commit antes do atraso, reproduzindo a ambiguidade real de uma escrita que excede o tempo limite. A recuperação retorna o mesmo registro. A seleção de cenário não apaga dados confirmados ou pendentes.

## Testes

O motor pode ser testado sem navegador, React, Pixi ou serviços. A configuração do construtor aceita fixtures iniciais com seed; ela não permite injetar dano/pontuação durante a execução. O gameplay normal usa surgimento automático. Testes da persistência mock usam objetos StoragePort em memória. Testes dos handlers usam diretamente `getResponse` do MSW; testes de integração Axios/Query usam a interceptação do MSW Node com erros estritos para frames não tratados, sem sockets de rede e sem serviços reais. Um timeout real no cliente depois do commit é testado junto à recuperação de revisão e ao cancelamento.

O Playwright usa um servidor iniciado externamente. Um build de teste dedicado seleciona cenários iniciais de gameplay, expõe cópias do estado e congela o tempo automático antes do início para impedir que mortes das fixtures disputem com a configuração. O avanço do relógio ainda executa regras e renderização reais. Builds normais de produção excluem a configuração de testes do gameplay, mas preservam os mocks obrigatórios da API e os cenários de rede. Verificações de navegador, baselines visuais, relatórios/traces e profiling são executados pelo usuário e registrados separadamente das verificações estáticas.

## Referências visuais

Uma configuração separada do Playwright isola relatórios/saídas visuais das execuções funcionais. Cenas de menu, arena e resultado usam hora/localidade/fuso horário fixos, armazenamento isolado do navegador, entidades iniciais determinísticas e entradas/regras reais com relógio controlado. Os caminhos dos PNG incluem plataforma e projeto para desktop/dispositivo móvel. A geração de referências ausentes não sobrescreve baselines existentes. A execução no navegador e a revisão das referências continuam sob responsabilidade do usuário.

## Profiling opcional

O build normal ativa profiling somente com `profile=1`. O FrameStatistics usa intervalos brutos decorridos, FPS médio ponderado, p95 pelo posto mais próximo e contagens observadas de entidades. A ProfileSession registra uma amostra de entidades por segundo ativo e o pico de cada frame; depois, limpa os arrays de intervalos brutos após resumi-los. A gravação é silenciosa: snapshots do React são atualizados apenas em eventos do ciclo de vida dos recursos, checkpoints, conclusão ou captura explícita.

A posse de renderizador/entrada/HUD é rastreada com leases idempotentes de recursos. Os contadores cobrem controladores do jogo, canvases anexados, callbacks do ticker, observadores, quatro listeners de entrada do DOM e três inscrições. Eles auxiliam a contabilização, mas não medem memória da GPU nem detectam completamente vazamentos no navegador. Texturas compartilhadas, caches do Query, registros da API e relatórios compactos de profiling permanecem intencionalmente.

Os metadados do navegador incluem build, user agent, viewport/DPR, tamanho real do canvas/backing buffer, resolução, enum do renderizador e quantidade de texturas selecionadas. Estimativas opcionais de `performance.memory` complementam snapshots manuais do DevTools. Um observador global somente de leitura expõe cópias das evidências apenas em builds normais com adesão explícita. Dados de profiling não são persistidos no armazenamento do jogo nem enviados a serviços. A referência de hardware e a exportação do JSON são ações do usuário. A cobertura de três minutos exige build otimizado, canvas, simulação ativa concluída de 180 segundos e amostras brutas correspondentes; não representa aprovação automática de desempenho. Consulte docs/PROFILING.md para as evidências pendentes.
