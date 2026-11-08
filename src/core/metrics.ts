import type { LostOutcome, SessionEvent, WordId } from './events.ts';

/**
 * Cálculo de métricas a partir del registro de eventos. Funciones puras: mismos eventos,
 * mismos resultados. Nada aquí toca el navegador.
 *
 * Definiciones:
 * - PPM (neto): caracteres de palabras completadas ÷ 5 ÷ minutos de sesión.
 * - PPM bruto: todas las pulsaciones ÷ 5 ÷ minutos.
 * - Precisión: pulsaciones correctas ÷ pulsaciones totales.
 * - Consistencia: ritmo entre pulsaciones correctas consecutivas dentro de una palabra.
 *   Se calcula como 100 ÷ (1 + CV²), con CV = desviación estándar ÷ media. Ritmo parejo
 *   da cerca de 100. Las pausas largas no entran aquí, se reportan como «estancadas».
 * - Una palabra incluye todo lo tecleado desde que se completó la anterior.
 */

export interface MetricsOptions {
  /** Pausa dentro de una palabra a partir de la cual se considera estancada. */
  stallMs?: number;
  /** Intervalos más largos que esto no cuentan para la consistencia. */
  rhythmCapMs?: number;
  /** Una palabra es lenta si su ms por tecla supera la mediana por este factor. */
  slowFactor?: number;
}

export type ReplayKind = 'ok' | 'erased' | 'rejected';

/** Una letra de la repetición: lo que se escribió, se borró o se rechazó. */
export interface ReplayToken {
  ch: string;
  kind: ReplayKind;
  /** La letra era incorrecta respecto a la esperada. */
  wrong: boolean;
  /** Milisegundos desde el evento anterior (o desde que apareció la palabra). */
  gapMs: number;
}

export interface WordStat {
  wordId: WordId;
  word: string;
  shownAt: number;
  doneAt: number;
  /** Desde que se pudo empezar hasta la primera tecla. */
  reactionMs: number;
  /** De la primera a la última tecla. */
  typingMs: number;
  /** De que se pudo empezar hasta completarla. */
  totalMs: number;
  /** Milisegundos por tecla (intervalos entre teclas). Nulo en palabras de una letra. */
  msPerKey: number | null;
  wpm: number | null;
  keystrokes: number;
  errors: number;
  erasedChars: number;
  /** Mayor pausa entre dos eventos dentro de la palabra. */
  longestPauseMs: number;
  stalled: boolean;
  trace: ReplayToken[];
}

export interface LostStat {
  wordId: WordId;
  word: string;
  outcome: LostOutcome;
  t: number;
}

export interface TroubleKey {
  key: string;
  count: number;
}

export interface SessionMetrics {
  durationMs: number;
  wpm: number;
  wpmGross: number;
  accuracy: number | null;
  keystrokes: number;
  correctKeystrokes: number;
  errors: number;
  erasedChars: number;
  wordsDone: number;
  wordsLost: number;
  charsDone: number;
  consistency: number | null;
  medianMsPerKey: number | null;
  /** PPM de cada segundo completo, según las letras correctas de ese segundo. */
  perSecond: number[];
  /** Instantes (ms) de cada pulsación incorrecta. */
  errorTimes: number[];
  words: WordStat[];
  lost: LostStat[];
  slowest: WordStat[];
  stuck: WordStat[];
  troubleKeys: TroubleKey[];
}

type TypingItem = Extract<SessionEvent, { type: 'char' | 'erase' }>;

const DEFAULTS = { stallMs: 1500, rhythmCapMs: 2000, slowFactor: 1.4 };

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  const a = sorted[mid] as number;
  return sorted.length % 2 ? a : (a + (sorted[mid - 1] as number)) / 2;
}

export function computeMetrics(events: readonly SessionEvent[], options: MetricsOptions = {}): SessionMetrics {
  const stallMs = options.stallMs ?? DEFAULTS.stallMs;
  const rhythmCapMs = options.rhythmCapMs ?? DEFAULTS.rhythmCapMs;
  const slowFactor = options.slowFactor ?? DEFAULTS.slowFactor;

  let durationMs = 0;
  for (const e of events) if (e.t > durationMs) durationMs = e.t;

  const shown = new Map<WordId, { word: string; t: number }>();
  const words: WordStat[] = [];
  const lost: LostStat[] = [];
  const errorTimes: number[] = [];
  const rhythm: number[] = [];
  const trouble = new Map<string, number>();
  const secondCounts = new Map<number, number>();

  let keystrokes = 0;
  let correctKeystrokes = 0;
  let errors = 0;
  let erasedChars = 0;
  let segment: TypingItem[] = [];
  let prevDoneAt = 0;

  for (const e of events) {
    switch (e.type) {
      case 'shown':
        shown.set(e.wordId, { word: e.word, t: e.t });
        break;
      case 'char': {
        keystrokes++;
        if (e.correct) {
          correctKeystrokes++;
          const s = Math.floor(e.t / 1000);
          secondCounts.set(s, (secondCounts.get(s) ?? 0) + 1);
        } else {
          errors++;
          errorTimes.push(e.t);
          if (e.expected) trouble.set(e.expected, (trouble.get(e.expected) ?? 0) + 1);
        }
        segment.push(e);
        break;
      }
      case 'erase':
        erasedChars += e.erased.length;
        segment.push(e);
        break;
      case 'done': {
        const info = shown.get(e.wordId);
        const stat = buildWord(e.wordId, info?.word ?? '', info?.t ?? prevDoneAt, e.t, prevDoneAt, segment, stallMs);
        collectRhythm(segment, rhythmCapMs, rhythm);
        words.push(stat);
        segment = [];
        prevDoneAt = e.t;
        break;
      }
      case 'lost': {
        const info = shown.get(e.wordId);
        lost.push({ wordId: e.wordId, word: info?.word ?? '', outcome: e.outcome, t: e.t });
        break;
      }
      default:
        break;
    }
  }

  const minutes = durationMs / 60000;
  const charsDone = words.reduce((n, w) => n + w.word.length, 0);

  const fullSeconds = Math.floor(durationMs / 1000);
  const perSecond: number[] = [];
  for (let s = 0; s < fullSeconds; s++) perSecond.push((secondCounts.get(s) ?? 0) * 12);

  const msPerKeys = words.map((w) => w.msPerKey).filter((v): v is number => v !== null);
  const med = median(msPerKeys);

  const slowest =
    med === null
      ? []
      : words
          .filter((w) => w.msPerKey !== null && w.msPerKey > med * slowFactor)
          .sort((a, b) => (b.msPerKey as number) - (a.msPerKey as number))
          .slice(0, 5);

  const stuck = words
    .filter((w) => w.stalled)
    .sort((a, b) => b.longestPauseMs - a.longestPauseMs)
    .slice(0, 5);

  const troubleKeys = [...trouble.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'es'))
    .slice(0, 5);

  return {
    durationMs,
    wpm: minutes > 0 ? charsDone / 5 / minutes : 0,
    wpmGross: minutes > 0 ? keystrokes / 5 / minutes : 0,
    accuracy: keystrokes > 0 ? (correctKeystrokes / keystrokes) * 100 : null,
    keystrokes,
    correctKeystrokes,
    errors,
    erasedChars,
    wordsDone: words.length,
    wordsLost: lost.length,
    charsDone,
    consistency: consistencyOf(rhythm),
    medianMsPerKey: med,
    perSecond,
    errorTimes,
    words,
    lost,
    slowest,
    stuck,
    troubleKeys
  };
}

function consistencyOf(intervals: readonly number[]): number | null {
  if (intervals.length < 8) return null;
  const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
  if (mean <= 0) return null;
  const variance = intervals.reduce((a, b) => a + (b - mean) ** 2, 0) / intervals.length;
  const cv = Math.sqrt(variance) / mean;
  return 100 / (1 + cv * cv);
}

function collectRhythm(segment: readonly TypingItem[], capMs: number, out: number[]): void {
  for (let i = 1; i < segment.length; i++) {
    const a = segment[i - 1] as TypingItem;
    const b = segment[i] as TypingItem;
    if (a.type !== 'char' || b.type !== 'char') continue;
    if (!a.correct || !b.correct || a.rejected || b.rejected) continue;
    const gap = b.t - a.t;
    if (gap > 0 && gap < capMs) out.push(gap);
  }
}

function buildWord(
  wordId: WordId,
  word: string,
  shownAt: number,
  doneAt: number,
  prevDoneAt: number,
  items: readonly TypingItem[],
  stallMs: number
): WordStat {
  const refT = Math.max(shownAt, prevDoneAt);
  const firstChar = items.find((i) => i.type === 'char');
  const firstKeyT = firstChar ? firstChar.t : doneAt;

  const out: ReplayToken[] = [];
  const field: ReplayToken[] = [];
  let keystrokes = 0;
  let errors = 0;
  let erased = 0;
  let longestPause = 0;

  items.forEach((item, idx) => {
    const prevT = idx === 0 ? refT : (items[idx - 1] as TypingItem).t;
    const gap = Math.max(0, item.t - prevT);
    if (idx > 0 && gap > longestPause) longestPause = gap;

    if (item.type === 'char') {
      keystrokes++;
      if (!item.correct) errors++;
      [...item.typed].forEach((ch, k) => {
        const token: ReplayToken = {
          ch,
          kind: item.rejected ? 'rejected' : 'ok',
          wrong: !item.correct,
          gapMs: k === 0 ? gap : 0
        };
        out.push(token);
        if (!item.rejected) field.push(token);
      });
    } else {
      erased += item.erased.length;
      for (let k = 0; k < item.erased.length; k++) {
        const token = field.pop();
        if (token) token.kind = 'erased';
      }
    }
  });

  const typingMs = Math.max(0, doneAt - firstKeyT);
  const msPerKey = word.length > 1 ? typingMs / (word.length - 1) : null;

  return {
    wordId,
    word,
    shownAt,
    doneAt,
    reactionMs: Math.max(0, firstKeyT - refT),
    typingMs,
    totalMs: Math.max(0, doneAt - refT),
    msPerKey,
    wpm: msPerKey && msPerKey > 0 ? 12000 / msPerKey : null,
    keystrokes,
    errors,
    erasedChars: erased,
    longestPauseMs: longestPause,
    stalled: longestPause >= stallMs,
    trace: out
  };
}
