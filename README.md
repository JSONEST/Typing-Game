# Tecleo

Práctica de mecanografía en español con varios modos de juego y métricas por pulsación.
Primer modo: **Taquero Veloz**. Próximo: **Autopista**.

## Cómo arrancarlo

Necesitas [Node.js](https://nodejs.org) 22.18 o más nuevo.

```bash
npm install
npm run dev        # abre http://localhost:5173
```

Otros comandos:

| Comando             | Qué hace                                                    |
| ------------------- | ----------------------------------------------------------- |
| `npm test`          | Pruebas del núcleo y del motor (no necesitan navegador)     |
| `npm run typecheck` | Revisa los tipos de TypeScript                              |
| `npm run build`     | Genera la versión optimizada en `dist/`                     |
| `npm run check`     | Tipos, pruebas y build en un solo paso                      |

## Publicarlo (GitHub Pages)

1. Crea un repositorio en GitHub y sube este proyecto a la rama `main`.
2. En *Settings → Pages*, elige **GitHub Actions** como fuente.
3. Cada vez que subas cambios, `.github/workflows/deploy.yml` revisa tipos, corre las pruebas y publica.

## Cómo está organizado

```
src/
  core/        Núcleo sin navegador: eventos, grabadora, métricas, texto. Es lo más probado.
  input/       Captura de teclado sobre un <input> real (acentos, ñ, teclados de celular).
  data/        Bancos de palabras.
  modes/       Un modo por carpeta. Registro en modes/registry.ts.
    taquero/   engine.ts (reglas, sin DOM), view.ts (dibujo), config.ts, art.ts
  ui/          Resumen, utilidades de DOM, almacenamiento local, sonido.
  app/         Menú y rutas.
tests/         Pruebas con el ejecutor integrado de Node.
```

### La idea central

Cada pulsación se guarda como un **evento con su hora exacta** (`src/core/events.ts`).
PPM, precisión, consistencia, palabras lentas, pausas y la repetición de lo que borraste
se calculan después, a partir de esa lista (`src/core/metrics.ts`). Por eso cualquier
modo nuevo obtiene el mismo resumen sin trabajo extra, y si una fórmula cambia se pueden
recalcular las sesiones guardadas.

### Medir con precisión

- Las horas salen de `event.timeStamp` (cuándo recibió el navegador la tecla), no de cuándo
  la procesó el código. Escala de `performance.now()`.
- El manejador de teclado solo anota. Dibujar ocurre aparte, en `requestAnimationFrame`.
- Las pausas no cuentan como tiempo de sesión.

### Agregar un modo

1. Crea `src/modes/<nombre>/` con un motor sin DOM y una vista que implemente `mount(host)`.
2. Usa `SessionRecorder` para registrar eventos y `renderSummary` para mostrar el resumen.
3. Agrégalo a `src/modes/registry.ts`.

La lógica del juego no debe importar nada del navegador. Así la vista puede cambiar a Three.js
sin tocar las reglas.

## Qué sigue

- [ ] Modo **Autopista** (carriles, tiempo límite por palabra, choque).
- [ ] Modificador de precisión perfecta como pieza reutilizable (hoy es una opción de Taquero).
- [ ] Historial de turnos y gráfica de progreso.
- [ ] Más bancos de palabras (modismos, regiones, textos largos).
- [ ] Vista con Three.js, empezando por la banda en 3D.
- [ ] Cuentas y ranking en la nube (`src/ui/storage.ts` es el punto a reemplazar).
- [ ] Probar con más teclados latinoamericanos y con celulares.

## Pendientes conocidos

- `npm install` no se ha corrido todavía en un entorno con red; los números de versión de
  `package.json` son rangos y conviene confirmar que resuelven bien.
- No hay `package-lock.json`; se crea con el primer `npm install` y conviene subirlo a Git.
