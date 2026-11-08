import { systemClock } from '../../core/clock.ts';
import { computeMetrics } from '../../core/metrics.ts';
import { mulberry32 } from '../../core/random.ts';
import { SessionRecorder } from '../../core/recorder.ts';
import { normalizeText } from '../../core/text.ts';
import { taqueria } from '../../data/words.ts';
import { InputCapture } from '../../input/capture.ts';
import { fmt, h } from '../../ui/dom.ts';
import { play, type Sfx } from '../../ui/sfx.ts';
import { load, save } from '../../ui/storage.ts';
import { renderSummary } from '../../ui/summary.ts';
import { tacoSvg } from './art.ts';
import { configKey, DIFFICULTIES, DURATIONS_MS, sanitizeConfig, type TaqueroConfig } from './config.ts';
import { TaqueroEngine, type EndReason, type Plate } from './engine.ts';

const LANE_H = 96;
const TOP_PAD = 10;
const COUNTDOWN_MS = 2400;

const RANKS: ReadonlyArray<readonly [number, string]> = [
  [0, 'Comensal curioso'],
  [15, 'Ayudante de cocina'],
  [25, 'Taquero de banqueta'],
  [35, 'Taquero de la casa'],
  [50, 'Maestro taquero'],
  [70, 'Leyenda del trompo']
];

type ViewPhase = 'idle' | 'countdown' | 'playing' | 'paused' | 'ended';

interface PlateView {
  plate: Plate;
  el: HTMLElement;
  ok: HTMLElement;
  rest: HTMLElement;
  shown: number;
}

interface Best {
  score: number;
  wpm: number;
}

const TEMPLATE = `
<div class="game">
  <section class="hud" aria-label="Marcador">
    <div class="dato"><span class="et">Tiempo</span><span class="va" data-hud="time">1:00</span></div>
    <div class="dato"><span class="et">Puntos</span><span class="va" data-hud="score">0</span></div>
    <div class="dato"><span class="et" title="Palabras por minuto">PPM</span><span class="va" data-hud="wpm">—</span></div>
    <div class="dato"><span class="et">Precisión</span><span class="va" data-hud="acc">—</span></div>
    <div class="dato"><span class="et">Récord</span><span class="va" data-hud="best">—</span></div>
  </section>
  <div class="reloj" aria-hidden="true"><i data-hud="bar"></i></div>
  <div class="escena" data-el="stage">
    <div class="carriles" aria-hidden="true">
      <div class="carril"><div class="banda"></div></div>
      <div class="carril"><div class="banda"></div></div>
      <div class="carril"><div class="banda"></div></div>
    </div>
    <div class="platos" data-el="plates" aria-hidden="true"></div>
    <div class="borde-izq" aria-hidden="true"></div>
    <div class="velo" data-el="veil"></div>
  </div>
  <div class="captura">
    <input id="tipo" data-el="input" type="text" disabled enterkeyhint="done" aria-label="Escribe el nombre del plato" placeholder="Pulsa «Empezar turno» para jugar">
    <div class="racha" data-el="streak" hidden>Racha ×1</div>
    <button class="btn-sec" data-el="pause" type="button" disabled>Pausa</button>
  </div>
  <p class="como">Escribe el nombre de un plato para servirlo antes de que llegue al borde izquierdo. Cada letra equivocada corta tu racha, y la racha multiplica tus puntos.</p>
  <fieldset class="ajustes" data-el="settings">
    <legend>Ajustes del turno</legend>
    <div class="grupo">
      <div class="chips" role="group" aria-label="Dificultad" data-el="difficulty"></div>
      <p class="desc" data-el="difficulty-desc"></p>
    </div>
    <div class="chips" role="group" aria-label="Duración del turno" data-el="duration"></div>
    <div class="interruptores">
      <label><input type="checkbox" data-el="strict"> Acentos obligatorios</label>
      <label><input type="checkbox" data-el="perfect"> 100 % de precisión: un error termina el turno</label>
      <label><input type="checkbox" data-el="sound"> Sonido</label>
    </div>
    <p class="ayuda-acento">Con los acentos obligatorios, «limón» solo cuenta si escribes la ó. La ñ siempre es obligatoria. En computadora pulsa la tecla ´ (junto a la Ñ) y luego la vocal. En el celular mantén pulsada la vocal.</p>
  </fieldset>
  <div class="resultado" data-el="result" aria-live="polite"></div>
</div>`;

export function mountTaquero(host: HTMLElement): () => void {
  host.innerHTML = TEMPLATE;
  const q = <T extends HTMLElement>(name: string): T => host.querySelector(`[data-el="${name}"]`) as T;
  const hud = (name: string): HTMLElement => host.querySelector(`[data-hud="${name}"]`) as HTMLElement;

  const stage = q<HTMLElement>('stage');
  const platesEl = q<HTMLElement>('plates');
  const veil = q<HTMLElement>('veil');
  const input = q<HTMLInputElement>('input');
  const pauseBtn = q<HTMLButtonElement>('pause');
  const streakEl = q<HTMLElement>('streak');
  const settings = q<HTMLFieldSetElement>('settings');
  const result = q<HTMLElement>('result');
  const diffBox = q<HTMLElement>('difficulty');
  const diffDesc = q<HTMLElement>('difficulty-desc');
  const durBox = q<HTMLElement>('duration');
  const strictBox = q<HTMLInputElement>('strict');
  const perfectBox = q<HTMLInputElement>('perfect');
  const soundBox = q<HTMLInputElement>('sound');

  let cfg: TaqueroConfig = sanitizeConfig(load('taquero:cfg', null));
  let sound = load('taquero:sound', true);
  let phase: ViewPhase = 'idle';
  let stageW = stage.clientWidth || 800;
  let engine: TaqueroEngine | null = null;
  let recorder: SessionRecorder | null = null;
  let countdownEnd = 0;
  let countdownShown = 0;
  let charsServed = 0;
  let rafId = 0;
  const views = new Map<number, PlateView>();
  let demo: HTMLElement[] = [];

  const capture = new InputCapture(input);
  capture.onAction((action) => {
    engine?.input(action);
    refreshMarks();
  });

  const sfx = (kind: Sfx) => {
    if (sound) play(kind);
  };

  // ---------------------------------------------------------------- ajustes

  function renderSettings(): void {
    diffBox.replaceChildren(
      ...(Object.keys(DIFFICULTIES) as Array<keyof typeof DIFFICULTIES>).map((id) =>
        h('button', { class: 'chip', type: 'button', 'data-dif': id, 'aria-pressed': String(cfg.difficulty === id) }, DIFFICULTIES[id].label)
      )
    );
    durBox.replaceChildren(
      ...DURATIONS_MS.map((ms) =>
        h('button', { class: 'chip', type: 'button', 'data-dur': ms, 'aria-pressed': String(cfg.durationMs === ms) }, ms >= 120_000 ? '2 min' : `${ms / 1000} s`)
      )
    );
    diffDesc.textContent = DIFFICULTIES[cfg.difficulty].blurb;
    strictBox.checked = cfg.strictAccents;
    perfectBox.checked = cfg.perfect;
    soundBox.checked = sound;
    renderBest();
    hud('time').textContent = timeText(cfg.durationMs);
  }

  const onSettingsClick = (e: Event) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b || settings.disabled) return;
    if (b.dataset.dif) cfg = { ...cfg, difficulty: b.dataset.dif as TaqueroConfig['difficulty'] };
    else if (b.dataset.dur) cfg = { ...cfg, durationMs: Number(b.dataset.dur) };
    else return;
    save('taquero:cfg', cfg);
    renderSettings();
    if (phase === 'idle' || phase === 'ended') showVeil('idle');
  };
  settings.addEventListener('click', onSettingsClick);
  strictBox.addEventListener('change', () => {
    cfg = { ...cfg, strictAccents: strictBox.checked };
    save('taquero:cfg', cfg);
    renderSettings();
  });
  perfectBox.addEventListener('change', () => {
    cfg = { ...cfg, perfect: perfectBox.checked };
    save('taquero:cfg', cfg);
    renderSettings();
  });
  soundBox.addEventListener('change', () => {
    sound = soundBox.checked;
    save('taquero:sound', sound);
    if (sound) play('tick');
  });

  // ---------------------------------------------------------------- récord

  const bestKey = () => 'best:taquero:' + configKey(cfg);
  const readBest = (): Best | null => load<Best | null>(bestKey(), null);
  function renderBest(): void {
    const b = readBest();
    hud('best').textContent = b ? String(b.score) : '—';
  }

  // ---------------------------------------------------------------- velo

  function showVeil(kind: 'idle' | 'countdown' | 'pause' | 'end', extra?: { title: string; sub: string }): void {
    veil.hidden = false;
    veil.className = 'velo' + (kind === 'countdown' ? ' tenue' : '');
    if (kind === 'countdown') {
      veil.replaceChildren(h('div', { class: 'cuenta', 'data-el': 'count' }, '3'));
      return;
    }
    const start = h('button', { class: 'btn', type: 'button', 'data-act': 'start' }, kind === 'end' ? 'Otro turno' : 'Empezar turno');
    let card: HTMLElement;
    if (kind === 'pause') {
      card = h('div', { class: 'tarjeta' }, h('p', { class: 't-rango' }, 'En pausa'), h('button', { class: 'btn', type: 'button', 'data-act': 'resume' }, 'Continuar'));
    } else if (kind === 'end' && extra) {
      card = h('div', { class: 'tarjeta' }, h('p', { class: 'kicker' }, 'Se acabó el turno'), h('p', { class: 't-rango' }, extra.title), h('p', { class: 't-sub' }, extra.sub), start);
    } else {
      const dur = cfg.durationMs >= 120_000 ? '2 min' : `${cfg.durationMs / 1000} s`;
      card = h(
        'div',
        { class: 'tarjeta' },
        h('p', { class: 'kicker' }, `Turno de ${dur} · ${DIFFICULTIES[cfg.difficulty].label}${cfg.perfect ? ' · 100 %' : ''}`),
        start,
        h('p', { class: 'nota' }, 'Escribe el nombre de cada plato para servirlo.')
      );
    }
    veil.replaceChildren(card);
    (card.querySelector('button') as HTMLButtonElement | null)?.focus({ preventScroll: true });
  }
  veil.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button[data-act]') as HTMLElement | null;
    if (!b) return;
    if (b.dataset.act === 'start') startCountdown();
    else if (b.dataset.act === 'resume') resume();
  });

  // ---------------------------------------------------------------- platos

  function makePlateEl(word: string, variant: number): { el: HTMLElement; ok: HTMLElement; rest: HTMLElement } {
    const el = h('div', { class: 'plato' });
    el.innerHTML = `<div class="plato-in">${tacoSvg(variant)}<div class="comanda"><span class="ok"></span><span class="resto"></span></div></div>`;
    const ok = el.querySelector('.ok') as HTMLElement;
    const rest = el.querySelector('.resto') as HTMLElement;
    rest.textContent = word;
    return { el, ok, rest };
  }

  function addPlateView(plate: Plate): void {
    const { el, ok, rest } = makePlateEl(plate.word, plate.id);
    el.style.top = `${plate.lane * LANE_H + TOP_PAD}px`;
    el.style.transform = `translate3d(${stageW}px,0,0)`;
    platesEl.append(el);
    views.set(plate.id, { plate, el, ok, rest, shown: 0 });
    engine?.setPlateWidth(plate.id, el.offsetWidth / stageW);
  }

  function showDemo(): void {
    clearDemo();
    const words = taqueria.words[cfg.difficulty];
    const spots = [0.52, 0.16, 0.68];
    demo = spots.map((x, lane) => {
      const word = words[(lane * 7 + 3) % words.length] as string;
      const { el } = makePlateEl(word, lane + 1);
      el.style.top = `${lane * LANE_H + TOP_PAD}px`;
      platesEl.append(el);
      el.style.transform = `translate3d(${Math.min(x * stageW, stageW - el.offsetWidth - 12)}px,0,0)`;
      return el;
    });
  }
  function clearDemo(): void {
    for (const el of demo) el.remove();
    demo = [];
  }

  function refreshMarks(): void {
    if (!engine || engine.phase !== 'playing') return;
    const prefix = normalizeText(engine.value, cfg.strictAccents);
    const cands = prefix ? [...views.values()].filter((v) => v.plate.active && v.plate.norm.startsWith(prefix)) : [];
    const target = cands.length ? cands.reduce((a, b) => (a.plate.x < b.plate.x ? a : b)) : null;
    for (const v of views.values()) {
      const isCand = cands.includes(v);
      const n = isCand ? engine.value.length : 0;
      if (v.shown !== n) {
        v.ok.textContent = v.plate.word.slice(0, n);
        v.rest.textContent = v.plate.word.slice(n);
        v.shown = n;
      }
      v.el.classList.toggle('coincide', isCand && v !== target);
      v.el.classList.toggle('objetivo', v === target);
    }
  }

  // ---------------------------------------------------------------- flujo

  function lock(on: boolean): void {
    settings.disabled = on;
  }

  function startCountdown(): void {
    clearDemo();
    for (const v of views.values()) v.el.remove();
    views.clear();
    sfx('tick');
    recorder = new SessionRecorder(systemClock);
    engine = new TaqueroEngine({
      config: cfg,
      words: taqueria.words[cfg.difficulty],
      rng: mulberry32((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0),
      recorder
    });
    wireEngine(engine);
    charsServed = 0;
    phase = 'countdown';
    countdownEnd = performance.now() + COUNTDOWN_MS;
    countdownShown = 0;
    lock(true);
    result.replaceChildren();
    capture.setValue('');
    input.disabled = false;
    input.placeholder = 'Escribe aquí el nombre del plato';
    capture.focus();
    pauseBtn.disabled = true;
    streakEl.hidden = true;
    stage.style.setProperty('--bt', `${24 / (DIFFICULTIES[cfg.difficulty].speed * stageW)}s`);
    showVeil('countdown');
  }

  function wireEngine(e: TaqueroEngine): void {
    e.events.on('spawn', addPlateView);
    e.events.on('value', (v) => capture.setValue(v));
    e.events.on('reject', () => {
      input.classList.remove('mal');
      void input.offsetWidth;
      input.classList.add('mal');
      sfx('err');
    });
    e.events.on('serve', ({ plate, points }) => {
      charsServed += plate.word.length;
      const v = views.get(plate.id);
      if (v) {
        views.delete(plate.id);
        v.el.querySelector('.plato-in')?.classList.add('servido');
        const pop = h('div', { class: 'pts' }, `+${points}`);
        pop.style.left = `${plate.x * stageW + v.el.offsetWidth / 2 - 18}px`;
        pop.style.top = `${plate.lane * LANE_H + TOP_PAD - 4}px`;
        platesEl.append(pop);
        setTimeout(() => {
          pop.remove();
          v.el.remove();
        }, 820);
      }
      sfx('ok');
    });
    e.events.on('miss', (plate) => {
      views.get(plate.id)?.el.remove();
      views.delete(plate.id);
      stage.classList.remove('enojo');
      void stage.offsetWidth;
      stage.classList.add('enojo');
      sfx('miss');
    });
    e.events.on('end', (reason) => finish(reason));
  }

  function beginPlay(now: number): void {
    if (!engine) return;
    phase = 'playing';
    engine.begin(now);
    veil.hidden = true;
    pauseBtn.disabled = false;
    pauseBtn.textContent = 'Pausa';
    streakEl.hidden = false;
    sfx('go');
    capture.focus();
  }

  function pause(): void {
    if (phase !== 'playing' || !engine) return;
    phase = 'paused';
    engine.pause();
    input.disabled = true;
    pauseBtn.textContent = 'Seguir';
    showVeil('pause');
  }

  function resume(): void {
    if (phase !== 'paused' || !engine) return;
    phase = 'playing';
    engine.resume(performance.now());
    input.disabled = false;
    pauseBtn.textContent = 'Pausa';
    veil.hidden = true;
    capture.focus();
  }

  function rankFor(wpm: number): string {
    let name = RANKS[0]![1];
    for (const [min, label] of RANKS) if (wpm >= min) name = label;
    return name;
  }

  function finish(reason: EndReason): void {
    if (!engine || !recorder) return;
    phase = 'ended';
    capture.setValue('');
    input.disabled = true;
    input.placeholder = 'Turno terminado';
    pauseBtn.disabled = true;
    streakEl.hidden = true;
    lock(false);
    refreshMarksClear();

    const m = computeMetrics(recorder.events);
    const prev = readBest();
    const isBest = engine.score > 0 && (!prev || engine.score > prev.score);
    if (isBest) save(bestKey(), { score: engine.score, wpm: Math.round(m.wpm) } satisfies Best);
    renderBest();

    const rank = rankFor(m.wpm);
    const title = reason === 'error' ? '¡Te equivocaste!' : rank;
    const sub = `${fmt(m.wpm)} PPM · ${m.accuracy === null ? '—' : fmt(m.accuracy, 1) + ' %'} · ${engine.score} pts`;
    showVeil('end', { title, sub });
    const note = isBest ? 'Nuevo récord personal en esta configuración.' : prev ? `Tu récord en esta configuración: ${prev.score} puntos.` : undefined;
    result.replaceChildren(
      renderSummary(m, {
        title: reason === 'error' ? 'Turno terminado por un error' : rank,
        subtitle: [note, `${engine.score} puntos · mejor racha ${engine.bestStreak}`].filter(Boolean).join(' · ')
      })
    );
    sfx('end');
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    result.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
  }

  function refreshMarksClear(): void {
    for (const v of views.values()) {
      v.ok.textContent = '';
      v.rest.textContent = v.plate.word;
      v.shown = 0;
      v.el.classList.remove('coincide', 'objetivo');
    }
  }

  // ---------------------------------------------------------------- bucle

  const timeText = (ms: number) => {
    const s = Math.ceil(ms / 1000 - 1e-6);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  };

  function renderHud(): void {
    const e = engine;
    const active = phase === 'playing' || phase === 'paused';
    const remaining = e && (active || phase === 'ended') ? e.remainingMs : cfg.durationMs;
    hud('time').textContent = timeText(phase === 'ended' ? 0 : remaining);
    hud('score').textContent = String(e?.score ?? 0);
    const elapsed = e?.elapsedMs ?? 0;
    hud('wpm').textContent = e && elapsed >= 6000 && charsServed > 0 ? fmt(charsServed / 5 / (elapsed / 60000)) : '—';
    const total = e ? e.correctKeys + e.errors : 0;
    hud('acc').textContent = total ? `${fmt((e!.correctKeys / total) * 100)} %` : '—';
    hud('bar').style.transform = `scaleX(${(phase === 'ended' ? 0 : remaining / cfg.durationMs).toFixed(4)})`;
    if (!streakEl.hidden && e) streakEl.textContent = `Racha ×${String(e.multiplier).replace('.', ',')}`;
  }

  function frame(now: number): void {
    rafId = requestAnimationFrame(frame);
    if (phase === 'countdown') {
      const left = countdownEnd - now;
      if (left <= 0) beginPlay(now);
      else {
        const n = Math.ceil(left / 600);
        if (n !== countdownShown) {
          countdownShown = n;
          const c = veil.querySelector('[data-el="count"]');
          if (c) c.textContent = n === 1 ? '¡Ya!' : String(n - 1);
          if (n > 1) sfx('tick');
        }
      }
    }
    if (phase === 'playing' && engine) {
      engine.tick(now);
      for (const v of views.values()) {
        v.el.style.transform = `translate3d(${(v.plate.x * stageW).toFixed(1)}px,0,0)`;
        v.el.classList.toggle('entrando', !v.plate.active);
      }
      refreshMarks();
    }
    renderHud();
  }

  // ---------------------------------------------------------------- eventos globales

  const onVisibility = () => {
    if (document.hidden) pause();
  };
  document.addEventListener('visibilitychange', onVisibility);
  pauseBtn.addEventListener('click', () => (phase === 'playing' ? pause() : resume()));
  stage.addEventListener('pointerdown', () => {
    if (phase === 'playing') capture.focus();
  });
  input.addEventListener('animationend', () => input.classList.remove('mal'));
  const onKeydown = (e: KeyboardEvent) => {
    if (phase !== 'playing' || document.activeElement === input) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key.length === 1 || e.key === 'Dead') capture.focus();
  };
  document.addEventListener('keydown', onKeydown);

  const ro = new ResizeObserver(() => {
    stageW = stage.clientWidth || stageW;
    for (const v of views.values()) engine?.setPlateWidth(v.plate.id, v.el.offsetWidth / stageW);
  });
  ro.observe(stage);

  renderSettings();
  showDemo();
  showVeil('idle');
  rafId = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(rafId);
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    document.removeEventListener('keydown', onKeydown);
    capture.destroy();
    engine?.stop();
    engine?.events.clear();
    host.textContent = '';
  };
}
