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

network.on("drop", () => {
  if (currentScreen === "game" || currentScreen === "waiting") {
    toast("Connection lost - reconnecting…");
  }
});

network.on("reconnect", () => {
  if (currentScreen === "game" || currentScreen === "waiting") {
    toast("Reconnected!");
  }
});

network.on("leave", (code) => {
  const FAILED_TO_RECONNECT = window.Colyseus?.CloseCode?.FAILED_TO_RECONNECT ?? 4003;
  if (code === FAILED_TO_RECONNECT) {
    toast("Could not reconnect to the match.");
    showScreen("lobby");
    return;
  }
  // 4000+ (besides a normal consented leave already handled by the
  // screen that triggered it) are unexpected app/server-level closes.
  if (code && code >= 4001 && currentScreen !== "lobby" && currentScreen !== "home") {
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

// On a hard page refresh mid-match, try to resume the previous session
// before falling back to the home screen.
network.tryResumeSession().then((room) => {
  if (!room) {
    showScreen("home");
    return;
  }
  const state = room.state;
  if (state.phase === "racing" || state.phase === "countdown") {
    showScreen("game");
  } else if (state.phase === "waiting") {
    showScreen("waiting");
  } else {
    showScreen("home");
  }
});
