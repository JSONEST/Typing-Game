/**
 * Modelo de eventos de una sesión.
 *
 * Todo lo que mide la aplicación (PPM, precisión, consistencia, palabras lentas,
 * repeticiones de borrados) se calcula a partir de esta lista de eventos, que solo
 * crece. Si algún día cambia una fórmula, las sesiones guardadas se pueden recalcular.
 *
 * Los tiempos `t` están en milisegundos desde el inicio de la sesión, sin contar pausas.
 */

export type WordId = number;

/**
 * Por qué desapareció texto del campo:
 * - backspace: el jugador borró.
 * - clear: el jugador limpió el campo (Esc).
 * - abandon: el juego limpió el campo porque la palabra se perdió.
 */
export type EraseReason = 'backspace' | 'clear' | 'abandon';

/** Cómo se perdió una palabra sin completarla. */
export type LostOutcome = 'missed' | 'crashed';

export type SessionEvent =
  | { type: 'start'; t: number }
  /** La palabra ya es visible y se puede escribir. Sirve para medir el tiempo de reacción. */
  | { type: 'shown'; t: number; wordId: WordId; word: string }
  /**
   * Una pulsación que insertó una letra.
   * `expected` es la letra que pedía el juego, si había una.
   * `rejected` indica que la letra errónea no llegó a quedarse en el campo.
   */
  | { type: 'char'; t: number; typed: string; expected: string | null; correct: boolean; rejected: boolean }
  /** Texto que salió del campo. */
  | { type: 'erase'; t: number; erased: string; reason: EraseReason }
  /** El jugador completó la palabra. Todo lo tecleado desde el `done` anterior es de esta palabra. */
  | { type: 'done'; t: number; wordId: WordId }
  /** La palabra se perdió sin completarse. */
  | { type: 'lost'; t: number; wordId: WordId; outcome: LostOutcome }
  | { type: 'end'; t: number };

/**
 * Acción de edición ya normalizada que entrega la captura de teclado.
 * `t` es el instante absoluto (misma escala que `performance.now()`).
 * `value` es el contenido del campo después de la acción.
 */
export type InputAction =
  | { type: 'insert'; t: number; text: string; value: string }
  | { type: 'delete'; t: number; text: string; value: string }
  | { type: 'clear'; t: number; text: string; value: string };
