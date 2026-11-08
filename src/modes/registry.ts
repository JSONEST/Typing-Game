import { mountTaquero } from './taquero/view.ts';
import type { ModeDefinition } from './types.ts';

/** Lista de modos de juego. Para agregar uno, súmalo aquí. */
export const modes: readonly ModeDefinition[] = [
  {
    id: 'taquero',
    title: 'Taquero Veloz',
    blurb: 'Los platos pasan por la banda. Escribe cada nombre antes de que llegue al borde.',
    status: 'ready',
    mount: mountTaquero
  },
  {
    id: 'autopista',
    title: 'Autopista',
    blurb: 'Cambia de carril escribiendo la palabra de ese carril y esquiva el tráfico. Si te equivocas, chocas.',
    status: 'soon'
  }
];
