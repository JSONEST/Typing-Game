/** Emisor de eventos con tipos. Sin dependencias del navegador. */
export class Emitter<E extends { [K in keyof E]: unknown }> {
  private readonly handlers = new Map<keyof E, Set<(payload: never) => void>>();

  on<K extends keyof E>(name: K, fn: (payload: E[K]) => void): () => void {
    let set = this.handlers.get(name);
    if (!set) {
      set = new Set();
      this.handlers.set(name, set);
    }
    set.add(fn as (payload: never) => void);
    return () => {
      set.delete(fn as (payload: never) => void);
    };
  }

  emit<K extends keyof E>(name: K, payload: E[K]): void {
    const set = this.handlers.get(name);
    if (!set) return;
    for (const fn of [...set]) (fn as (payload: E[K]) => void)(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
