/** Fuente de tiempo en milisegundos. Se inyecta para poder probar sin esperar. */
export type Clock = () => number;

/** Reloj monotónico de alta resolución: no se ve afectado por cambios de hora del sistema. */
export const systemClock: Clock = () => performance.now();
