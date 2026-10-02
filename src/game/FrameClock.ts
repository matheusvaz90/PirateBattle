import type { GameStatus } from './types.ts';

export class FrameClock {
  private status: GameStatus = 'ready';
  private resetPending = true;

  setStatus(status: GameStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.resetPending = true;
  }

  consume(elapsedMilliseconds: number): number | null {
    if (this.status !== 'running' || !Number.isFinite(elapsedMilliseconds) || elapsedMilliseconds <= 0) return null;
    if (this.resetPending) {
      this.resetPending = false;
      return null;
    }
    return elapsedMilliseconds;
  }
}
