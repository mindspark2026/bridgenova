const { Schema, defineTypes } = require("@colyseus/schema");

/**
 * Authoritative per-player state.
 * Every field here is automatically synced to all clients in the room
 * whenever it changes (Colyseus binary delta-encoding).
 */
class Player extends Schema {
  constructor() {
    super();
    this.name = "Guest";
    this.colorIndex = 0; // cosmetic lane color, 0-5
    this.isHost = false;
    this.connected = true; // false while in the 30s reconnection grace window
    this.ready = false; // reserved for future "ready check" use

    // Race state
    this.x = 0; // current progress along the track (0..TRACK_LENGTH)
    this.bridgeLen = 0; // how far this player's bridge has been built (0..TRACK_LENGTH)
    this.planksPlaced = 0; // total planks placed, used for HUD + scoring tiebreaks
    this.finished = false;
    this.finishTimeMs = 0; // ms since race start when they crossed the line, 0 if not finished
    this.rank = 0; // final rank, assigned when they finish or race ends
  }
}

defineTypes(Player, {
  name: "string",
  colorIndex: "uint8",
  isHost: "boolean",
  connected: "boolean",
  ready: "boolean",
  x: "number",
  bridgeLen: "number",
  planksPlaced: "uint16",
  finished: "boolean",
  finishTimeMs: "number",
  rank: "uint8",
});

module.exports = { Player };
