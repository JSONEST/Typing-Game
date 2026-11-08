import type { SessionMetrics, WordStat } from '../core/metrics.ts';
import { fmt, h, s } from './dom.ts';

export interface SummaryOptions {
  title: string;
  subtitle?: string;
}

const seconds = (ms: number) => fmt(ms / 1000, 1) + ' s';

/** Pantalla de resumen. Es la misma para cualquier modo de juego. */
export function renderSummary(m: SessionMetrics, o: SummaryOptions): HTMLElement {
  const root = h('section', { class: 'summary', 'aria-labelledby': 'sum-title' });
  const parts: Array<HTMLElement | null> = [
    h('header', { class: 'sum-head' }, h('h2', { id: 'sum-title' }, o.title), o.subtitle ? h('p', null, o.subtitle) : null),
    stats(m),
    block('Velocidad a lo largo del turno', chart(m), 'Las marcas rojas de abajo son pulsaciones incorrectas.'),
    block('Palabra por palabra', wordStrip(m), 'Verde: más rápida que tu ritmo normal. Rojo: más lenta. Un punto marca palabras con errores o pausas largas.'),
    m.slowest.length || m.stuck.length || m.troubleKeys.length ? block('Donde te costó más', trouble(m)) : null,
    block('Qué escribiste y qué borraste', replay(m), 'Tachado en rojo: lo que escribiste y borraste. Rojo claro: letra rechazada. Entre letras aparece la pausa si fue mayor a 0,7 s.'),
    m.lost.length ? block('Platos perdidos', lostList(m)) : null
  ];
  for (const p of parts) if (p) root.append(p);
  return root;
}

function block(title: string, body: Node, note?: string): HTMLElement {
  return h('section', { class: 'sum-block' }, h('h3', null, title), body, note ? h('p', { class: 'sum-note' }, note) : null);
}

function stat(label: string, value: string, hint?: string): HTMLElement {
  return h('div', null, h('dt', null, label), h('dd', null, value), hint ? h('span', { class: 'hint' }, hint) : null);
}

function stats(m: SessionMetrics): HTMLElement {
  return h(
    'dl',
    { class: 'sum-stats' },
    stat('PPM', fmt(m.wpm), 'neto: solo palabras completas'),
    stat('PPM bruto', fmt(m.wpmGross), 'todas las pulsaciones'),
    stat('Precisión', m.accuracy === null ? '—' : fmt(m.accuracy, 1) + ' %'),
    stat('Consistencia', m.consistency === null ? '—' : fmt(m.consistency) + ' %', 'qué tan parejo es tu ritmo'),
    stat('Palabras', String(m.wordsDone), m.wordsLost ? `${m.wordsLost} perdidas` : 'ninguna perdida'),
    stat('Errores', String(m.errors)),
    stat('Borrados', String(m.erasedChars), 'letras'),
    stat('Tiempo', seconds(m.durationMs))
  );
}

/** Promedio móvil de 3 segundos para que la línea sea legible. */
function smooth(values: readonly number[]): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - 1);
    const to = Math.min(values.length - 1, i + 1);
    let sum = 0;
    for (let k = from; k <= to; k++) sum += values[k] as number;
    return sum / (to - from + 1);
  });
}

function chart(m: SessionMetrics): Node {
  if (m.perSecond.length < 3) return h('p', { class: 'sum-note' }, 'El turno fue muy corto para dibujar la gráfica.');

  const W = 640;
  const H = 190;
  const L = 40;
  const R = 10;
  const T = 10;
  const B = 28;
  const data = smooth(m.perSecond);
  const peak = Math.max(...data, 10);
  const yMax = Math.ceil(peak / 10) * 10;
  const n = data.length;
  const x = (sec: number) => L + (sec / Math.max(1, n - 1)) * (W - L - R);
  const xTime = (ms: number) => L + Math.min(1, ms / m.durationMs) * (W - L - R);
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B);

  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': 'PPM por segundo' });
  for (const v of [0, yMax / 2, yMax]) {
    svg.append(
      s('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), class: 'ch-grid' }),
      s('text', { x: L - 6, y: y(v) + 4, class: 'ch-label', 'text-anchor': 'end' }, String(Math.round(v)))
    );
  }
  const step = n > 90 ? 30 : n > 40 ? 10 : 5;
  for (let sec = 0; sec <= n; sec += step) {
    svg.append(s('text', { x: x(Math.min(sec, n - 1)), y: H - 8, class: 'ch-label', 'text-anchor': 'middle' }, `${sec} s`));
  }
  const line = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  svg.append(
    s('path', { d: `${line} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`, class: 'ch-area' }),
    s('path', { d: line, class: 'ch-line' })
  );
  for (const t of m.errorTimes) {
    svg.append(s('line', { x1: xTime(t), x2: xTime(t), y1: H - B - 12, y2: H - B, class: 'ch-err' }));
  }
  return svg;
}

function ratioClass(w: WordStat, median: number | null): string {
  if (w.msPerKey === null || median === null || median === 0) return 'mid';
  const r = w.msPerKey / median;
  if (r < 0.85) return 'fast';
  if (r <= 1.2) return 'mid';
  if (r <= 1.6) return 'slow';
  return 'veryslow';
}

function describe(w: WordStat): string {
  const parts = [`${w.word}`];
  if (w.msPerKey !== null) parts.push(`${fmt(w.msPerKey)} ms por tecla`);
  parts.push(`reacción ${seconds(w.reactionMs)}`);
  if (w.errors) parts.push(`${w.errors} ${w.errors === 1 ? 'error' : 'errores'}`);
  if (w.stalled) parts.push(`pausa de ${seconds(w.longestPauseMs)}`);
  return parts.join(' · ');
}

function wordStrip(m: SessionMetrics): Node {
  if (!m.words.length) return h('p', { class: 'sum-note' }, 'No completaste ninguna palabra en este turno.');
  const list = h('ul', { class: 'strip' });
  for (const w of m.words) {
    const flag = w.errors > 0 || w.stalled;
    list.append(h('li', { class: `chip-w ${ratioClass(w, m.medianMsPerKey)}`, title: describe(w) }, w.word, flag ? h('i', { 'aria-label': 'con errores o pausa' }) : null));
  }
  return list;
}

function table(rows: WordStat[], cols: Array<[string, (w: WordStat) => string]>): HTMLElement {
  const head = h('tr', null, h('th', { scope: 'col' }, 'Palabra'), ...cols.map(([c]) => h('th', { scope: 'col' }, c)));
  const body = rows.map((w) => h('tr', null, h('th', { scope: 'row' }, w.word), ...cols.map(([, f]) => h('td', null, f(w)))));
  return h('div', { class: 'scroll-x' }, h('table', null, h('thead', null, head), h('tbody', null, ...body)));
}

function trouble(m: SessionMetrics): Node {
  const wrap = h('div', { class: 'two-col' });
  if (m.slowest.length) {
    wrap.append(
      h(
        'div',
        null,
        h('h4', null, 'Más lentas'),
        table(m.slowest, [
          ['ms por tecla', (w) => fmt(w.msPerKey ?? 0)],
          ['PPM', (w) => fmt(w.wpm ?? 0)]
        ])
      )
    );
  }
  if (m.stuck.length) {
    wrap.append(
      h(
        'div',
        null,
        h('h4', null, 'Te estancaste'),
        table(m.stuck, [
          ['Pausa', (w) => seconds(w.longestPauseMs)],
          ['Reacción', (w) => seconds(w.reactionMs)]
        ])
      )
    );
  }
  if (m.troubleKeys.length) {
    wrap.append(
      h(
        'div',
        null,
        h('h4', null, 'Letras que más fallaste'),
        h('p', { class: 'keys' }, ...m.troubleKeys.flatMap((k) => [h('kbd', null, k.key), h('span', null, `${k.count}×`)]))
      )
    );
  }
  return wrap;
}

function replay(m: SessionMetrics): Node {
  const messy = m.words
    .filter((w) => w.errors > 0 || w.erasedChars > 0 || w.stalled)
    .sort((a, b) => b.errors * 2 + b.erasedChars + b.longestPauseMs / 1000 - (a.errors * 2 + a.erasedChars + a.longestPauseMs / 1000))
    .slice(0, 12);
  if (!messy.length) return h('p', { class: 'sum-note' }, 'No tuviste errores, borrados ni pausas largas. Turno limpio.');

  const list = h('ol', { class: 'replay' });
  for (const w of messy) {
    const line = h('p', { class: 'trace', 'aria-label': describe(w) });
    for (const t of w.trace) {
      if (t.gapMs >= 700) line.append(h('span', { class: 'gap' }, seconds(t.gapMs)));
      line.append(h('span', { class: `tk ${t.kind}${t.wrong ? ' wrong' : ''}` }, t.ch === ' ' ? '␣' : t.ch));
    }
    list.append(h('li', null, h('span', { class: 'rp-word' }, w.word), line));
  }
  return list;
}

function lostList(m: SessionMetrics): Node {
  const list = h('ul', { class: 'strip' });
  for (const l of m.lost) list.append(h('li', { class: 'chip-w veryslow' }, l.word));
  return list;
}
