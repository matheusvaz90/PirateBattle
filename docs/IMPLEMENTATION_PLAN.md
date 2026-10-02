# Plano de implementação

## Regras de execução

Construa cedo uma versão jogável e depois a refine. Trabalhe em um marco pequeno por vez. Leia este documento, README.md, ARCHITECTURE.md, PROGRESS.md e as instruções aplicáveis de AGENTS.md antes das alterações. Preserve o trabalho do usuário. Use inglês no código, TypeScript estrito e nenhum comentário-fonte ou desvio inseguro de tipagem. Não adicione dependências sem aprovação. Não execute servidores da aplicação, testes dependentes de navegador, bancos de dados reais ou operações de Git/deploy não autorizadas.

O agente implementa e executa as verificações isoladas/estáticas permitidas. O usuário inicia a aplicação, avalia o gameplay, executa testes de navegador e registra evidências de profiling. Nunca declare uma verificação de navegador sem resultados.

## Decisões fixas

- O React controla telas, diálogos, HUD semântico, opções e botões de toque.
- Um motor independente de framework controla posições, vida, combate, tempo de simulação, surgimento e pontuação.
- O PixiJS 8 controla os objetos visuais e projeta o estado do motor. Não há wrapper React para Pixi.
- O menu usa React/CSS e assets estáticos oficiais; gameplay e indicadores permanecem integralmente no PixiJS.
- A Web Audio API reproduz os WAV fornecidos a partir de eventos tipados do motor. A preferência de som não altera a configuração da partida.
- Teclado, joystick e botões de ataque compartilham ações tipadas; o mouse fornece um destino tipado com propulsão manual, mantendo as origens de entrada independentes.
- Snapshots do React são atualizados apenas em mudanças significativas, não a cada frame.
- Passo fixo de simulação: 1/60 de segundo. Pausar limpa as entradas e o acumulador.
- Arena lógica: 1280 × 720, dimensionada com letterbox. O redimensionamento nunca altera as regras.
- Coordenadas: X para a direita, Y para baixo, direção zero para a direita, radianos e sentido horário positivo.
- Colisores simples de barcos/ilha; segmentos dos projéteis resolvem o primeiro impacto válido.
- Menus em React/CSS com imagens oficiais, Vite, sem roteador ou biblioteca de estado.
- Opções: duração de 60–180 segundos (padrão 120), intervalo de surgimento de 1–10 segundos (padrão 4).
- Cada partida recebe um snapshot de configuração independente.

## Marcos e aceitação

### 1. Fundação

Configuração, scripts, assets, navegação mínima, carregamento/erro/nova tentativa, inicialização e desmontagem do Pixi. Verificações estáticas e build passam. Navegações repetidas não podem duplicar canvases. Tratar o Strict Mode e a inicialização assíncrona cancelada pela desmontagem.

### 2. Navegação jogável

Motor/configuração tipados, loop fixo, movimento, rotação, limites, uma ilha, teclado, leme por mouse com propulsão por W, joystick móvel fora da arena com múltiplos ponteiros para navegação/ataque, redimensionamento, observação exclusiva de teste e relógio controlado. O usuário testa movimento em curva, contato com obstáculos, contato com bordas e layout móvel. Publicar snapshots apenas quando o estado exibido mudar.

### 3. Combate

Ataque frontal: um projétil. Ataques laterais: três projéteis paralelos de origens diferentes. Cooldowns independentes, velocidade, dano, tempo de vida, colisão por segmento no primeiro impacto, filtragem por facção, remoção de entidades destruídas e pontos concedidos exatamente uma vez. Adicionar feedback de disparo/impacto e barras de vida dos barcos. Os testes devem acionar entradas reais; não contorne colisões nem conceda pontos diretamente.

Entregue este marco em duas etapas jogáveis. Primeiro adicione os canhões do jogador, colisão com obstáculos, feedback, ações de teclado/toque e testes de pausa/reinício para que o usuário possa avaliar os disparos. Depois adicione alvos inimigos e resolva dano/pontuação junto ao comportamento dos inimigos no marco 4. Apenas os canhões não concluem todos os requisitos do marco 3. Os parâmetros existentes de movimento/visual foram aprovados pelo usuário e devem ser preservados, salvo quando um novo feedback exigir alterações.

### 4. Partida local completa

Perseguição/contato e autodestruição do Chaser sem pontuação; aproximação/alcance/cooldown do Shooter. Rotação configurada, desvio de obstáculos, ambos os tipos no surgimento padrão, locais seguros de surgimento e adiamento quando não existir local válido. Adicionar morte/tempo esgotado, pausa manual/por foco/visibilidade, retomada explícita, resultados, abandono, reinício limpo, explosão e deterioração baseada na vida. Entidades mortas não produzem efeitos. A conclusão é emitida uma vez e congela o gameplay. Não avance além do fim configurado. Documente a precedência entre morte e tempo esgotado simultâneos.

### 5. Produto e opções

Opções persistentes validadas, configuração independente por partida, menus/instruções, último resultado persistido acessível a partir do menu, inicialização previsível no menu, HUD semântico, diálogos/foco/mensagens de erro acessíveis e controles móveis em retrato/paisagem. Tente um deploy antecipado autorizado e verifique os caminhos reais dos assets e o Service Worker antes da entrega final.

### 6. Ranking e histórico

Contratos tipados, Axios, TanStack Query, MSW em desenvolvimento/teste/produção, registros confirmados persistentes, paginação e estados de carregamento/vazio/erro/atualização em segundo plano. As duas abas derivam de um único armazenamento confirmado. O ranking agrupa a configuração completa do gameplay e a versão de balanceamento. Desempate: pontuação decrescente, data de conclusão crescente e ID da partida crescente. Inclua todos os filtros nas chaves de consulta, consuma AbortSignal, cancele leituras obsoletas ao atualizar depois de escritas, invalide ambas as abas depois do registro e atualize as abas quando forem exibidas.

### 7. Envios confiáveis e falhas

Crie uma única vez um ID estável para a partida. Persista o envio pendente completo antes do HTTP. Envie por uma mutation do TanStack. O MSW retorna um registro existente para IDs duplicados. Remova um item pendente apenas depois da confirmação e invalide as consultas. Mantenha várias partidas pendentes; atualização/nova tentativa/novas partidas devem funcionar de forma independente. Persista a conclusão pela lógica da aplicação, não por efeitos de montagem da tela de resultado.

Cenários: sucesso, vazio, múltiplas páginas, latência lenta/variável, fora de ordem, timeout, falha de conexão, 4xx/5xx, falha apenas no ranking/histórico, commit seguido de resposta perdida, indisponibilidade na conclusão e recuperação. Use seed/latência programada. Forneça seleção/redefinição. Mantenha a redefinição do cenário separada das preferências, resultados e registros pendentes. Valide entradas armazenadas e externas sem outra biblioteca de schema.

### 8. Verificação e entrega

Conclua E2E no Chromium para desktop/dispositivo móvel, baselines de menu/arena/resultado, documentação, profiling otimizado de três minutos e cinco ciclos de iniciar/jogar/sair para memória/recursos. Meça intervalos reais entre frames, FPS, p95 e entidades. Registre hardware/navegador/resolução/configuração e limitações. Não adicione pooling ou indexação espacial sem medições. Deploy público e reprodução a partir de um checkout limpo são obrigatórios.

## Matriz de cobertura de testes

1. Navegação e validação/persistência das opções.
2. Carregamento/falha/nova tentativa dos assets.
3. Movimento/rotação/arena/ilha.
4. Ataques frontal/laterais, dano, cooldowns e pontuação sem duplicação.
5. Chaser/Shooter/intervalo de surgimento.
6. Tempo esgotado/morte/conclusão congelada/reinício limpo.
7. Pausa manual/por foco e retomada explícita.
8. Persistência de resultados.
9. Abandono/navegação repetida/toque.
10. Paginação/carregamento/vazio/erro do ranking/histórico.
11. Registro/invalidação/recuperação de pendências.
12. Deduplicação após resposta perdida/respostas obsoletas.

Cada teste usa armazenamento isolado e configuração reproduzível. Builds de teste podem selecionar cenários iniciais, observar cópias do estado, controlar o tempo e congelar capturas de tela. Eles devem preservar entradas/regras/colisões/renderização reais. Não inclua a API de teste no build normal de produção. Forneça relatórios HTML e traces de falhas. Adicione testes com cada regra, não todos no final.

## Disciplina de escopo

Simplifique primeiro os visuais, o tamanho/complexidade da arena, as animações e o áudio opcional. Preserve ambos os inimigos, todos os ataques, pausa, ciclo de vida, dispositivos móveis, persistência, APIs, idempotência, falhas obrigatórias, testes, evidências e deploy. Protótipos intermediários não representam a conclusão final.

## Transição

Atualize PROGRESS.md com o marco atual, comportamento implementado, verificações reais, validação do usuário, problemas conhecidos e uma próxima tarefa concreta. Diferencie o que foi implementado do que foi verificado. Não reformule a arquitetura concluída sem necessidade. Cada entrega inclui comportamento/arquivos alterados, verificações, um procedimento curto de teste para o usuário e a próxima tarefa.
