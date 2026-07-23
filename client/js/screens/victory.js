import { network } from "../network/client.js";
import { sfx } from "../utils/audio.js";
import { loadSettings } from "../utils/storage.js";
import { PLAYER_COLOR_CSS } from "../config.js";

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

function spawnConfetti(layer) {
  if (loadSettings().reducedMotion) return;
  layer.innerHTML = "";
  const colors = PLAYER_COLOR_CSS;
  for (let i = 0; i < 60; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${2 + Math.random() * 2}s`;
    piece.style.animationDelay = `${Math.random() * 0.6}s`;
    layer.appendChild(piece);
  }
}

export function initVictory({ showScreen, appState }) {
  const title = document.getElementById("victory-title");
  const subtitle = document.getElementById("victory-subtitle");
  const medal = document.getElementById("victory-medal");
  const confettiLayer = document.getElementById("confetti-layer");

  document.getElementById("btn-victory-leaderboard").addEventListener("click", () => {
    sfx.click();
    showScreen("leaderboard");
  });
  document.getElementById("btn-play-again").addEventListener("click", () => {
    sfx.click();
    network.leaveRoom(true);
    showScreen("lobby");
  });
  document.getElementById("btn-victory-home").addEventListener("click", () => {
    sfx.click();
    network.leaveRoom(true);
    showScreen("home");
  });

  window.__bridgeRace_renderVictory = () => {
    const results = appState.lastResults || [];
    const me = results.find((p) => p.sessionId === network.sessionId);
    const myRank = me ? results.indexOf(me) + 1 : results.length;

    sfx.finish();
    const medals = ["🏆", "🥈", "🥉"];
    medal.textContent = medals[myRank - 1] || "🏁";
    title.textContent = myRank === 1 ? "You Win!" : `You Finished #${myRank}`;
    subtitle.textContent = me?.finished
      ? `Finished in ${formatTime(me.finishTimeMs)}`
      : "Race complete";

    spawnConfetti(confettiLayer);
  };
}
