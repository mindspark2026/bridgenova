const KEY = "bridgeRace.settings.v1";

const DEFAULTS = {
  musicOn: true,
  sfxOn: true,
  volume: 70,
  reducedMotion: false,
  playerName: "",
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (e) {
    return { ...DEFAULTS };
  }
}

export function saveSettings(partial) {
  const current = loadSettings();
  const merged = { ...current, ...partial };
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch (e) {
    // localStorage unavailable (private browsing etc) - fail silently.
  }
  return merged;
}
