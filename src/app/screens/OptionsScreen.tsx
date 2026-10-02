import { useState } from 'react';
import type { FormEvent } from 'react';
import { isGameOptions, OPTION_LIMITS } from '../../game/config.ts';
import type { GameOptions } from '../../game/types.ts';

interface Props {
  options: GameOptions;
  onSave: (options: GameOptions) => string | null;
  onCancel: () => void;
}

export function OptionsScreen({ options, onSave, onCancel }: Props) {
  const [sessionTime, setSessionTime] = useState(String(options.sessionTime));
  const [enemySpawnTime, setEnemySpawnTime] = useState(String(options.enemySpawnTime));
  const [healthPickupsEnabled, setHealthPickupsEnabled] = useState(options.healthPickupsEnabled);
  const [specialAttackEnabled, setSpecialAttackEnabled] = useState(options.specialAttackEnabled);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = { sessionTime: Number(sessionTime), enemySpawnTime: Number(enemySpawnTime), healthPickupsEnabled, specialAttackEnabled };
    if (!sessionTime.trim() || !enemySpawnTime.trim() || !isGameOptions(next)) {
      setError('Use uma duração inteira de 60 a 180 segundos e um intervalo de inimigos de 1 a 10 segundos.');
      return;
    }
    setError(onSave(next));
  }

  return (
    <section className="panel options-panel" aria-labelledby="options-heading">
      <p className="eyebrow">DEFINA SUA ROTA</p><h1 id="options-heading">Opções</h1>
      <p>Salvo neste navegador. As mudanças valem a partir da próxima partida.</p>
      <form onSubmit={submit} noValidate>
        <label htmlFor="session-time">Duração da partida <span>segundos</span></label>
        <input id="session-time" type="number" min={OPTION_LIMITS.sessionTime.min} max={OPTION_LIMITS.sessionTime.max} step="1" value={sessionTime} onChange={(event) => setSessionTime(event.target.value)} aria-describedby="session-help options-error" aria-invalid={Boolean(error)} />
        <p id="session-help" className="field-help">60–180 segundos de jogo ativo. O tempo pausado não conta.</p>
        <label htmlFor="spawn-time">Intervalo de surgimento dos inimigos <span>segundos</span></label>
        <input id="spawn-time" type="number" min={OPTION_LIMITS.enemySpawnTime.min} max={OPTION_LIMITS.enemySpawnTime.max} step="0.1" value={enemySpawnTime} onChange={(event) => setEnemySpawnTime(event.target.value)} aria-describedby="spawn-help options-error" aria-invalid={Boolean(error)} />
        <p id="spawn-help" className="field-help">1–10 segundos entre inimigos. Intervalos menores tornam a batalha mais difícil.</p>
        <label className="option-toggle"><input type="checkbox" checked={healthPickupsEnabled} onChange={(event) => setHealthPickupsEnabled(event.target.checked)} /><span><strong>Corações de vida</strong><small>Um coração aparece a cada 15 segundos, dura 10 segundos e recupera 20 de vida.</small></span></label>
        <label className="option-toggle"><input type="checkbox" checked={specialAttackEnabled} onChange={(event) => setSpecialAttackEnabled(event.target.checked)} /><span><strong>Ataque especial</strong><small>Destrua cinco inimigos com os canhões e pressione R para eliminar os inimigos e tiros hostis da tela.</small></span></label>
        <p id="options-error" className="form-error" role="alert">{error}</p>
        <div className="menu-actions"><button className="button primary" type="submit">Salvar opções</button><button className="button secondary" type="button" onClick={onCancel}>Cancelar</button></div>
      </form>
    </section>
  );
}
