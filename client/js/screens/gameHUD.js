import { network } from "../network/client.js";
import { sfx } from "../utils/audio.js";
import { PreloadScene } from "../game/PreloadScene.js";
import { RaceScene } from "../game/RaceScene.js";
import { PLAYER_COLOR_CSS } from "../config.js";

let phaserGame = null;
let timerInterval = null;
let reconnectInterval = null;

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function initGameHUD({ showScreen, appState }) {
  const plankBtn = document.getElementById("btn-place-plank");
  const timerEl = document.getElementById("hud-timer");
  const ranksEl = document.getElementById("hud-ranks");
  const reconnectBanner = document.getElementById("hud-reconnect-banner");
  const reconnectSeconds = document.getElementById("reconnect-seconds");

  plankBtn.addEventListener("click", () => {
    network.placePlank();
    sfx.plank();
    plankBtn.style.transform = "scale(0.92)";
    setTimeout(() => (plankBtn.style.transform = ""), 90);
  });

  let phaseWasRacing = false;

  window.__bridgeRace_bootGameCanvas = () => {
    if (phaserGame) return;
    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: "game-canvas-container",
      transparent: true,
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      scene: [PreloadScene, RaceScene],
    });
  };

  window.__bridgeRace_renderGameHUD = (state) => {
    const players = [...state.players.entries()].map(([sessionId, p]) => ({ sessionId, ...p }));

    // Timer
    if (state.phase === "racing" && state.raceStartAt) {
      if (!timerInterval) {
        timerInterval = setInterval(() => {
          timerEl.textContent = formatTime(Date.now() - state.raceStartAt);
        }, 250);
      }
    } else if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }

    // Live ranks, sorted by progress (finished players float to the top by finish time)
    const sorted = [...players].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.x - a.x;
    });
    ranksEl.innerHTML = "";
    sorted.forEach((p, i) => {
      const row = document.createElement("div");
      row.className = "hud-rank-row" + (p.sessionId === network.sessionId ? " self" : "");
      const dot = document.createElement("span");
      dot.className = "player-dot";
      dot.style.background = PLAYER_COLOR_CSS[p.colorIndex % PLAYER_COLOR_CSS.length];
      row.appendChild(dot);
      const label = document.createElement("span");
      const pct = Math.round((p.x / state.trackLength) * 100);
      label.textContent = `${i + 1}. ${p.name}${p.finished ? " ✔" : ` (${pct}%)`}`;
      row.appendChild(label);
      if (!p.connected) {
        const flag = document.createElement("span");
        flag.textContent = "⏳";
        flag.title = "Reconnecting…";
        row.appendChild(flag);
      }
      ranksEl.appendChild(row);
    });

    // Reconnect banner for the local player
    const me = state.players.get(network.sessionId);
    if (me && !me.connected) {
      reconnectBanner.classList.remove("hidden");
      if (!reconnectInterval) {
        let remaining = 30;
        reconnectSeconds.textContent = remaining;
        reconnectInterval = setInterval(() => {
          remaining -= 1;
          reconnectSeconds.textContent = Math.max(remaining, 0);
          if (remaining <= 0) clearInterval(reconnectInterval);
        }, 1000);
      }
    } else {
      reconnectBanner.classList.add("hidden");
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
        reconnectInterval = null;
      }
    }

    if (state.phase === "racing") phaseWasRacing = true;

    if (state.phase === "finished" && phaseWasRacing) {
      phaseWasRacing = false;
      appState.lastResults = sorted;
      showScreen("victory");
    }
  };
}
