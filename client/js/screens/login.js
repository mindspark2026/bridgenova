import { sfx } from "../utils/audio.js";
import { loadSettings, saveSettings } from "../utils/storage.js";

export function initLogin({ showScreen, appState }) {
  const input = document.getElementById("input-name");
  input.value = loadSettings().playerName || "";

  document.getElementById("btn-continue-guest").addEventListener("click", () => {
    sfx.click();
    const name = input.value.trim() || `Guest${Math.floor(1000 + Math.random() * 9000)}`;
    saveSettings({ playerName: name });
    appState.playerName = name;
    showScreen("lobby");
  });

  document.getElementById("btn-back-home-login").addEventListener("click", () => {
    sfx.click();
    showScreen("home");
  });
}
