import { network } from "../network/client.js";
import { sfx } from "../utils/audio.js";
import { MAX_PLAYERS, MIN_PLAYERS, PLAYER_COLOR_CSS } from "../config.js";

let countdownInterval = null;
let lastKnownPhase = "waiting";
let lastPlayerCount = 0;

export function initWaitingRoom({ showScreen, appState, toast }) {
  const listEl = document.getElementById("waiting-player-list");
  const countLabel = document.getElementById("player-count-label");
  const fullBadge = document.getElementById("room-full-badge");
  const codeBadge = document.getElementById("room-code-badge");
  const codeValue = document.getElementById("room-code-value");
  const startBtn = document.getElementById("btn-start-game");
  const leaveBtn = document.getElementById("btn-leave-room");
  const countdownBanner = document.getElementById("countdown-banner");
  const countdownValue = document.getElementById("countdown-value");
  const copyBtn = document.getElementById("btn-copy-code");

  copyBtn.addEventListener("click", () => {
    navigator.clipboard?.writeText(codeValue.textContent);
    toast("Room code copied!");
  });

  startBtn.addEventListener("click", () => {
    sfx.click();
    network.startGame();
  });

  leaveBtn.addEventListener("click", () => {
    sfx.click();
    network.leaveRoom(true);
    showScreen("lobby");
  });

  network.on("leave", () => {
    if (document.getElementById("screen-waiting").classList.contains("active")) {
      toast("You left the room.");
      showScreen("lobby");
    }
  });

  // Exposed so main.js's global state dispatcher can push updates in.
  window.__bridgeRace_renderWaitingRoom = (state) => {
    const players = [...state.players.entries()].map(([sessionId, p]) => ({ sessionId, ...p }));
    const count = players.length;

    countLabel.textContent = `${count}/${state.maxPlayers} Players`;
    fullBadge.classList.toggle("hidden", count < state.maxPlayers);

    if (appState.isPrivateRoom && state.roomCode) {
      codeBadge.classList.remove("hidden");
      codeValue.textContent = state.roomCode;
    } else {
      codeBadge.classList.add("hidden");
    }

    listEl.innerHTML = "";
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = players[i];
      const slot = document.createElement("div");
      if (p) {
        slot.className = "player-slot";
        const dot = document.createElement("span");
        dot.className = "player-dot";
        dot.style.background = PLAYER_COLOR_CSS[p.colorIndex % PLAYER_COLOR_CSS.length];
        slot.appendChild(dot);
        const nameSpan = document.createElement("span");
        nameSpan.textContent = p.name + (p.sessionId === network.sessionId ? " (you)" : "");
        slot.appendChild(nameSpan);
        if (p.isHost) {
          const hostTag = document.createElement("span");
          hostTag.className = "player-host-tag";
          hostTag.textContent = "HOST";
          slot.appendChild(hostTag);
        }
      } else {
        slot.className = "player-slot empty";
        slot.textContent = "Open slot";
      }
      listEl.appendChild(slot);
    }

    if (count > lastPlayerCount) sfx.playerJoin();
    lastPlayerCount = count;

    const isHost = state.hostId === network.sessionId;
    startBtn.classList.toggle("hidden", !isHost);
    startBtn.disabled = count < state.minPlayers;
    startBtn.textContent =
      count < state.minPlayers
        ? `Start Game (need ${state.minPlayers}+ players)`
        : "Start Game";

    if (state.phase === "countdown") {
      countdownBanner.classList.remove("hidden");
      startBtn.disabled = true;
      if (!countdownInterval) {
        let remaining = Math.ceil(state.countdownMs / 1000);
        countdownValue.textContent = remaining;
        countdownInterval = setInterval(() => {
          remaining -= 1;
          countdownValue.textContent = Math.max(remaining, 0);
          sfx.countdownTick();
          if (remaining <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
          }
        }, 1000);
      }
    } else {
      countdownBanner.classList.add("hidden");
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    if (state.phase === "racing" && lastKnownPhase !== "racing") {
      sfx.countdownGo();
      showScreen("game");
    }
    lastKnownPhase = state.phase;
  };
}
