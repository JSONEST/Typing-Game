import type { Difficulty } from '../../data/words.ts';

export interface TaqueroConfig {
  difficulty: Difficulty;
  /** Duración del turno en milisegundos. */
  durationMs: number;
  /** Si es verdadero, «limon» no vale por «limón». La ñ siempre es obligatoria. */
  strictAccents: boolean;
  /** El turno termina al completar una palabra con errores. */
  perfect: boolean;
}

export interface DifficultyProfile {
  label: string;
  blurb: string;
  /** Velocidad de la banda en anchos de escena por segundo, al inicio del turno. */
  speed: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  facil: { label: 'Fácil', blurb: 'Palabras cortas de la cocina, casi sin acentos.', speed: 0.075 },
  medio: { label: 'Medio', blurb: 'Comida y vida diaria, con acentos y ñ.', speed: 0.088 },
  dificil: {
    label: 'Difícil',
    blurb: 'Frases de pedido, palabras largas y nombres de México.',
    speed: 0.1
  }
};

export const DURATIONS_MS = [10_000, 30_000, 60_000, 120_000, 300_000, 600_000] as const;

export const DEFAULT_CONFIG: TaqueroConfig = {
  difficulty: 'medio',
  durationMs: 60_000,
  strictAccents: true,
  perfect: false
};

/** Los récords se guardan por combinación de ajustes que cambia la dificultad. */
export function configKey(c: TaqueroConfig): string {
  return [c.difficulty, c.durationMs / 1000, c.strictAccents ? 'acc' : 'sin', c.perfect ? 'perfecto' : 'normal'].join(':');
}

export function sanitizeConfig(raw: unknown): TaqueroConfig {
  const base = { ...DEFAULT_CONFIG };
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Record<string, unknown>;
  if (typeof r.difficulty === 'string' && r.difficulty in DIFFICULTIES) base.difficulty = r.difficulty as Difficulty;
  if (typeof r.durationMs === 'number' && (DURATIONS_MS as readonly number[]).includes(r.durationMs)) {
    base.durationMs = r.durationMs;
  }
  if (typeof r.strictAccents === 'boolean') base.strictAccents = r.strictAccents;
  if (typeof r.perfect === 'boolean') base.perfect = r.perfect;
  return base;
}
