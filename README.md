# Pirate Battle

Um jogo arcade naval desenvolvido de forma incremental para o [desafio da Jungle Gaming](https://github.com/junglegaming/game-developer-challenge).

## Jogue online

Acesse a versão publicada: [Pirate Battle no Cloudflare](https://piratebattle.matheusvaz90.workers.dev/).

## Versão atual

A partida para um jogador, os itens de recuperação de vida, o ataque especial carregado, o áudio, o ranking e o histórico paginados, os envios pendentes persistentes e os cenários reproduzíveis de falha de rede estão implementados. React controla a interface, PixiJS renderiza exclusivamente o gameplay e os assets oficiais formam o menu inicial estático; TanStack Query e Axios consomem APIs REST interceptadas pelo MSW. A versão pública anterior está hospedada no Cloudflare, mas o redesign local ainda não foi publicado. Evidências atualizadas de navegador, análise de desempenho e acabamento final continuam pendentes. Consulte [o plano de implementação](docs/IMPLEMENTATION_PLAN.md) e [o progresso atual](docs/PROGRESS.md) antes de continuar o desenvolvimento.

## Comece aqui: execute o jogo

Você não precisa de um editor de engine de jogos nem de um backend. O jogo é executado em um navegador. Node.js e npm instalam e executam as ferramentas de desenvolvimento.

### 1. Baixe o projeto

Instale o [Git](https://git-scm.com/downloads) caso ele ainda não esteja disponível. Abra um terminal na pasta onde deseja manter o projeto e clone este repositório:

```sh
git clone https://github.com/matheusvaz90/PirateBattle.git
cd PirateBattle
```

Execute todos os comandos abaixo a partir da pasta `PirateBattle`, que contém `package.json`.

Como alternativa, selecione **Code → Download ZIP** no GitHub, extraia o arquivo e abra um terminal na pasta extraída. Você pode abrir o projeto no editor de sua preferência e usar o terminal integrado dele.

### 2. Verifique o Node.js

```sh
node --version
npm --version
```

Use uma versão compatível do Node.js, 22.12 ou posterior. Recomenda-se o Node.js 24 LTS. Se os comandos não forem encontrados, instale o Node.js por [nodejs.org](https://nodejs.org/) e reabra o terminal.

### 3. Instale as dependências

```sh
npm ci
```

Esse comando baixa para `node_modules` os pacotes listados em `package-lock.json`. Execute-o após obter uma cópia nova do repositório ou atualizar uma dependência. Não é necessário repeti-lo sempre que abrir o jogo.

### 4. Inicie o servidor de desenvolvimento

```sh
npm run dev
```

Mantenha esse terminal aberto. No navegador, acesse **http://localhost:5173** e selecione **Jogar**. O navegador recebe atualizações automaticamente quando os arquivos-fonte são salvos.

Para encerrar o servidor, pressione **Control + C** nesse terminal.

Não abra `index.html` diretamente: o projeto precisa do servidor Vite para resolver TypeScript e módulos.

### 5. Teste no celular

Conecte o celular e o computador à mesma rede Wi-Fi. Com `npm run dev` em execução, abra no celular a URL de **Network** exibida pelo Vite. `localhost` no celular se refere ao próprio celular, não ao computador.

Retrato e paisagem são suportados, mas a orientação paisagem oferece uma arena maior. Segure e arraste sobre o mar para navegar; o barco segue o dedo com a velocidade, rotação e colisões normais e para quando o toque termina. O deck de canhões abaixo da arena aceita pressionamentos simultâneos sem cobrir a batalha. Se a URL de rede estiver inacessível, verifique o firewall do computador e se a rede Wi-Fi permite a comunicação entre dispositivos.

Para ter suporte confiável a Service Worker em um celular físico, use a versão publicada com HTTPS. Um endereço HTTP simples da rede local pode não oferecer suporte ao worker simulado; a interface informa erros de configuração da API, e a jogabilidade continua disponível. Localhost e HTTPS são os ambientes de referência para as APIs.

## Controles

| Ação | Teclado | Ponteiro/toque |
| --- | --- | --- |
| Navegar | Mover o mouse para guiar; segurar W ou ↑ para avançar; A/D ou ←/→ para virar | Segurar e mover sobre a arena |
| Ataque frontal | Espaço | Atirar à frente (botão Frente) |
| Ataque lateral esquerdo | Q | Atirar à esquerda (botão de ataque esquerdo) |
| Ataque lateral direito | E | Atirar à direita (botão de ataque direito) |
| Ataque especial | R | Especial |
| Pausar | Escape | Pausar |

No computador, o cursor sobre a arena funciona como leme e não exige clique: ele orienta o navio com uma resposta 20% mais suave que a rotação direta do teclado, enquanto W ou a seta para cima controla o avanço. A/D e as setas laterais continuam disponíveis e têm prioridade enquanto estão pressionadas. No celular, manter um toque sobre a arena orienta e movimenta o navio; soltar interrompe o avanço. Nenhum dos dois modos arrasta ou teleporta o navio: o motor preserva rotação, velocidade e colisões. O navio não dá ré. Segure um ataque para repeti-lo no intervalo configurado. Movimento, rotação e todos os ataques podem ser combinados. Cada arma tem um tempo de recarga independente.

O canhão frontal lança um projétil. Cada ataque lateral lança três projéteis paralelos de posições separadas ao longo do navio. Esquerda e direita são relativas à direção do navio, não à tela. Os projéteis desaparecem no primeiro impacto válido contra um alvo, uma ilha ou o limite da arena, ou quando seu tempo de vida termina. Os disparos do jogador só causam dano aos inimigos; os disparos inimigos só causam dano ao jogador.

Trocar de aba ou tirar o foco do jogo pausa a partida. Selecione **Continuar** explicitamente para prosseguir. Sair do combate abandona a sessão atual.

O som é ativado após a primeira seleção de **Jogar**, conforme a política de autoplay dos navegadores. O botão **Som ativo/Sem som** no cabeçalho silencia ambiente e efeitos e salva essa preferência separadamente das opções de balanceamento. A partida usa os arquivos WAV fornecidos pela Jungle Gaming para oceano, canhões, impactos, colisões, explosões, alertas e estados da sessão.

## Verificação da jogabilidade

1. Selecione Jogar e espere a arena carregar.
2. Segure W; o navio deve avançar.
3. Segure W e D ao mesmo tempo; o navio deve virar enquanto se move.
4. Tente avançar contra a ilha e as bordas da arena; nenhuma delas deve ser atravessada.
5. Pressione Escape; o cronômetro deve parar. Continue e verifique que nenhum pressionamento antigo de tecla permanece ativo.
6. Troque de aba no navegador e retorne; o jogo ainda deve estar pausado.
7. Volte ao menu e jogue novamente; o navio e o cronômetro devem ser reiniciados.
8. Salve as opções, atualize a página e verifique que elas continuam salvas.
9. Segure Espaço enquanto se move e vira; os disparos frontais devem seguir a direção do navio no momento do lançamento.
10. Pressione Q e E; cada lado deve lançar três balas de canhão paralelas.
11. Segure as três teclas de ataque; cada arma deve repetir seu ataque de forma independente.
12. Atire em direção à ilha; os disparos devem parar com um efeito visível de impacto, em vez de atravessá-la.
13. Pause com disparos em movimento; as posições, os efeitos e os tempos de recarga devem parar. Continue sem pressionar o ataque novamente; uma entrada antiga mantida pressionada não deve voltar a disparar.
14. No computador, mova o cursor sem pressionar W e confirme que o navio apenas gira; segure W e confirme que ele avança na direção apontada.
15. No celular em retrato e paisagem, arraste sobre a arena com um dedo e pressione um canhão no deck inferior com outro. Confirme que os botões não cobrem a arena. Inicie uma nova sessão e verifique que nenhum projétil da sessão anterior permanece.
16. Espere os Perseguidores de velas vermelhas e os Atiradores de velas com caveira. Os Perseguidores perseguem e explodem ao contato; os Atiradores se aproximam e disparam quando estão ao alcance.
17. Destrua um navio com seus canhões. Ele deve explodir, deixar de participar da partida e conceder exatamente um ponto.
18. Deixe um Perseguidor colidir com você. A vida deve diminuir, o Perseguidor deve desaparecer e a pontuação não deve aumentar.
19. Sofra impactos e observe as barras de vida, o clarão de impacto e a aparência danificada do navio. Ao chegar a zero de vida, o resultado deve mostrar Navio destruído e o tempo real jogado.
20. Altere o intervalo de surgimento, inicie uma nova partida e observe a nova frequência de chegada. Os inimigos devem surgir longe de obstáculos e a uma distância suficiente do jogador.
21. Reinicie após a morte ou o fim do tempo; vida, pontuação, chegada de inimigos e todas as entidades devem ser reiniciadas.
22. Com Corações de vida ativados, espere 15 segundos ativos. Um coração deve aparecer por 10 segundos, continuar disponível quando a vida estiver cheia e restaurar até 20 de vida quando coletado com a vida atual abaixo do máximo.
23. Com Ataque especial ativado, destrua cinco inimigos com canhões. O HUD e o botão de toque devem mostrar Pronto, e dois anéis pulsantes dourados e verdes devem formar uma aura ao redor do navio; pressione R ou Especial para destruir todos os inimigos visíveis e remover disparos hostis.
24. Verifique que os inimigos destruídos pelo especial concedem pontos, mas não o recarregam, e que usá-lo em uma arena vazia não consome a carga.
25. Com o som ativo, verifique oceano, canhões, impactos, explosões, pausa, retomada e conclusão. Silencie no cabeçalho, atualize a página e confirme que a preferência permanece salva.
26. Depois de concluir uma partida, atualize a página. O menu principal deve abrir, e o pós-batalha persistido deve continuar acessível por **Último resultado**.

Comentários úteis incluem pressão dos inimigos, distância segura de surgimento, comportamento de perseguição e desvio, dano, legibilidade dos projéteis e posicionamento dos botões no celular. Os intervalos de movimento e dos canhões foram aprovados durante iterações anteriores e permanecem inalterados.

## Opções e balanceamento

- Duração da partida: 60–180 segundos; padrão 120.
- Intervalo de surgimento dos inimigos: 1–10 segundos; padrão 4. O primeiro inimigo chega depois desse intervalo e os inimigos seguintes chegam no mesmo intervalo.
- Corações de vida: ativados por padrão. Um coração pode ficar ativo por vez, aparece a cada 15 segundos de simulação ativa, dura 10 segundos e restaura 20 de vida sem ultrapassar 100. Ele não é consumido enquanto a vida atual estiver cheia.
- Ataque especial: ativado por padrão. Cinco eliminações com canhões carregam um uso armazenado; R ou o botão de toque destrói todos os inimigos vivos e remove projéteis hostis. Quando está Pronto, uma aura de dois anéis pulsantes acompanha o navio.
- As opções são mantidas no armazenamento local do navegador.
- Cada sessão recebe sua própria cópia da configuração.
- Os parâmetros de balanceamento ficam em `src/game/config.ts`.

| Arma | Recarga | Velocidade (unidades lógicas/s) | Tempo de vida | Distância máxima percorrida |
| --- | --- | --- | --- | --- |
| Frontal | 0.45s | 520 | 1.4s | 728 unidades |
| Ataque lateral esquerdo/direito | 0.95s | 450 | 1.2s | 540 unidades |

A distância percorrida é calculada pela velocidade × tempo de vida. Obstáculos podem reduzi-la. Disparos frontais causam 25 de dano; cada projétil lateral causa 18 de dano. O jogador começa com 100 de vida. Cada inimigo destruído pelos ataques do jogador ou pelo especial concede 1 ponto; a autodestruição de um Perseguidor ao contato não concede nenhum. Somente eliminações com canhões carregam o especial, portanto as eliminações causadas por ele não podem criar uma sequência de recargas.

| Inimigo | Vida | Velocidade de movimento | Ataque |
| --- | --- | --- | --- |
| Perseguidor (velas vermelhas) | 50 | 110 unidades lógicas/s | 25 de dano ao contato e depois se autodestrói |
| Atirador (velas com caveira) | 75 | 85 unidades lógicas/s | Bala de canhão com 12 de dano, recarga de 1.6s e alcance de ataque de 400 unidades |

A velocidade de movimento do jogador permanece em 200 unidades/s. A distribuição padrão de surgimento alterna entre Perseguidor e Atirador. Os inimigos surgem a pelo menos 320 unidades do jogador, longe de obstáculos e de inimigos existentes. Se nenhum local seguro estiver disponível, uma nova tentativa ocorre após 0.5s, em vez de forçar um posicionamento inseguro. Um Atirador recém-criado espera sua recarga inicial antes de atacar. Os inimigos giram com velocidade limitada e seguem pontos de desvio locais ao redor das ilhas; não há busca de caminho em grade nem bloqueio entre navios.

Uma partida termina quando o tempo acaba ou a vida chega a zero. O dano letal tem precedência se ambos ocorrerem na mesma etapa da simulação. Os resultados concluídos armazenam a duração ativa real, a pontuação obtida, o motivo do fim e a configuração completa com a versão de balanceamento `survival-v2`. Os resultados existentes de `combat-v1` continuam legíveis e entram em rankings separados; as opções salvas antes desta atualização migram com os dois recursos aprovados ativados. Os resultados dos protótipos anteriores, que tinham apenas navegação, ainda geram um aviso explícito. Atualizar a página sempre abre o menu principal e mantém o resultado concluído acessível por **Último resultado**; atualizar durante o combate ou sair dele abandona a sessão atual e nunca cria um resultado para ela.

Não há variáveis de ambiente nem serviços externos obrigatórios. O armazenamento local é específico para cada navegador e origem; desenvolvimento e pré-visualização usam portas diferentes e, portanto, armazenamentos diferentes.

## Ranking, histórico e registro de partidas

Role a página abaixo dos controles do menu para encontrar **Ranking** e **Histórico de partidas**. As páginas contêm cinco registros. O Ranking compara a cópia completa da configuração, independentemente da ordem das propriedades do objeto, e ordena por pontuação decrescente, data de conclusão crescente e ID da partida crescente. Alterar as opções seleciona um grupo de comparação diferente. O histórico mostra as partidas confirmadas do jogador local, das mais recentes para as mais antigas, com datas em UTC, duração efetiva, motivo do fim e configurações de sessão/surgimento.

Uma identidade local persistente chamada **Captain** é criada na primeira visita. Os outros jogadores são dados reproduzíveis. Este é um serviço simulado local à origem: os registros não são compartilhados entre navegadores ou dispositivos diferentes. Ele não exige login nem um backend real.

As partidas concluídas entram em uma fila no armazenamento do navegador antes do envio HTTP. A tela de resultado exibe o estado de registro, pendente ou confirmado. Um ID estável de partida é reutilizado em todas as tentativas. Quando a API simulada confirma o registro, um comprovante local é salvo e somente aquela entrada pendente é removida. As duas abas de dados são invalidadas e atualizadas quando exibidas novamente. O cancelamento de consultas e a verificação de revisão impedem que leituras atrasadas substituam dados confirmados mais recentes.

- Envios com falha sobrevivem à atualização da página e recebem uma nova tentativa automática após a configuração da API ao recarregar.
- **Tentar registro novamente**, **Tentar novamente** e **Tentar todas novamente** oferecem recuperação explícita após falhas.
- Outra partida pode começar enquanto resultados anteriores continuam pendentes.
- A mesma partida não pode gerar vários registros confirmados. Um conteúdo conflitante que use um ID existente é rejeitado.
- Falhas da API não desativam Jogar nem Opções e não alteram a jogabilidade.
- Resultados concluídos antes desta integração podem ser enviados explicitamente com **Registrar partida** na tela de resultado.
- Se o armazenamento do próprio navegador estiver indisponível/cheio, uma mensagem explícita pede que você mantenha a aba aberta e tente novamente; não é possível garantir a persistência até que o armazenamento volte a funcionar.

### Recursos REST simulados

| Método | Recurso | Finalidade |
| --- | --- | --- |
| GET | `/api/ranking?configurationKey=...&page=1&pageSize=5` | Ranking de uma configuração canônica completa |
| GET | `/api/history?playerId=...&page=1&pageSize=5` | Histórico do jogador |
| POST | `/api/matches` | Registrar uma partida concluída de forma idempotente |

Os registros incluem IDs da partida/do jogador, nome do jogador, data de conclusão, pontuação, duração ativa, motivo do fim, configuração completa e chave canônica da configuração. As respostas incluem uma revisão monotônica do armazenamento simulado. Os contratos são validados nos limites de requisição, persistência e resposta.

## Cenários de rede e reprodução de falhas

Abra **Cenários de rede** no menu ou na tela de resultado e selecione **Cenário de rede**. A seleção é mantida e afeta novas requisições. Requisições já em andamento mantêm o comportamento selecionado quando começaram.

| Cenário | Comportamento |
| --- | --- |
| Sucesso | Respostas em 80ms com dados padrão de adversários |
| Dados vazios | Sem dados de demonstração; registros reais confirmados continuam visíveis |
| Várias páginas | Adversários adicionais e 12 registros de histórico do Captain claramente simulados |
| Respostas lentas | Latência de 1500ms |
| Latência variável | Repete 1200, 40, 650 e 100ms por recurso |
| Respostas fora de ordem | Alterna 1500 e 40ms por recurso |
| Tempo limite da requisição | Atraso de 3000ms; o prazo do cliente é 2000ms; o registro não é efetivado |
| Falha de conexão | Erro de rede simulado |
| HTTP 400 / HTTP 500 | Status correspondente para consultas e registro |
| Falha no ranking / Falha no histórico | HTTP 503 para o recurso de consulta selecionado; os outros recursos funcionam |
| Tempo limite após registro | Primeiro efetiva o registro, atrasa a resposta em 3000ms e excede o tempo limite no cliente |
| Indisponível até recuperação | HTTP 503 para os três recursos até que o cenário seja alterado |

Os contadores são reiniciados ao selecionar um cenário e ao recarregar a página. As consultas repetem falhas transitórias de rede/5xx uma vez, após 200ms. As mutações usam uma nova tentativa explícita, em vez de um ciclo automático infinito de tentativas.

**Redefinir dados de demonstração** remove os registros simulados confirmados e os comprovantes locais e restaura Sucesso. A ação preserva envios pendentes, identidade do jogador, opções e o último resultado local. A redefinição fica desativada enquanto há envios em andamento. Os dados são determinísticos e derivados do cenário selecionado. Para listas totalmente vazias, primeiro redefina os dados confirmados e depois selecione Dados vazios; evite tentar novamente os resultados pendentes antes de verificar o estado vazio.

### Verifique a recuperação de itens pendentes

1. Selecione Indisponível até recuperação.
2. Jogue até morrer ou o tempo acabar. O resultado deve exibir Registro pendente.
3. Inicie outra partida se desejar; os resultados pendentes anteriores continuam listados.
4. Atualize a página. Os envios pendentes devem reaparecer e tentar o registro uma vez.
5. Selecione Sucesso e use Tentar registro novamente ou Tentar todas novamente.
6. Volte ao menu e verifique uma entrada no histórico por partida concluída.

### Verifique uma resposta perdida sem duplicação

1. Selecione Tempo limite após registro e termine uma partida.
2. Espere cerca de dois segundos pelo estado pendente. O serviço simulado já armazenou a partida.
3. Atualize a página e espere a tentativa pendente terminar.
4. Selecione Sucesso e tente novamente. O serviço retorna o registro existente.
5. Verifique que a mesma partida aparece uma única vez no histórico e no ranking.

### Verifique erros de consulta e respostas atrasadas

Selecione Falha no ranking e abra Ranking; depois verifique que Histórico de partidas e Jogar continuam disponíveis. Restaure Sucesso para se recuperar. Use Respostas fora de ordem, Atualizar e alterações rápidas de aba/cenário para exercitar o cancelamento. Os dados em cache podem continuar visíveis com uma mensagem Atualizando durante a atualização em segundo plano.

O arquivo gerado `public/mockServiceWorker.js` é necessário nos builds de desenvolvimento, teste e publicação. Se a versão instalada do MSW mudar, gere-o novamente com `npx msw init public --save`; não edite manualmente o script gerado. O MSW é ativado deliberadamente em produção para este desafio.

## Comandos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Iniciar o servidor de desenvolvimento na porta 5173 |
| `npm run typecheck` | Verificar o TypeScript sem executar o jogo |
| `npm run lint` | Verificar a qualidade do código |
| `npm test` | Executar testes isolados de engine, persistência, manipuladores simulados, Axios e Query sem navegador nem serviço real |
| `npm run build` | Verificar os tipos e produzir o build otimizado em `dist/` |
| `npm run build:test` | Produzir um build com instrumentação do jogo exclusiva para testes |
| `npm run preview` | Servir um build otimizado existente na porta 4173 |
| `npm run test:e2e` | Executar o Playwright em um servidor que já esteja em execução |
| `npm run test:e2e:ui` | Abrir o executor interativo do Playwright |
| `npm run test:report` | Abrir o relatório HTML mais recente do Playwright |
| `npm run test:visual` | Comparar referências visuais de desktop/celular com um build de teste em execução |
| `npm run test:visual:baseline` | Gerar PNGs de referência ausentes sem sobrescrever referências existentes |
| `npm run test:visual:report` | Abrir o relatório HTML visual separado |

## Testes no navegador

Instale o Chromium uma vez:

```sh
npx playwright install chromium
```

Mantenha `npm run dev` em execução em um terminal. Abra um segundo terminal na mesma pasta do projeto e execute:

```sh
npm run test:e2e
```

A suíte padrão verifica opções, navegação, falha/repetição do carregamento de recursos, paginação de ranking/histórico, erros de consulta, filtragem por configuração e cenários de resposta atrasada. O Playwright não inicia a aplicação automaticamente. Os relatórios dos testes são gravados em `playwright-report/`; os rastros de falhas são gravados em `test-results/`. Eles são artefatos locais gerados e não são incluídos em commits por padrão.

Para testes determinísticos de jogabilidade, primeiro gere a versão de teste e depois inicie a pré-visualização:

```sh
npm run build:test
npm run preview
```

Em um segundo terminal, use o comando correspondente ao seu shell.

**macOS / Linux (bash ou zsh):**

```sh
PLAYWRIGHT_GAME_TESTS=1 PLAYWRIGHT_BASE_URL=http://localhost:4173 npm run test:e2e
```

**Windows (PowerShell):**

```powershell
$env:PLAYWRIGHT_GAME_TESTS = "1"
$env:PLAYWRIGHT_BASE_URL = "http://localhost:4173"
npm run test:e2e
```

Essas configurações de ambiente se aplicam ao comando de teste no macOS/Linux e à sessão atual do PowerShell no Windows. Feche o terminal do PowerShell após os testes para redefini-las.

`PLAYWRIGHT_GAME_TESTS=1` inclui as suítes de jogabilidade com relógio controlado e de registro/recuperação junto aos testes de navegação e ranking. Ele cobre registros confirmados, envios pendentes entre atualizações da página, eliminação de duplicidade após resposta perdida e jogo enquanto vários registros estão pendentes. O build de teste começa com o tempo de simulação sob controle manual dos testes; use o build de desenvolvimento ou o build normal de produção para jogar de verdade. A configuração de testes de jogabilidade e o observador são excluídos de um build normal de produção; os cenários de rede obrigatórios permanecem disponíveis. Os testes de navegador são fornecidos para execução pelo usuário; a mera presença deles não significa que foram aprovados.

Os builds de teste aceitam um parâmetro de consulta `scenario`. O Playwright seleciona estes cenários automaticamente:

| Cenário | Configuração inicial |
| --- | --- |
| `navigation` | Sem inimigos nem surgimento automático; isola movimento, armas e fim do tempo |
| `standard` | Surgimento normal com seed 1337 |
| `front-target` | Um Atirador à frente dos canhões do jogador |
| `shooter-fire` | Um Atirador dentro do alcance de ataque |
| `chaser-contact` | Um Perseguidor se aproximando |
| `enemy-navigation` | Os dois tipos de inimigo do outro lado da ilha |
| `death-contact` | Quatro Perseguidores se aproximando para um contato letal determinístico |

Os cenários definem apenas as condições iniciais. Entradas, dano, colisão, pontuação e comportamento dos inimigos ainda são processados pela engine real. Eles não podem ser selecionados em um build normal de produção.

## Referências de regressão visual

A suíte dedicada cobre o menu, uma arena estável com navios inimigos/vida/projéteis e um resultado concluído e registrado. Ela fixa data/hora, localidade, fuso horário e configurações de movimento, espera os recursos/o estado da API e usa a simulação real com tempo controlado. As capturas de tela incluem o canvas real do Pixi. O Chromium usa referências separadas para desktop, celular em paisagem e celular em retrato.

No primeiro terminal:

```sh
npm run build:test
npm run preview
```

Com a pré-visualização em execução, use um segundo terminal:

```sh
npm run test:visual:baseline
```

A primeira execução cria os arquivos ausentes em `tests/visual/baselines/<platform>/<project>/` e pode informar referências ausentes. **Revise menu.png, arena.png e result.png** e depois compare novamente. Alterações intencionais de jogabilidade e visuais exigem uma nova revisão das referências afetadas:

```sh
npm run test:visual
```

Mantenha os PNGs aprovados versionados. As referências são específicas de cada plataforma porque fontes, WebGL e renderização do navegador diferem. Existem seis referências Darwin antigas para desktop/celular em paisagem; o novo projeto em retrato ainda não possui suas três referências. O menu, o HUD e o deck mobile exigem nova revisão antes que as imagens representem o build atual.

Os resultados/rastros visuais vão para `test-results/visual/`; o relatório HTML separado vai para `visual-report/`. Abra-o com `npm run test:visual:report`. Alterações intencionais podem ser revisadas com `npm run test:visual -- --update-snapshots=changed`; não gere novamente as referências para ocultar regressões não intencionais.

Os testes funcionais e visuais são suítes separadas. Execute ambos para a entrega. A suíte visual usa a porta 4173 por padrão e exige build:test; a produção normal não tem um observador de jogabilidade controlada.

## Análise de desempenho do jogo otimizado

Execute `npm run build`, depois `npm run preview`, e abra **http://localhost:4173/?profile=1**. As evidências de desempenho aparecem nas telas de menu/resultado. A análise de desempenho é opcional, mantém as mesmas regras/vida/dificuldade do jogo e fica desativada nos builds de teste controlados.

1. Salve uma sessão de 180 segundos em Opções e aqueça a renderização com uma partida curta.
2. Jogue os três minutos ativos completos. Execuções parciais/por morte/abandonadas são diferenciadas.
3. Observe FPS, intervalo de quadro p95 e pico de entidades no painel de resultado.
4. Capture um ponto de controle com o menu aquecido, depois jogue/saia de cinco partidas e capture um ponto de controle após cada ciclo.
5. Insira a descrição do hardware de referência e use Exportar JSON antes de atualizar a página.

As métricas usam os intervalos reais do ticker, excluindo quadros de carregamento/pausa/limite. Travamentos ativos reais continuam incluídos. As quantidades de entidades são amostradas a cada segundo ativo, com um pico por quadro. A análise de desempenho não atualiza o React a cada quadro. Contadores de recursos e estimativas opcionais do heap de JavaScript complementam rastros/análises de memória do DevTools.

Siga [docs/PROFILING.md](docs/PROFILING.md) para ver o procedimento, a interpretação, o armazenamento de artefatos e o modelo de relatório. A instrumentação e os testes sintéticos não estabelecem 60 FPS nem provam a ausência de vazamento de memória; essas afirmações exigem resultados de navegador/hardware reais.

## Pré-visualize a versão de produção

```sh
npm run build
npm run preview
```

Abra **http://localhost:4173**. O comando de build compila a aplicação; a pré-visualização serve os arquivos compilados. A pré-visualização não atualiza os arquivos-fonte automaticamente: gere o build novamente após alterações.

## Publicação no Cloudflare

O projeto gera um site estático e não precisa de Docker nem de um servidor próprio em produção. A versão pública está hospedada como um Cloudflare Worker com assets estáticos em [piratebattle.matheusvaz90.workers.dev](https://piratebattle.matheusvaz90.workers.dev/).

A integração configurada no painel da Cloudflare conecta o repositório `matheusvaz90/PirateBattle`, executa o build do Vite e publica o conteúdo de `dist/` com HTTPS. A configuração relevante é:

| Campo | Valor |
| --- | --- |
| Nome do projeto | `piratebattle` |
| Branch de produção | `main` |
| Comando de build | `npm run build` |
| Diretório de saída | `dist` |
| Diretório raiz | `/` |
| Versão do Node.js | 24, definida em `.node-version` |

O arquivo `public/_headers` impede que uma versão antiga do Service Worker da API simulada permaneça em cache. O deploy publicado foi verificado por HTTP: a página, os bundles e `mockServiceWorker.js` responderam com sucesso, e o worker recebeu o cabeçalho de cache esperado.

A validação funcional no navegador continua separada: abra a versão pública e verifique o carregamento dos assets, uma partida completa, ranking, histórico, atualização da página e cenários de rede.

## Solução de problemas

- **Porta já em uso:** outro terminal talvez já esteja executando o servidor. Use esse servidor ou encerre-o com Control + C antes de iniciar outro.
- **Página em branco:** verifique erros de build no terminal e erros no console de desenvolvedor do navegador. Inclua o erro exato nos comentários.
- **Falha ao carregar recursos:** selecione Tentar novamente. Confirme que `public/assets/` existe e use a URL do servidor em vez de abrir um arquivo HTML diretamente.
- **O jogo pausa durante a inspeção das ferramentas de desenvolvedor:** a pausa automática ao perder o foco é intencional. Selecione Continuar depois de devolver o foco ao jogo.
- **Os controles de toque parecem pequenos:** ambas as orientações são suportadas, mas girar o celular para paisagem oferece uma arena e um deck de canhões maiores.
- **As alterações não aparecem na pré-visualização:** execute `npm run build` novamente.
- **O Ranking fica vazio após alterar as opções:** as pontuações são comparadas somente com configurações completas correspondentes. Termine uma partida com as novas configurações ou restaure as configurações padrão para ver os dados padrão.
- **Falha ao configurar a API simulada:** abra Cenários de rede e use Tentar configurar API. Confirme que `mockServiceWorker.js` está sendo servido e use HTTPS ou localhost. Ainda é possível jogar.
- **Uma partida continua pendente:** restaure Sucesso, espere a requisição atual terminar e tente novamente. Envios repetidos não podem criar duplicatas.

## Trabalho restante para a entrega

Execução/evidências no navegador, PNGs revisados/versionados, resultados reais de análise de desempenho, revisão final da entrega e acabamento solicitado continuam registrados em `docs/PROGRESS.md`.

## Recursos e arquitetura

Os recursos fornecidos ficam em `public/assets/`. Consulte [a procedência dos recursos](public/assets/ASSET_SOURCES.md) para ver a origem e a situação das licenças. Nenhuma licença dos recursos é inferida pelo fato de o repositório ser público.

Consulte [ARCHITECTURE.md](ARCHITECTURE.md) para ver a separação entre engine/renderização, tempo, entrada, propriedade de recursos e integração de dados planejada.
