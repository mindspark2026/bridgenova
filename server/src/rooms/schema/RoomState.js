const { Schema, MapSchema, defineTypes } = require("@colyseus/schema");
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
    this.roomCode = ""; // shareable 5-char code for private rooms
    this.isPrivate = false;
    this.hostId = "";
    this.maxPlayers = 6;
    this.minPlayers = 2;
    this.countdownMs = 0;
    this.raceStartAt = 0; // server timestamp (ms) when phase became "racing"
    this.trackLength = 1000; // arbitrary progress units
  }
}

defineTypes(RoomState, {
  players: { map: Player },
  phase: "string",
  roomCode: "string",
  isPrivate: "boolean",
  hostId: "string",
  maxPlayers: "uint8",
  minPlayers: "uint8",
  countdownMs: "number",
  raceStartAt: "number",
  trackLength: "number",
});

module.exports = { RoomState };
