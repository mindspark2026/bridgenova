import { network } from "../network/client.js";
import { sfx } from "../utils/audio.js";

function formatTime(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
  const s = String(totalSec % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export function initLeaderboard({ showScreen, appState }) {
  const rowsEl = document.getElementById("leaderboard-rows");

  document.getElementById("btn-leaderboard-continue").addEventListener("click", () => {
    sfx.click();
    network.leaveRoom(true);
    showScreen("home");
  });

  window.__bridgeRace_renderLeaderboard = () => {
    const results = appState.lastResults || [];
    rowsEl.innerHTML = "";
    results.forEach((p, i) => {
      const tr = document.createElement("tr");
      if (p.sessionId === network.sessionId) tr.classList.add("self-row");
      const progressOrTime = p.finished ? formatTime(p.finishTimeMs) : `${Math.round(p.x / 10)}%`;
      tr.innerHTML = `<td>${i + 1}</td><td>${p.name}</td><td>${progressOrTime}</td><td>${p.planksPlaced}</td>`;
      rowsEl.appendChild(tr);
    });
  };
}
