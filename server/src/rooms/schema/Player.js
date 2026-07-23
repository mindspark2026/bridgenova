const { Schema, type } = require("@colyseus/schema");

/**
 * Authoritative per-player state.
 * Every field here is automatically synced to all clients in the room
 * whenever it changes (Colyseus binary delta-encoding).
 */
class Player extends Schema {
  constructor() {
    super();
    this.name = "Guest";
    this.colorIndex = 0;     // cosmetic lane color, 0-5
    this.isHost = false;
    this.connected = true;   // false while in the 30s reconnection grace window
    this.ready = false;      // reserved for future "ready check" use

    // Race state
    this.x = 0;              // current progress along the track (0..TRACK_LENGTH)
    this.bridgeLen = 0;      // how far this player's bridge has been built (0..TRACK_LENGTH)
    this.planksPlaced = 0;   // total planks placed, used for HUD + scoring tiebreaks
    this.finished = false;
    this.finishTimeMs = 0;   // ms since race start when they crossed the line, 0 if not finished
    this.rank = 0;           // final rank, assigned when they finish or race ends
  }
}

type("string")(Player.prototype, "name");
type("uint8")(Player.prototype, "colorIndex");
type("boolean")(Player.prototype, "isHost");
type("boolean")(Player.prototype, "connected");
type("boolean")(Player.prototype, "ready");
type("number")(Player.prototype, "x");
type("number")(Player.prototype, "bridgeLen");
type("uint16")(Player.prototype, "planksPlaced");
type("boolean")(Player.prototype, "finished");
type("number")(Player.prototype, "finishTimeMs");
type("uint8")(Player.prototype, "rank");

module.exports = { Player };
