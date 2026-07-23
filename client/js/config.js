// Central client-side configuration. Keep gameplay constants in sync with
// server/src/rooms/BridgeRaceRoom.js where relevant (TRACK_LENGTH, colors).

export const SERVER_URL = (() => {
  const isSecure = window.location.protocol === "https:";
  const scheme = isSecure ? "wss" : "ws";
  // Same-origin by default: the Express server also serves this static site.
  return `${scheme}://${window.location.host}`;
})();

export const TRACK_LENGTH = 1000;
export const MAX_PLAYERS = 6;
export const MIN_PLAYERS = 2;

export const PLAYER_COLORS = [
  0xff6b6b, // red
  0x4fd1c5, // teal
  0xffd166, // yellow
  0x6b8cff, // blue
  0xc77dff, // purple
  0x9be564, // green
];

export const PLAYER_COLOR_CSS = [
  "#ff6b6b", "#4fd1c5", "#ffd166", "#6b8cff", "#c77dff", "#9be564",
];
