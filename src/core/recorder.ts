import type { Clock } from './clock.ts';
import type { EraseReason, LostOutcome, SessionEvent, WordId } from './events.ts';

/**
 * Registro de una sesión: lista de eventos que solo crece, con tiempos relativos al inicio
 * y sin contar las pausas. Los tiempos nunca retroceden.
 *
 * Los métodos aceptan un instante absoluto opcional `t` (misma escala que el reloj). Así las
 * pulsaciones se registran con la hora exacta del teclado y no con la hora en que se procesaron.
 */
export class SessionRecorder {
  private readonly log: SessionEvent[] = [];
  private readonly now: Clock;
  private startedAt: number | null = null;
  private pausedAt: number | null = null;
  private pausedTotal = 0;
  private endedAt: number | null = null;
  private lastT = 0;

  constructor(now: Clock) {
    this.now = now;
  }

  get events(): readonly SessionEvent[] {
    return this.log;
  }

  get hasStarted(): boolean {
    return this.startedAt !== null;
  }

  get hasEnded(): boolean {
    return this.endedAt !== null;
  }

  get isPaused(): boolean {
    return this.pausedAt !== null;
  }

  get isRunning(): boolean {
    return this.startedAt !== null && this.endedAt === null && this.pausedAt === null;
  }

  /** Milisegundos transcurridos de sesión, sin contar pausas. */
  elapsed(): number {
    if (this.startedAt === null) return 0;
    if (this.endedAt !== null) return this.endedAt;
    const reference = this.pausedAt ?? this.now();
    return Math.max(0, reference - this.startedAt - this.pausedTotal);
  }

  start(t: number = this.now()): void {
    if (this.startedAt !== null) return;
    this.startedAt = t;
    this.log.push({ type: 'start', t: 0 });
  }

  pause(): void {
    if (!this.isRunning) return;
    this.pausedAt = this.now();
  }

  resume(): void {
    if (this.pausedAt === null) return;
    this.pausedTotal += this.now() - this.pausedAt;
    this.pausedAt = null;
  }

  shown(wordId: WordId, word: string, t: number = this.now()): void {
    if (!this.isRunning) return;
    this.log.push({ type: 'shown', t: this.stamp(t), wordId, word });
  }

  char(e: { typed: string; expected: string | null; correct: boolean; rejected: boolean; t?: number }): void {
    if (!this.isRunning) return;
    this.log.push({
      type: 'char',
      t: this.stamp(e.t ?? this.now()),
      typed: e.typed,
      expected: e.expected,
      correct: e.correct,
      rejected: e.rejected
    });
  }

  erase(e: { erased: string; reason: EraseReason; t?: number }): void {
    if (!this.isRunning) return;
    this.log.push({ type: 'erase', t: this.stamp(e.t ?? this.now()), erased: e.erased, reason: e.reason });
  }

  done(e: { wordId: WordId; t?: number }): void {
    if (!this.isRunning) return;
    this.log.push({ type: 'done', t: this.stamp(e.t ?? this.now()), wordId: e.wordId });
  }

  lost(e: { wordId: WordId; outcome: LostOutcome; t?: number }): void {
    if (!this.isRunning) return;
    this.log.push({ type: 'lost', t: this.stamp(e.t ?? this.now()), wordId: e.wordId, outcome: e.outcome });
  }

  /**
   * Cierra la sesión. `capMs` limita el tiempo final (por ejemplo, la duración exacta del turno
   * aunque el último fotograma llegue unos milisegundos tarde), sin quedar antes del último evento.
   */
  end(t: number = this.now(), capMs?: number): void {
    if (this.startedAt === null || this.endedAt !== null) return;
    if (this.pausedAt !== null) this.resume();
    const previous = this.lastT;
    let rel = this.stamp(t);
    if (capMs !== undefined) rel = Math.max(previous, Math.min(rel, capMs));
    this.lastT = rel;
    this.endedAt = rel;
    this.log.push({ type: 'end', t: rel });
  }

  /** Convierte un instante absoluto a tiempo de sesión, sin retroceder nunca. */
  private stamp(absolute: number): number {
    const started = this.startedAt ?? absolute;
    const rel = Math.max(this.lastT, absolute - started - this.pausedTotal);
    this.lastT = rel;
    return rel;
  }
}
