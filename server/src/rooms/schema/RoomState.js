const { Schema, type, MapSchema } = require("@colyseus/schema");
const { Player } = require("./Player");

/**
 * Match phases:
 *  "waiting"  - lobby, waiting for players / host to start
 *  "countdown"- brief pre-race countdown so all clients start together
 *  "racing"   - race in progress
 *  "finished" - race over, leaderboard is final
 */
class RoomState extends Schema {
  constructor() {
    super();
    this.players = new MapSchema();
    this.phase = "waiting";
    this.roomCode = "";      // shareable 5-char code for private rooms
    this.isPrivate = false;
    this.hostId = "";
    this.maxPlayers = 6;
    this.minPlayers = 2;
    this.countdownMs = 0;
    this.raceStartAt = 0;    // server timestamp (ms) when phase became "racing"
    this.trackLength = 1000; // arbitrary progress units
  }
}

type({ map: Player })(RoomState.prototype, "players");
type("string")(RoomState.prototype, "phase");
type("string")(RoomState.prototype, "roomCode");
type("boolean")(RoomState.prototype, "isPrivate");
type("string")(RoomState.prototype, "hostId");
type("uint8")(RoomState.prototype, "maxPlayers");
type("uint8")(RoomState.prototype, "minPlayers");
type("number")(RoomState.prototype, "countdownMs");
type("number")(RoomState.prototype, "raceStartAt");
type("number")(RoomState.prototype, "trackLength");

module.exports = { RoomState };
