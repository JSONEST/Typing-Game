/**
 * Utilidades de texto para español.
 * La ñ se trata como una letra propia: nunca se confunde con la n.
 */

/** Minúsculas y sin acentos (á→a, ü→u), pero conservando la ñ. */
export function fold(text: string): string {
  return text
    .toLowerCase()
    .replace(/ñ/g, '\u0001')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\u0001/g, 'ñ');
}

/**
 * Forma comparable de un texto.
 * Con acentos estrictos solo se ignoran las mayúsculas; si no, también se ignoran los acentos.
 */
export function normalizeText(text: string, strictAccents: boolean): string {
  return strictAccents ? text.normalize('NFC').toLowerCase() : fold(text);
}

export function commonPrefixLength(a: string, b: string): number {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

export interface Edit {
  /** Cuántos caracteres iniciales no cambiaron. */
  keep: number;
  /** Texto que desapareció. */
  removed: string;
  /** Texto que apareció. */
  added: string;
}

/** Diferencia entre el valor anterior y el nuevo de un campo de texto. */
export function diffEdit(previous: string, next: string): Edit {
  const keep = commonPrefixLength(previous, next);
  return { keep, removed: previous.slice(keep), added: next.slice(keep) };
}
