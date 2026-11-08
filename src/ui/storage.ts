/**
 * Almacenamiento local seguro: puede fallar o estar vacío (modo privado, datos bloqueados),
 * así que toda lectura y escritura está protegida y la aplicación funciona sin él.
 * Más adelante este es el punto que se reemplaza por una cuenta en la nube.
 */
const PREFIX = 'tecleo:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* sin almacenamiento disponible */
  }
}
