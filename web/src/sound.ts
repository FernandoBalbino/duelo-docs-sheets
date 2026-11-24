// Sons sintetizados (Web Audio, sem arquivos), só na TV: o Chromebook fica sem som para a sala não virar barulho.
import { useSyncExternalStore } from 'react';

type Note = [freq: number, start: number, dur: number];
const NOTES = {
  tick: [[1250, 0, 0.025]],
  land: [[523, 0, 0.08], [784, 0.08, 0.16]],
  slam: [[98, 0, 0.45], [147, 0, 0.35], [196, 0.02, 0.3]],
  reveal: [[660, 0, 0.1], [880, 0.1, 0.22]],
  count: [[880, 0, 0.09]],
  go: [[523, 0, 0.1], [659, 0.1, 0.1], [784, 0.2, 0.1], [1047, 0.3, 0.35]],
  timeup: [[392, 0, 0.16], [330, 0.16, 0.16], [262, 0.32, 0.3]],
  vote: [[1400, 0, 0.04], [1800, 0.04, 0.05]],
  step: [[330, 0, 0.06], [440, 0.07, 0.06], [554, 0.14, 0.06], [659, 0.21, 0.18]],
  type: [[1900, 0, 0.012]],
  ok: [[660, 0, 0.09], [880, 0.09, 0.18]],
  bad: [[247, 0, 0.12], [196, 0.12, 0.24]],
  fanfare: [[523, 0, 0.12], [659, 0.12, 0.12], [784, 0.24, 0.12], [1047, 0.36, 0.2], [784, 0.56, 0.12], [1047, 0.68, 0.5]],
} satisfies Record<string, Note[]>;
export type SoundName = keyof typeof NOTES;

const KEY = 'duelo-docs-sheets:mudo';
const listeners = new Set<() => void>();
let ctx: AudioContext | null = null;
let muted = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

export function play(name: SoundName, volume = 0.16) {
  if (muted) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t0 = ctx.currentTime + 0.01;
    for (const [freq, start, dur] of NOTES[name]) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = name === 'tick' || name === 'vote' || name === 'type' ? 'square' : name === 'slam' ? 'sawtooth' : 'triangle';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t0 + start);
      gain.gain.exponentialRampToValueAtTime(volume, t0 + start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0 + start);
      osc.stop(t0 + start + dur + 0.02);
    }
  } catch {
    /* navegador sem Web Audio: segue sem som */
  }
}

export function toggleMuted() {
  muted = !muted;
  listeners.forEach((f) => f());
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch { /* sem storage */ }
}

export const useMuted = () => useSyncExternalStore((f) => (listeners.add(f), () => void listeners.delete(f)), () => muted);
