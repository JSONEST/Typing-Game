import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics } from '../src/core/metrics.ts';
import { SessionRecorder } from '../src/core/recorder.ts';
import { diffEdit, fold, normalizeText } from '../src/core/text.ts';

/** Grabadora con reloj manual para controlar el tiempo en las pruebas. */
function make() {
  let now = 1000;
  const rec = new SessionRecorder(() => now);
  return {
    rec,
    at(t: number) {
      now = 1000 + t;
    }
  };
}

test('PPM neto: 10 caracteres completados en 12 s son 10 PPM', () => {
  const { rec, at } = make();
  rec.start();
  at(1000);
  rec.shown(1, 'tortilla');
  for (let i = 0; i < 8; i++) {
    at(2000 + i * 100);
    rec.char({ typed: 'x', expected: 'x', correct: true, rejected: false });
  }
  at(3000);
  rec.done({ wordId: 1 });
  at(3500);
  rec.shown(2, 'sal');
  at(4000);
  rec.char({ typed: 's', expected: 's', correct: true, rejected: false });
  at(4200);
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  at(4400);
  rec.char({ typed: 'l', expected: 'l', correct: true, rejected: false });
  rec.done({ wordId: 2 });
  at(12000);
  rec.end();

  const m = computeMetrics(rec.events);
  assert.equal(m.durationMs, 12000);
  assert.equal(m.charsDone, 11);
  assert.equal(m.wordsDone, 2);
  // 11 / 5 / 0.2 min = 11
  assert.ok(Math.abs(m.wpm - 11) < 1e-9);
  assert.equal(m.accuracy, 100);
});

test('la precisión cuenta pulsaciones rechazadas y reporta la letra que se falló', () => {
  const { rec, at } = make();
  rec.start();
  rec.shown(1, 'ajo');
  at(500);
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  at(900);
  rec.char({ typed: 'x', expected: 'j', correct: false, rejected: true });
  at(1300);
  rec.char({ typed: 'j', expected: 'j', correct: true, rejected: false });
  at(1600);
  rec.char({ typed: 'o', expected: 'o', correct: true, rejected: false });
  rec.done({ wordId: 1 });
  at(2000);
  rec.end();

  const m = computeMetrics(rec.events);
  assert.equal(m.keystrokes, 4);
  assert.equal(m.errors, 1);
  assert.equal(m.accuracy, 75);
  assert.deepEqual(m.troubleKeys, [{ key: 'j', count: 1 }]);
  assert.deepEqual(m.errorTimes, [900]);
});

test('la repetición marca lo borrado y lo rechazado', () => {
  const { rec, at } = make();
  rec.start();
  rec.shown(1, 'taco');
  at(400);
  rec.char({ typed: 't', expected: 't', correct: true, rejected: false });
  at(800);
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  at(1200);
  rec.erase({ erased: 'a', reason: 'backspace' });
  at(1500);
  rec.char({ typed: 'p', expected: 'a', correct: false, rejected: true });
  at(1700);
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  at(1900);
  rec.char({ typed: 'c', expected: 'c', correct: true, rejected: false });
  at(2100);
  rec.char({ typed: 'o', expected: 'o', correct: true, rejected: false });
  rec.done({ wordId: 1 });
  at(3000);
  rec.end();

  const w = computeMetrics(rec.events).words[0];
  assert.ok(w);
  assert.deepEqual(
    w.trace.map((t) => `${t.ch}:${t.kind}`),
    ['t:ok', 'a:erased', 'p:rejected', 'a:ok', 'c:ok', 'o:ok']
  );
  assert.equal(w.erasedChars, 1);
  assert.equal(w.errors, 1);
});

test('detecta palabras estancadas y mide la reacción', () => {
  const { rec, at } = make();
  rec.start();
  at(100);
  rec.shown(1, 'sal');
  at(1100); // reacción de 1 s
  rec.char({ typed: 's', expected: 's', correct: true, rejected: false });
  at(4100); // pausa de 3 s dentro de la palabra
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  at(4300);
  rec.char({ typed: 'l', expected: 'l', correct: true, rejected: false });
  rec.done({ wordId: 1 });
  at(5000);
  rec.end();

  const m = computeMetrics(rec.events);
  const w = m.words[0];
  assert.ok(w);
  assert.equal(w.reactionMs, 1000);
  assert.equal(w.longestPauseMs, 3000);
  assert.equal(w.stalled, true);
  assert.equal(m.stuck.length, 1);
});

test('consistencia: ritmo parejo da casi 100 y ritmo irregular baja', () => {
  const steady = make();
  steady.rec.start();
  steady.rec.shown(1, 'abcdefghijklmnop');
  for (let i = 0; i < 16; i++) {
    steady.at(200 + i * 150);
    steady.rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  }
  steady.rec.done({ wordId: 1 });
  steady.at(5000);
  steady.rec.end();
  const a = computeMetrics(steady.rec.events).consistency;

  const uneven = make();
  uneven.rec.start();
  uneven.rec.shown(1, 'abcdefghijklmnop');
  let t = 200;
  for (let i = 0; i < 16; i++) {
    t += i % 2 ? 60 : 600;
    uneven.at(t);
    uneven.rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false });
  }
  uneven.rec.done({ wordId: 1 });
  uneven.at(9000);
  uneven.rec.end();
  const b = computeMetrics(uneven.rec.events).consistency;

  assert.ok(a !== null && b !== null);
  assert.ok(a > 99, `esperaba >99, obtuve ${a}`);
  assert.ok(b < a - 20, `esperaba que el irregular fuera mucho menor: ${b} vs ${a}`);
});

test('las pausas del juego no cuentan como tiempo de sesión', () => {
  const { rec, at } = make();
  rec.start();
  at(1000);
  rec.pause();
  at(6000);
  rec.resume();
  at(7000);
  rec.end();
  assert.equal(computeMetrics(rec.events).durationMs, 2000);
});

test('los tiempos de las pulsaciones usan la hora real del teclado y no retroceden', () => {
  const { rec, at } = make();
  rec.start();
  at(500);
  rec.char({ typed: 'a', expected: 'a', correct: true, rejected: false, t: 1000 + 300 });
  rec.char({ typed: 'b', expected: 'b', correct: true, rejected: false, t: 1000 + 200 });
  const times = rec.events.filter((e) => e.type === 'char').map((e) => e.t);
  assert.deepEqual(times, [300, 300]);
});

test('texto: acentos, ñ y diferencias de edición', () => {
  assert.equal(fold('Limón'), 'limon');
  assert.equal(fold('piña'), 'piña');
  assert.equal(fold('pingüino'), 'pinguino');
  assert.equal(normalizeText('Limón', true), 'limón');
  assert.notEqual(normalizeText('limon', true), normalizeText('limón', true));
  assert.deepEqual(diffEdit('tac', 'taco'), { keep: 3, removed: '', added: 'o' });
  assert.deepEqual(diffEdit('taco', 'ta'), { keep: 2, removed: 'co', added: '' });
});
