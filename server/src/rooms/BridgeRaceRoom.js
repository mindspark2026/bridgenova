const { Room } = require("@colyseus/core");
const { RoomState } = require("./schema/RoomState");
const { Player } = require("./schema/Player");

// ---- Gameplay tuning constants -------------------------------------------
const MAX_PLAYERS = 6;
const MIN_PLAYERS_TO_START = 2;
const TRACK_LENGTH = 1000; // progress units from start to finish line
const PLANK_LENGTH = 45; // how far one placed plank extends the bridge
const PLANK_COOLDOWN_MS = 130; // server-enforced min time between plank placements (anti-spam)
const MOVE_SPEED_PER_SEC = 140; // progress units/sec while running on a built bridge
const COUNTDOWN_MS = 3000;
const RECONNECTION_GRACE_SEC = 30;
const MATCH_TIMEOUT_MS = 3 * 60 * 1000; // safety cap so a race can never hang forever
const TICK_RATE_MS = 1000 / 20; // 20 authoritative ticks/sec

function randomRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "";
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

class BridgeRaceRoom extends Room {
  onCreate(options = {}) {
    this.maxClients = MAX_PLAYERS;
    this.state = new RoomState();

    this.state.maxPlayers = MAX_PLAYERS;
    this.state.minPlayers = MIN_PLAYERS_TO_START;
    this.state.trackLength = TRACK_LENGTH;
    this.state.isPrivate = !!options.isPrivate;
    this.state.roomCode = options.isPrivate ? randomRoomCode() : "";

    // A private room isn't listed in public matchmaking results.
    this.setPrivate(!!options.isPrivate);
    if (this.state.isPrivate) {
      this.setMetadata({ code: this.state.roomCode });
    }

    this._lastPlankAt = new Map(); // sessionId -> timestamp, for cooldown enforcement
    this._matchTimeoutHandle = null;

    this.onMessage("start_game", (client) => this.handleStartGame(client));
    this.onMessage("place_plank", (client) => this.handlePlacePlank(client));
    this.onMessage("set_name", (client, name) => this.handleSetName(client, name));

    // Authoritative simulation loop.
    this.setSimulationInterval((dt) => this.update(dt), TICK_RATE_MS);

    console.log(
      `[BridgeRaceRoom] created ${this.roomId} (private=${this.state.isPrivate}, code=${this.state.roomCode})`
    );
  }

  onAuth(_client, _options) {
    // No account system required - guest play is always allowed.
    return true;
  }

  onJoin(client, options = {}) {
    if (this.state.phase === "racing" || this.state.phase === "countdown") {
      // Mid-match joins aren't allowed (only reconnections, handled via onDrop/onReconnect).
      throw new Error("Match already in progress");
    }

    const player = new Player();
    player.name = (options && options.name ? String(options.name) : "Guest").slice(0, 16) || "Guest";
    player.colorIndex = this.state.players.size % 6;
    player.isHost = this.state.players.size === 0;

    this.state.players.set(client.sessionId, player);

    if (player.isHost) {
      this.state.hostId = client.sessionId;
    }

    console.log(
      `[BridgeRaceRoom] ${player.name} joined ${this.roomId} (${this.state.players.size}/${MAX_PLAYERS})`
    );

    // Auto-start the instant the room fills up.
    if (this.state.players.size >= MAX_PLAYERS && this.state.phase === "waiting") {
      this.beginCountdown();
    }
  }

  // --- Colyseus 0.17 reconnection lifecycle ---------------------------
  // onDrop()      -> fires on an ABNORMAL disconnect (dropped socket).
  //                  Ask the framework to hold the seat open for a while.
  // onReconnect() -> fires if the same client reconnects within that window.
  // onLeave()     -> fires on a graceful/explicit leave, OR once the
  //                  reconnection window from onDrop() expires. This is
  //                  always the final "player is really gone" cleanup.
  onDrop(client, _code) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (this.state.phase !== "racing") {
      // No grace period pre-match/post-match - onLeave() finalizes the
      // removal right away since we don't request reconnection here.
      return;
    }

    // Mid-match: keep their bridge/progress, mark disconnected, and give
    // them 30 seconds to come back before onLeave() removes them for good.
    player.connected = false;
    this.allowReconnection(client, RECONNECTION_GRACE_SEC);
  }

  onReconnect(client) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    player.connected = true;
    console.log(`[BridgeRaceRoom] ${player.name} reconnected to ${this.roomId}`);
  }

  onLeave(client, _code) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    const wasHost = player.isHost;
    this.state.players.delete(client.sessionId);
    this._lastPlankAt.delete(client.sessionId);
    this.reassignHostIfNeeded(wasHost);

    if (this.state.phase === "countdown" && this.state.players.size < MIN_PLAYERS_TO_START) {
      this.cancelCountdown();
    }

    if (this.state.phase === "racing") {
      this.checkForRaceEnd();
    }
  }

  cancelCountdown() {
    if (this._countdownTimeoutHandle) {
      this._countdownTimeoutHandle.clear();
      this._countdownTimeoutHandle = null;
    }
    this.state.phase = "waiting";
    this.state.countdownMs = 0;
  }

  reassignHostIfNeeded(wasHost) {
    if (!wasHost) return;
    const next = this.state.players.keys().next();
    if (!next.done) {
      const newHostId = next.value;
      const newHost = this.state.players.get(newHostId);
      newHost.isHost = true;
      this.state.hostId = newHostId;
    } else {
      this.state.hostId = "";
    }
  }

  handleSetName(client, name) {
    const player = this.state.players.get(client.sessionId);
    if (!player || this.state.phase !== "waiting") return;
    const clean = String(name || "").trim().slice(0, 16);
    if (clean) player.name = clean;
  }

  handleStartGame(client) {
    if (client.sessionId !== this.state.hostId) return; // only the host may force-start
    if (this.state.phase !== "waiting") return;
    if (this.state.players.size < MIN_PLAYERS_TO_START) return;
    this.beginCountdown();
  }

  beginCountdown() {
    this.state.phase = "countdown";
    this.state.countdownMs = COUNTDOWN_MS;
    this._countdownTimeoutHandle = this.clock.setTimeout(() => this.beginRace(), COUNTDOWN_MS);
  }

  beginRace() {
    this.state.phase = "racing";
    this.state.raceStartAt = Date.now();
    this.state.players.forEach((p) => {
      p.x = 0;
      p.bridgeLen = 0;
      p.planksPlaced = 0;
      p.finished = false;
      p.finishTimeMs = 0;
      p.rank = 0;
    });

    this._matchTimeoutHandle = this.clock.setTimeout(() => this.finishRace(), MATCH_TIMEOUT_MS);
    console.log(`[BridgeRaceRoom] race started in ${this.roomId}`);
  }

  handlePlacePlank(client) {
    if (this.state.phase !== "racing") return;
    const player = this.state.players.get(client.sessionId);
    if (!player || player.finished || !player.connected) return;

    const now = Date.now();
    const last = this._lastPlankAt.get(client.sessionId) || 0;
    if (now - last < PLANK_COOLDOWN_MS) return; // rate limited, ignore spam clicks

    this._lastPlankAt.set(client.sessionId, now);
    player.bridgeLen = Math.min(TRACK_LENGTH, player.bridgeLen + PLANK_LENGTH);
    player.planksPlaced += 1;
  }

  update(dtMs) {
    if (this.state.phase !== "racing") return;
    const dt = dtMs / 1000;

    let allFinished = true;
    this.state.players.forEach((player) => {
      if (player.finished) return;
      allFinished = false;

      if (player.x < player.bridgeLen) {
        player.x = Math.min(player.bridgeLen, player.x + MOVE_SPEED_PER_SEC * dt);
      }

      if (player.x >= TRACK_LENGTH) {
        player.x = TRACK_LENGTH;
        player.finished = true;
        player.finishTimeMs = Date.now() - this.state.raceStartAt;
      }
    });

    if (allFinished && this.state.players.size > 0) {
      this.finishRace();
    }
  }

  checkForRaceEnd() {
    if (this.state.phase !== "racing") return;
    const active = [...this.state.players.values()];
    if (active.length === 0) {
      this.finishRace();
      return;
    }
    if (active.every((p) => p.finished)) {
      this.finishRace();
    }
  }

  finishRace() {
    if (this.state.phase === "finished") return;
    if (this._matchTimeoutHandle) {
      this._matchTimeoutHandle.clear();
      this._matchTimeoutHandle = null;
    }

    // Rank everyone: finishers first (by finish time), then by distance covered.
    const ranked = [...this.state.players.values()].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.x - a.x;
    });
    ranked.forEach((p, i) => (p.rank = i + 1));

    this.state.phase = "finished";
    console.log(`[BridgeRaceRoom] race finished in ${this.roomId}`);

    // Give everyone time to see the victory screen, then close the room.
    this.clock.setTimeout(() => this.disconnect(), 30000);
  }

  onDispose() {
    console.log(`[BridgeRaceRoom] disposing ${this.roomId}`);
  }
}

module.exports = { BridgeRaceRoom, MAX_PLAYERS, MIN_PLAYERS_TO_START };
