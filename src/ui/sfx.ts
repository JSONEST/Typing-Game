export type Sfx = 'ok' | 'err' | 'miss' | 'tick' | 'go' | 'end';

let ctx: AudioContext | null = null;

/** Efectos de sonido sintetizados. Solo suenan después de una interacción del usuario. */
export function play(kind: Sfx): void {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const c = ctx;
    const t0 = c.currentTime;
    const tone = (freq: number, dur: number, type: OscillatorType, gain: number, at = 0) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0 + at);
      g.gain.exponentialRampToValueAtTime(gain, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(c.destination);
      o.start(t0 + at);
      o.stop(t0 + at + dur + 0.03);
    };
    switch (kind) {
      case 'ok':
        tone(660, 0.09, 'triangle', 0.08);
        tone(990, 0.12, 'triangle', 0.07, 0.07);
        break;
      case 'err':
        tone(140, 0.12, 'square', 0.04);
        break;
      case 'miss':
        tone(240, 0.22, 'sawtooth', 0.04);
        tone(170, 0.26, 'sawtooth', 0.05, 0.12);
        break;
      case 'tick':
        tone(440, 0.1, 'sine', 0.07);
        break;
      case 'go':
        tone(880, 0.22, 'triangle', 0.08);
        break;
      case 'end':
        [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.07, i * 0.11));
        break;
    }
  } catch {
    /* sin audio disponible */
  }
}
