import { network } from "./network/client.js";
import { loadSettings } from "./utils/storage.js";
import { startMusic } from "./utils/audio.js";

import { initHome } from "./screens/home.js";
import { initLogin } from "./screens/login.js";
import { initLobby } from "./screens/lobby.js";
import { initWaitingRoom } from "./screens/waitingRoom.js";
import { initGameHUD } from "./screens/gameHUD.js";
import { initLeaderboard } from "./screens/leaderboard.js";
import { initVictory } from "./screens/victory.js";
import { initSettings } from "./screens/settings.js";

const appState = {
  playerName: loadSettings().playerName || "",
  isPrivateRoom: false,
  lastResults: [],
  previousScreen: "home",
};

let currentScreen = "home";

function showScreen(id) {
  const prev = currentScreen;
  document.querySelectorAll(".screen").forEach((el) => el.classList.remove("active"));
  const target = document.getElementById(`screen-${id}`);
  if (!target) return;
  target.classList.add("active");
  appState.previousScreen = prev;
  currentScreen = id;

  if (id === "game") {
    window.__bridgeRace_bootGameCanvas?.();
    if (network.state) window.__bridgeRace_renderGameHUD?.(network.state);
  }
  if (id === "leaderboard") window.__bridgeRace_renderLeaderboard?.();
  if (id === "victory") window.__bridgeRace_renderVictory?.();
  if (id === "waiting" && network.state) window.__bridgeRace_renderWaitingRoom?.(network.state);
}

function toast(message) {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

const ctx = { showScreen, appState, toast };

initHome(ctx);
initLogin(ctx);
initLobby(ctx);
initWaitingRoom(ctx);
initGameHUD(ctx);
initLeaderboard(ctx);
initVictory(ctx);
initSettings(ctx);

// Route every authoritative state push to whichever screen(s) care about it.
// The waiting room and in-game HUD are the two screens with live server data;
// leaderboard/victory pull from appState.lastResults (a snapshot taken once
// the race ends), so they don't need live updates.
network.on("state", (state) => {
  window.__bridgeRace_renderWaitingRoom?.(state);
  window.__bridgeRace_renderGameHUD?.(state);
});

network.on("error", ({ message }) => {
  toast(message || "Connection error.");
});

network.on("leave", (code) => {
  // code 4000+ are custom/app-level closes; anything unexpected gets surfaced.
  if (code && code >= 4000 && currentScreen !== "lobby" && currentScreen !== "home") {
    toast("Disconnected from the match.");
  }
});

// First user interaction unlocks the WebAudio context + optional music,
// per browser autoplay policies.
window.addEventListener(
  "pointerdown",
  () => {
    if (loadSettings().musicOn) startMusic();
  },
  { once: true }
);

showScreen("home");
