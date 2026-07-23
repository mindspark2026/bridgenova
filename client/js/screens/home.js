import { sfx } from "../utils/audio.js";

export function initHome({ showScreen }) {
  document.getElementById("btn-play").addEventListener("click", () => {
    sfx.click();
    showScreen("login");
  });
  document.getElementById("btn-settings-home").addEventListener("click", () => {
    sfx.click();
    showScreen("settings");
  });
}
