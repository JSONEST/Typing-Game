import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics } from '../src/core/metrics.ts';
import { mulberry32 } from '../src/core/random.ts';
import { SessionRecorder } from '../src/core/recorder.ts';
import { DEFAULT_CONFIG, type TaqueroConfig } from '../src/modes/taquero/config.ts';
import { TaqueroEngine } from '../src/modes/taquero/engine.ts';

function setup(overrides: Partial<TaqueroConfig> = {}, words: readonly string[] = ['limón', 'taco', 'salsa', 'queso']) {
  let clock = 0;
  const rec = new SessionRecorder(() => clock);
  const config: TaqueroConfig = { ...DEFAULT_CONFIG, durationMs: 30_000, ...overrides };
  const engine = new TaqueroEngine({ config, words, rng: mulberry32(7), recorder: rec });
  return {
    engine,
    rec,
    config,
    get now() {
      return clock;
    },
    /** Avanza el reloj en pasos de ~16 ms, como los fotogramas reales. */
    advance(ms: number) {
      const end = clock + ms;
      while (clock < end) {
        clock = Math.min(end, clock + 16);
        engine.tick(clock);
      }
    },
    type(text: string) {
      for (const ch of text) {
        clock += 90;
        engine.input({ type: 'insert', t: clock, text: ch, value: engine.value + ch });
      }
    }
  };
}

/** Espera hasta que haya un plato escribible y lo devuelve. */
function waitForActivePlate(s: ReturnType<typeof setup>) {
  for (let i = 0; i < 4000; i++) {
    const p = s.engine.plates.find((q) => q.active);
    if (p) return p;
    s.advance(16);
  }
  throw new Error('nunca apareció un plato');
}

test('aparecen platos y se sirven al escribirlos completos', () => {
  const s = setup();
  s.engine.begin(0);
  const plate = waitForActivePlate(s);
  s.type(plate.word);
  assert.equal(s.engine.served, 1);
  assert.equal(s.engine.value, '');
  assert.equal(s.engine.score, plate.word.length * 10);
  assert.ok(!s.engine.plates.includes(plate));
});

test('un plato solo se puede escribir cuando ya se ve completo', () => {
  const s = setup({ perfect: true }, ['taco']);
  s.engine.begin(0);
  while (s.engine.plates.length === 0) s.advance(16);
  const plate = s.engine.plates[0]!;
  assert.equal(plate.active, false);
  // Mientras el plato no se vea completo, escribir no cuenta como error ni termina el turno.
  s.type('t');
  assert.equal(s.engine.value, '');
  assert.equal(s.engine.phase, 'playing');
  while (!plate.active) s.advance(16);
  assert.ok(plate.x + plate.w <= 1);
});

test('los acentos son obligatorios si así se configura', () => {
  const s = setup({ strictAccents: true }, ['limón']);
  s.engine.begin(0);
  const plate = waitForActivePlate(s);
  assert.equal(plate.word, 'limón');
  s.type('limon');
  assert.equal(s.engine.served, 0, 'sin acento no debe contar');
  assert.ok(s.engine.errors >= 1);
});

test('los acentos se ignoran si no son obligatorios', () => {
  const s = setup({ strictAccents: false }, ['limón']);
  s.engine.begin(0);
  waitForActivePlate(s);
  s.type('limon');
  assert.equal(s.engine.served, 1);
});

test('la ñ nunca se confunde con la n', () => {
  const s = setup({ strictAccents: false }, ['piña']);
  s.engine.begin(0);
  waitForActivePlate(s);
  s.type('pina');
  assert.equal(s.engine.served, 0);
});

test('una letra errónea se rechaza, corta la racha y se registra', () => {
  const s = setup({}, ['taco']);
  s.engine.begin(0);
  waitForActivePlate(s);
  s.type('tx');
  assert.equal(s.engine.value, 't');
  assert.equal(s.engine.errors, 1);
  s.type('aco');
  assert.equal(s.engine.served, 1);
  s.engine.stop();
  const m = computeMetrics(s.rec.events);
  assert.equal(m.errors, 1);
  assert.deepEqual(m.troubleKeys, [{ key: 'a', count: 1 }]);
});

test('modo 100 % de precisión: un error termina el turno', () => {
  const s = setup({ perfect: true }, ['taco']);
  let ended: string | null = null;
  s.engine.events.on('end', (r) => {
    ended = r;
  });
  s.engine.begin(0);
  waitForActivePlate(s);
  s.type('tx');
  assert.equal(ended, 'error');
  assert.equal(s.engine.phase, 'ended');
});

test('el turno termina exactamente a la duración configurada', () => {
  const s = setup({ durationMs: 30_000 });
  s.engine.begin(0);
  s.advance(31_000);
  assert.equal(s.engine.phase, 'ended');
  assert.equal(s.engine.endReason, 'time');
  assert.equal(computeMetrics(s.rec.events).durationMs, 30_000);
});

test('un plato que llega al borde se pierde y se registra', () => {
  const s = setup({}, ['taco', 'salsa', 'queso', 'limón']);
  s.engine.begin(0);
  s.advance(20_000);
  assert.ok(s.engine.missed > 0);
  s.engine.stop();
  const m = computeMetrics(s.rec.events);
  assert.equal(m.wordsLost, s.engine.missed);
});

test('al perderse el plato que se estaba escribiendo, el campo se limpia como «abandono»', () => {
  const s = setup({}, ['taco']);
  s.engine.begin(0);
  const plate = waitForActivePlate(s);
  s.type('ta');
  assert.equal(s.engine.value, 'ta');
  // Dejar que el plato llegue al borde sin terminarlo.
  while (s.engine.plates.includes(plate)) s.advance(16);
  assert.equal(s.engine.value, '');
  const erase = s.rec.events.find((e) => e.type === 'erase');
  assert.ok(erase && erase.type === 'erase');
  assert.equal(erase.reason, 'abandon');
});

test('la pausa detiene el juego y no cuenta como tiempo', () => {
  const s = setup();
  s.engine.begin(0);
  s.advance(2000);
  const x = s.engine.plates.map((p) => p.x);
  s.engine.pause();
  s.advance(5000);
  assert.deepEqual(
    s.engine.plates.map((p) => p.x),
    x
  );
  s.engine.resume(s.now);
  assert.ok(Math.abs(s.engine.elapsedMs - 2000) < 20);
});
