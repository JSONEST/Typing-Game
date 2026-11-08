import type { InputAction } from '../core/events.ts';
import { diffEdit } from '../core/text.ts';

/**
 * Captura de teclado sobre un <input> real.
 *
 * Por qué un campo de texto y no escuchar teclas sueltas:
 * - Acentos y ñ con teclas muertas (´ + o) y teclados de celular solo se resuelven bien ahí.
 * - Se obtiene el carácter final, no el código de la tecla.
 *
 * Precisión del tiempo: se usa `event.timeStamp`, que marca cuándo el navegador recibió el
 * evento, y no el momento en que este código lo procesó. Ambos están en la misma escala
 * que `performance.now()`.
 *
 * Este módulo solo traduce cambios del campo a acciones (insertar, borrar, limpiar).
 * Decidir si una letra es válida le toca al modo de juego.
 */
export class InputCapture {
  private lastValue = '';
  private composing = false;
  private handler: ((action: InputAction) => void) | null = null;
  private readonly disposers: Array<() => void> = [];
  readonly el: HTMLInputElement;

  constructor(el: HTMLInputElement) {
    this.el = el;
    el.setAttribute('autocomplete', 'off');
    el.setAttribute('autocorrect', 'off');
    el.setAttribute('autocapitalize', 'off');
    el.setAttribute('spellcheck', 'false');
    el.value = '';

    this.listen('input', (e) => {
      if (this.composing || (e as InputEvent).isComposing) return;
      this.flush(this.timeOf(e));
    });
    this.listen('compositionstart', () => {
      this.composing = true;
    });
    this.listen('compositionend', (e) => {
      this.composing = false;
      this.flush(this.timeOf(e));
    });
    this.listen('keydown', (e) => {
      const k = e as KeyboardEvent;
      if (k.key === 'Escape' && el.value) {
        k.preventDefault();
        const text = el.value;
        this.lastValue = '';
        el.value = '';
        this.emit({ type: 'clear', t: this.timeOf(e), text, value: '' });
      }
    });
    for (const name of ['paste', 'drop', 'cut']) this.listen(name, (e) => e.preventDefault());
  }

  /** Recibe cada acción de edición normalizada. */
  onAction(handler: (action: InputAction) => void): void {
    this.handler = handler;
  }

  /** Cambia el valor del campo desde el juego (por ejemplo, al rechazar una letra). */
  setValue(value: string): void {
    this.lastValue = value;
    if (this.el.value !== value) this.el.value = value;
  }

  get value(): string {
    return this.lastValue;
  }

  focus(): void {
    this.el.focus({ preventScroll: true });
  }

  setEnabled(enabled: boolean): void {
    this.el.disabled = !enabled;
    if (enabled) this.focus();
  }

  destroy(): void {
    for (const off of this.disposers) off();
    this.disposers.length = 0;
    this.handler = null;
  }

  private listen(name: string, fn: (e: Event) => void): void {
    this.el.addEventListener(name, fn);
    this.disposers.push(() => this.el.removeEventListener(name, fn));
  }

  private timeOf(e: Event): number {
    const now = performance.now();
    const t = e.timeStamp;
    // Algunos navegadores entregan 0 o una escala distinta: en ese caso se usa la hora actual.
    return t > 0 && t <= now + 1 ? t : now;
  }

  private flush(t: number): void {
    const next = this.el.value.normalize('NFC');
    if (next !== this.el.value) this.el.value = next;
    const edit = diffEdit(this.lastValue, next);
    this.lastValue = next;
    if (edit.removed) {
      const value = next.slice(0, edit.keep);
      this.emit({ type: 'delete', t, text: edit.removed, value });
    }
    if (edit.added) this.emit({ type: 'insert', t, text: edit.added, value: next });
  }

  private emit(action: InputAction): void {
    this.handler?.(action);
  }
}
