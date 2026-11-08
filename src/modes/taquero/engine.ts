import { Emitter } from '../../core/emitter.ts';
import type { InputAction, WordId } from '../../core/events.ts';
import type { Rng } from '../../core/random.ts';
import type { SessionRecorder } from '../../core/recorder.ts';
import { fold, normalizeText } from '../../core/text.ts';
import { DIFFICULTIES, type TaqueroConfig } from './config.ts';

/**
 * Motor del modo Taquero Veloz. No toca el DOM ni Three.js: recibe acciones de teclado y el
 * paso del tiempo, y avisa lo que ocurre. La vista (HTML hoy, 3D mañana) solo dibuja.
 *
 * Las posiciones están normalizadas: x = 0 es el borde izquierdo de la escena y x = 1 el derecho.
 */

export interface Plate {
  id: WordId;
  word: string;
  /** Forma comparable de la palabra según la configuración de acentos. */
  norm: string;
  lane: number;
  /** Borde izquierdo del plato, en anchos de escena. */
  x: number;
  /** Ancho del plato, en anchos de escena. La vista lo corrige con el valor real. */
  w: number;
  /** Solo se puede escribir un plato cuando ya se ve completo en pantalla. */
  active: boolean;
}

export type EndReason = 'time' | 'error' | 'inactive';
export type Phase = 'idle' | 'playing' | 'ended';

export interface EngineEvents {
  spawn: Plate;
  serve: { plate: Plate; points: number; typed: string; correct: boolean };
  miss: Plate;
  mistake: { typed: string };
  /** El campo de texto debe mostrar este valor. */
  value: string;
  end: EndReason;
}

export interface EngineOptions {
  config: TaqueroConfig;
  words: readonly string[];
  rng: Rng;
  recorder: SessionRecorder;
  lanes?: number;
}

const DEFAULT_PLATE_WIDTH = 0.12;
const MAX_DT = 0.05;
const RECENT_WORDS = 24;

export class TaqueroEngine {
  readonly events = new Emitter<EngineEvents>();
  readonly lanes: number;

  plates: Plate[] = [];
  phase: Phase = 'idle';
  paused = false;
  value = '';
  targetId: WordId | null = null;
  readonly typedCorrectness: boolean[] = [];
  score = 0;
  served = 0;
  missed = 0;
  errors = 0;
  correctKeys = 0;
  streak = 0;
  bestStreak = 0;
  endReason: EndReason | null = null;

  private readonly cfg: TaqueroConfig;
  private readonly words: readonly string[];
  private readonly rng: Rng;
  private readonly rec: SessionRecorder;
  private nextId = 1;
  private recent: string[] = [];
  private spawnIn = 0;
  private lastTick = 0;
  private started = false;
  private missesBeforeFirstWord = 0;

  constructor(o: EngineOptions) {
    this.cfg = o.config;
    this.words = o.words;
    this.rng = o.rng;
    this.rec = o.recorder;
    this.lanes = o.lanes ?? 5;
  }

  get multiplier(): number {
    return 1 + Math.min(4, Math.floor(this.streak / 5)) * 0.5;
  }

  get elapsedMs(): number {
    return this.rec.elapsed();
  }

  get remainingMs(): number {
    return Math.max(0, this.cfg.durationMs - this.rec.elapsed());
  }

  get nextTargetId(): WordId | null {
    if (this.targetId !== null && this.plates.some((p) => p.id === this.targetId && p.active)) return this.targetId;
    return this.leftmost(() => true)?.id ?? null;
  }

  /** Empieza el turno. `now` está en la misma escala que el reloj de la grabadora. */
  begin(now: number): void {
    if (this.phase !== 'idle') return;
    this.phase = 'playing';
    this.lastTick = now;
    while (this.plates.length < this.lanes && this.spawn(now)) {
      // Fill the customer's visible order before the timer starts.
    }
    this.spawnIn = 0;
  }

  pause(): void {
    if (this.phase !== 'playing' || this.paused) return;
    this.paused = true;
    this.rec.pause();
  }

  resume(now: number): void {
    if (this.phase !== 'playing' || !this.paused) return;
    this.paused = false;
    this.rec.resume();
    this.lastTick = now;
  }

  setPlateWidth(id: WordId, w: number): void {
    const p = this.plates.find((q) => q.id === id);
    if (p && w > 0) p.w = w;
  }

  /** Avanza el juego hasta `now`. Se llama una vez por fotograma. */
  tick(now: number): void {
    if (this.phase !== 'playing' || this.paused) {
      this.lastTick = now;
      return;
    }
    if (!this.started) {
      this.lastTick = now;
      return;
    }
    const dt = Math.min(MAX_DT, Math.max(0, (now - this.lastTick) / 1000));
    this.lastTick = now;

    const elapsed = this.rec.elapsed();
    if (elapsed >= this.cfg.durationMs) {
      this.finish('time');
      return;
    }
    const progress = elapsed / this.cfg.durationMs;
    const speed = DIFFICULTIES[this.cfg.difficulty].speed * (1 + 0.3 * progress);

    for (let i = this.plates.length - 1; i >= 0; i--) {
      const p = this.plates[i] as Plate;
      p.x -= speed * dt;
      // Se puede escribir un plato cuando ya se ve completo: nunca se castiga una letra
      // sobre una palabra que el jugador todavía no puede leer entera.
      if (!p.active && p.x + p.w <= 1) p.active = true;
      if (p.x + p.w < 0) {
        this.lose(p, now);
        if (this.phase !== 'playing') return;
      }
    }
    if (this.phase !== 'playing') return;

    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.plates.length < this.lanes) {
      const plate = this.spawn(now);
      this.spawnIn = plate ? 0 : 0.05;
    }
  }

  /** Procesa una acción del teclado. */
  input(action: InputAction): void {
    if (this.phase !== 'playing' || this.paused) return;
    if (this.rec.elapsed() >= this.cfg.durationMs) {
      this.finish('time');
      return;
    }
    if (action.type !== 'insert') {
      this.rec.erase({ erased: action.text, reason: action.type === 'clear' ? 'clear' : 'backspace', t: action.t });
      this.value = action.value;
      this.typedCorrectness.splice(action.value.length);
      if (!action.value) this.targetId = null;
      this.events.emit('value', this.value);
      return;
    }
    if (!this.started && action.text.length > 0) {
      this.started = true;
      this.rec.start(action.t);
      for (const plate of this.plates) this.rec.shown(plate.id, plate.word, action.t);
    }
    for (const ch of [...action.text]) {
      if (this.phase !== 'playing') break;
      this.typeChar(ch, action.t);
    }
    if (this.value !== action.value) this.events.emit('value', this.value);
  }

  /** Termina el turno antes de tiempo (por ejemplo, al salir del modo). */
  stop(): void {
    if (this.phase === 'playing') this.finish('time');
  }

  // ---------------------------------------------------------------------------------------

  private typeChar(ch: string, t: number): void {
    const targetId = this.nextTargetId;
    const target = targetId === null ? null : this.plates.find((p) => p.id === targetId && p.active) ?? null;
    if (!target) return;
    this.targetId = target.id;

    const expected = target.word[this.value.length] ?? null;
    const correct = expected !== null && this.key(ch) === this.key(expected);
    this.value += ch;
    this.typedCorrectness.push(correct);
    this.rec.char({ typed: ch, expected, correct, rejected: false, t });
    if (correct) this.correctKeys++;
    else {
      this.errors++;
      this.streak = 0;
      this.events.emit('mistake', { typed: ch });
    }

    if ([...this.value].length >= [...target.word].length) this.serve(target, t);
  }

  private serve(p: Plate, t: number): void {
    const typed = this.value;
    const correct = this.typedCorrectness.every(Boolean) && this.key(typed) === p.norm;
    const points = correct ? Math.round(p.word.length * 10 * this.multiplier) : 0;
    this.score += points;
    this.served++;
    if (correct) {
      this.streak++;
      if (this.streak > this.bestStreak) this.bestStreak = this.streak;
    }
    this.plates = this.plates.filter((q) => q !== p);
    this.spawnIn = 0;
    this.rec.done({ wordId: p.id, t });
    this.value = '';
    this.targetId = null;
    this.typedCorrectness.length = 0;
    this.events.emit('serve', { plate: p, points, typed, correct });
    if (this.cfg.perfect && !correct) this.finish('error');
  }

  private lose(p: Plate, now: number): void {
    this.plates = this.plates.filter((q) => q !== p);
    this.missed++;
    this.streak = 0;
    this.rec.lost({ wordId: p.id, outcome: 'missed', t: now });
    if (this.served === 0) this.missesBeforeFirstWord++;
    this.events.emit('miss', p);
    if (this.targetId === p.id) {
      this.rec.erase({ erased: this.value, reason: 'abandon', t: now });
      this.value = '';
      this.targetId = null;
      this.typedCorrectness.length = 0;
      this.events.emit('value', '');
    }
    if (this.served === 0 && this.missesBeforeFirstWord >= 3) this.finish('inactive');
  }

  private finish(reason: EndReason): void {
    if (this.phase !== 'playing') return;
    this.phase = 'ended';
    this.endReason = reason;
    this.rec.end(undefined, reason === 'time' ? this.cfg.durationMs : undefined);
    this.events.emit('end', reason);
  }

  private key(text: string): string {
    return normalizeText(text, this.cfg.strictAccents);
  }

  private leftmost(test: (p: Plate) => boolean): Plate | null {
    let best: Plate | null = null;
    for (const p of this.plates) {
      if (p.active && test(p) && (!best || p.x < best.x)) best = p;
    }
    return best;
  }

  private spawn(now: number): Plate | null {
    const lane = this.freeLane();
    if (lane < 0) return null;
    const word = this.pickWord();
    if (!word) return null;
    const plate: Plate = {
      id: this.nextId++,
      word,
      norm: this.key(word),
      lane,
      x: 1,
      w: DEFAULT_PLATE_WIDTH,
      active: true
    };
    this.plates.push(plate);
    if (this.started) this.rec.shown(plate.id, word, now);
    this.events.emit('spawn', plate);
    return plate;
  }

  private freeLane(): number {
    const order = Array.from({ length: this.lanes }, (_, i) => i).sort(() => this.rng() - 0.5);
    for (const lane of order) {
      if (!this.plates.some((p) => p.lane === lane && p.x + p.w + 0.03 > 1)) return lane;
    }
    return -1;
  }

  /** Elige una palabra que no choque por prefijo con las que ya están en pantalla. */
  private pickWord(): string | null {
    for (let tries = 0; tries < 60; tries++) {
      const word = this.words[Math.floor(this.rng() * this.words.length)];
      if (!word || this.recent.includes(word)) continue;
      const f = fold(word);
      const clash = this.plates.some((p) => {
        const o = fold(p.word);
        return o.startsWith(f) || f.startsWith(o);
      });
      if (clash) continue;
      // En los primeros intentos, evitar también la misma letra inicial para que el prefijo decida rápido.
      if (tries < 30 && this.plates.some((p) => fold(p.word)[0] === f[0])) continue;
      this.recent.push(word);
      if (this.recent.length > RECENT_WORDS) this.recent.shift();
      return word;
    }
    return null;
  }
}
