# Histórico de alterações

Este projeto segue o versionamento semântico. As versões publicadas usam tags anotadas no formato `vMAJOR.MINOR.PATCH`.

## [0.2.0] - 2026-10-02

### Adicionado

- Joystick fixo no deck mobile, compatível com disparos simultâneos por outro toque.
- Licença MIT para o código original, com exclusão explícita dos assets de terceiros.
- Procedimento de flamegraph do React e convenções de commits e releases.

### Corrigido

- Navios danificados preservam a cor e o símbolo de sua facção em todos os estados de vida.
- Testes E2E deixaram de usar seletores e nomes acessíveis anteriores ao redesign.

### Alterado

- O joystick substitui o arrasto sobre a arena no mobile para manter os barcos visíveis durante a navegação.
- Resíduos sem uso do protótipo e do redesign foram removidos.
- O README documenta o deploy automático da branch `main` no Cloudflare.

## [0.1.0] - 2026-10-02

### Adicionado

- Jogo arcade naval completo com navegação, combate, inimigos, pickups, ataque especial, áudio e interface responsiva.
- Ranking, histórico, registro persistente de partidas e cenários reproduzíveis de rede com MSW.
- Builds de produção e teste, suítes unitárias/E2E/visuais e profiling opcional.
- Menu naval com assets oficiais, identidade compacta e favicon.

[0.2.0]: https://github.com/matheusvaz90/PirateBattle/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/matheusvaz90/PirateBattle/releases/tag/v0.1.0
