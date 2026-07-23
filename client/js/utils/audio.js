import { loadSettings } from "./storage.js";

// All sound effects here are synthesized at runtime with the Web Audio API.
// No third-party or copyrighted audio files are used anywhere in this project.

let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function gainForVolume() {
  const s = loadSettings();
  if (!s.sfxOn) return 0;
  return Math.max(0, Math.min(1, s.volume / 100)) * 0.5;
}

function tone({ freq = 440, duration = 0.12, type = "sine", startGain = null, sweepTo = null }) {
  const s = loadSettings();
  if (!s.sfxOn) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, c.currentTime + duration);

  const peak = startGain !== null ? startGain : gainForVolume();
  gain.gain.setValueAtTime(0.0001, c.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), c.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);

  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + duration + 0.02);
}

export const sfx = {
  click: () => tone({ freq: 520, duration: 0.06, type: "square" }),
  plank: () => tone({ freq: 220, duration: 0.09, type: "triangle", sweepTo: 340 }),
  countdownTick: () => tone({ freq: 660, duration: 0.1, type: "sine" }),
  countdownGo: () => tone({ freq: 880, duration: 0.25, type: "sine", sweepTo: 1200 }),
  playerJoin: () => tone({ freq: 400, duration: 0.08, type: "sine", sweepTo: 620 }),
  finish: () => tone({ freq: 500, duration: 0.35, type: "sine", sweepTo: 1000 }),
  error: () => tone({ freq: 180, duration: 0.18, type: "sawtooth" }),
};

// Minimal ambient "music" - a soft pulsing pad, generated on the fly, looped
// while the settings toggle is on. Kept subtle and optional.
let musicNodes = null;
export function startMusic() {
  const s = loadSettings();
  if (!s.musicOn || musicNodes) return;
  const c = getCtx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = "sine";
  osc.frequency.value = 110;
  gain.gain.value = Math.min(0.05, (s.volume / 100) * 0.08);
  osc.connect(gain).connect(c.destination);
  osc.start();
  musicNodes = { osc, gain };
}
export function stopMusic() {
  if (!musicNodes) return;
  musicNodes.osc.stop();
  musicNodes = null;
}
