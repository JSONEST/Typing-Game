/**
 * Un modo de juego se monta en un contenedor y devuelve la función que lo desmonta.
 * Todos los modos comparten el mismo núcleo (captura, registro, métricas, resumen), así que
 * agregar uno nuevo es crear una carpeta en `src/modes/` y registrarlo en `registry.ts`.
 */
export interface ModeDefinition {
  id: string;
  title: string;
  blurb: string;
  status: 'ready' | 'soon';
  mount?: (host: HTMLElement) => () => void;
}
