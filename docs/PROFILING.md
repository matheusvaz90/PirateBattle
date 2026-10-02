# Procedimento e evidências de profiling

## Estado das evidências

A instrumentação está implementada. O agente não coletou profiling em navegador real, partida de referência de três minutos, investigação de memória nem evidências de hardware. Testes sintéticos em Node verificam apenas cálculos e contabilização. Não apresente esses testes como evidência de 60 FPS ou ausência de vazamentos.

## Configuração de referência

Use o Chromium e um build normal e otimizado de produção. Um build de teste congela a simulação e não é adequado para medições de taxa de frames. Builds de desenvolvimento também são marcados como não referenciais.

```sh
npm run build
npm run preview
```

Abra **http://localhost:4173/?profile=1**. Sem esse parâmetro, o coletor não cria sessões nem retém amostras de frames. O observador somente de leitura no console está disponível apenas em builds normais com adesão explícita, como `window.__PIRATE_PROFILE__.snapshot()`. Ele não pode mover barcos, alterar vida/pontuação nem avançar a simulação.

Defina o cenário de rede como Sucesso. Use uma viewport estável e mantenha o navegador em primeiro plano. Registre CPU, RAM, GPU, sistema operacional, versão do navegador, viewport, taxa de atualização da tela, extensões e condições de energia. A exportação captura user agent, modo do build, configuração, viewport/DPR iniciais e o último tamanho/resolução do canvas e de seu backing buffer. Os detalhes do hardware devem ser fornecidos manualmente.

## Renderizações do React

O flamegraph de componentes exige o React DevTools e deve ser gravado pelo usuário em um build de desenvolvimento. Ele serve para identificar propriedade e motivo das renderizações, não para comparar tempos absolutos com produção. O Strict Mode pode repetir inicializações e efeitos no desenvolvimento; diferencie essa verificação deliberada de atualizações que continuam depois da montagem.

1. Execute `npm run dev`, abra `http://localhost:5173` e selecione a aba **Profiler** do React DevTools.
2. Ative o registro do motivo de cada renderização quando essa opção estiver disponível.
3. Grave separadamente a abertura do menu até ranking e API estabilizarem.
4. Grave a troca entre Ranking e Histórico, uma paginação, uma atualização e uma mudança de cenário de rede.
5. Grave 15–20 segundos de gameplay com joystick ou mouse, canhões, uma pausa e uma retomada.
6. Grave a conclusão de uma partida e a transição de registro entre envio, confirmação ou erro recuperável.
7. Exporte cada gravação com nomes que identifiquem o cenário e preserve os arquivos junto às demais evidências.

Movimento do ponteiro, frames do PixiJS e arrasto do joystick não devem gerar commits React por frame. Durante a partida são esperadas atualizações quando muda o segundo exibido, vida, pontuação, carga do especial, estado, carregamento ou erro. Investigue primeiro renderizações de `App` e consumidores não relacionados quando apenas pendências ou rede mudarem; depois avalie `GameScreen` se os commits limitados ao HUD apresentarem duração relevante.

Use a aba **Performance** do Chromium no build otimizado para complementar o flamegraph com custo real da thread principal, layout, pintura, tarefas longas e trabalho do PixiJS. Não aplique `memo`, `useMemo`, `useCallback` ou divisão de contexto apenas por contagem: compare duração, frequência e motivo antes e depois de cada otimização.

## Medição de combate de três minutos

1. Em Opções, salve uma sessão de **180 segundos** e documente o intervalo de surgimento. O padrão é 4 segundos; intervalos menores podem fornecer uma configuração de estresse separada.
2. Jogue uma partida curta de aquecimento para carregar as texturas e inicializar a renderização; depois, volte ao menu.
3. Inicie uma nova partida e jogue normalmente durante os 180 segundos ativos. Use entradas reais de teclado/toque. Não use o relógio controlado de teste nem modifique a vida para fabricar cobertura.
4. Pausas são excluídas. Retome explicitamente. O primeiro frame depois da inicialização/retomada é descartado para impedir que tempo inativo obsoleto entre na simulação ou nas medições.
5. Se o barco morrer antes do fim, mantenha o resultado parcial como limitação e tente novamente para obter cobertura completa. Uma morte antecipada ou partida abandonada não constitui um benchmark completo de três minutos.
6. Na tela de resultado, inspecione as evidências de desempenho, informe a referência de hardware e exporte o JSON. Inspecione FPS real, p95, intervalo máximo, quantidade de frames lentos, pico de entidades e a linha do tempo de entidades por segundo ativo.
7. Um relatório é marcado como execução otimizada de três minutos somente quando existem um build normal de produção, canvas renderizado, sessão concluída de 180 segundos e ao menos 180 segundos de intervalos observados entre frames ativos. Esse marcador indica cobertura, não aprovação de desempenho.
8. Capture um trace de Performance do navegador para essa execução de referência ou outra equivalente e documentada. Mantenha condições consistentes; o tracing e o DevTools aberto podem afetar o desempenho. Focar o DevTools pode pausar automaticamente o gameplay; retome depois de devolver o foco e documente a configuração.

A meta é **60 FPS**. A média de FPS é `frameCount × 1000 / sum(rawIntervalsMs)`. O p95 usa seleção pelo posto mais próximo nos intervalos brutos ordenados. Travamentos ativos genuínos são incluídos, mesmo quando a recuperação da simulação é limitada. O espaçamento do ticker não representa o tempo de execução da GPU nem garante a apresentação de todos os frames; a análise do trace o complementa.

O total de entidades conta jogador, inimigos, projéteis e efeitos transitórios. Água, ilhas e elementos visuais estáticos do HUD são excluídos. O pico global é capturado em cada frame amostrado; as entradas da linha do tempo mostram as contagens mais recentes de cada segundo ativo. A aleatoriedade normal do surgimento deriva do ID exportado da partida.

## Cinco ciclos de iniciar/jogar/sair para memória

Mantenha aberta a mesma página otimizada. Não atualize antes de exportar: as evidências de profiling ficam na memória e, intencionalmente, não são gravadas no armazenamento do jogo.

1. Aqueça a renderização e volte ao menu.
2. Use o rótulo **Baseline aquecida** e capture um checkpoint nas evidências de desempenho.
3. Inicie uma partida, jogue tempo suficiente para criar inimigos/projéteis (ao menos 10–20 segundos) e escolha Menu principal. Aguarde os assets antes de jogar; teste separadamente o cancelamento da inicialização caso esteja investigando esse ciclo de vida.
4. Aguarde a limpeza terminar e capture **Depois do ciclo 1**.
5. Repita mais quatro vezes, capturando de Depois do ciclo 2 até Depois do ciclo 5. Mantenha duração/ações comparáveis.
6. Os checkpoints no menu devem retornar a zero os leases controlados pelo jogo para controladores de renderização, canvases anexados, callbacks do ticker, ResizeObservers, controladores de entrada, quatro listeners de entrada e inscrições do motor. Uma sessão totalmente montada controla atualmente três inscrições do motor.
7. Investigue contadores que não voltarem a zero. Eles são contadores explícitos, não descoberta automática de todos os objetos do navegador; contadores zerados, isoladamente, não comprovam ausência de vazamentos.
8. Use snapshots e ferramentas de alocação da aba Memory do Chromium DevTools antes/depois dos ciclos. Quando for viável, obtenha snapshots comparáveis depois do GC. Inspecione canvases, controladores, closures/listeners, objetos visuais retidos e crescimento contínuo. Registre capturas/traces e sua interpretação.
9. Exporte o JSON depois do ciclo 5.

Estimativas de `performance.memory` são incluídas quando disponíveis; caso contrário, aparecem como indisponíveis. São estimativas aproximadas do heap JavaScript, dependentes do navegador, e excluem a memória da GPU. A aplicação retém intencionalmente um cache limitado de texturas, cache/mutations do Query, resultados locais e relatórios compactos de profiling. Diferencie retenção esperada de vazamentos contínuos. Os arrays brutos de frames são limpos depois do resumo. Não há GC forçado nem medição implementada da memória da GPU.

## Armazenamento e revisão dos artefatos

O navegador baixa `pirate-battle-profile-<timestamp>.json`. Depois da revisão, inclua os JSON relevantes, traces de Performance e capturas de Memory em um diretório `docs/evidence/` escolhido e crie links abaixo. Não invente artefatos nem preencha resultados com testes sintéticos.

As referências visuais ficam separadas, em `tests/visual/baselines/<platform>/<project>/`. Testes de API/armazenamento não comprovam a qualidade de frames ou memória.

## Relatório de entrega: preencher com observações reais

| Campo | Valor observado |
| --- | --- |
| Estado das evidências | Execução do usuário pendente |
| Hardware / CPU / RAM / GPU | Não informado |
| Sistema operacional / versão do navegador | Não informado |
| Viewport / canvas / resolução do backing buffer / DPR | Não medido |
| Taxa de atualização da tela / condições de energia | Não informado |
| Build e data | Não registrados |
| Sessão / intervalo de surgimento / configuração completa | Não registrados |
| 180 segundos ativos completos | Não verificado |
| FPS médio / p95 / intervalo máximo entre frames | Não medidos |
| Pico de entidades / artefato da linha do tempo | Não coletados |
| Cinco ciclos comparáveis de iniciar/jogar/sair | Não verificados |
| Recursos controlados depois da baseline/de cada ciclo | Não medidos |
| Snapshots do heap / interpretação dos objetos retidos | Não coletados |
| JSON / trace / capturas de tela | Não coletados |
| Limitações e ações de acompanhamento | Aguardando evidências |
