import { sfx, startMusic, stopMusic } from "../utils/audio.js";
import { loadSettings, saveSettings } from "../utils/storage.js";

export function initSettings({ showScreen, appState }) {
  const musicToggle = document.getElementById("toggle-music");
  const sfxToggle = document.getElementById("toggle-sfx");
  const volumeRange = document.getElementById("range-volume");
  const motionToggle = document.getElementById("toggle-reduced-motion");

  const s = loadSettings();
  musicToggle.checked = s.musicOn;
  sfxToggle.checked = s.sfxOn;
  volumeRange.value = s.volume;
  motionToggle.checked = s.reducedMotion;
  document.body.classList.toggle("reduced-motion", s.reducedMotion);

  musicToggle.addEventListener("change", () => {
    saveSettings({ musicOn: musicToggle.checked });
    musicToggle.checked ? startMusic() : stopMusic();
  });
  sfxToggle.addEventListener("change", () => {
    saveSettings({ sfxOn: sfxToggle.checked });
    if (sfxToggle.checked) sfx.click();
  });
  volumeRange.addEventListener("input", () => {
    saveSettings({ volume: Number(volumeRange.value) });
  });
  motionToggle.addEventListener("change", () => {
    saveSettings({ reducedMotion: motionToggle.checked });
    document.body.classList.toggle("reduced-motion", motionToggle.checked);
  });

  document.getElementById("btn-settings-back").addEventListener("click", () => {
    sfx.click();
    showScreen(appState.previousScreen || "home");
  });
}
