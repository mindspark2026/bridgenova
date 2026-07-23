import { network } from "../network/client.js";
import { TRACK_LENGTH } from "../config.js";

const MOVE_SPEED_PER_SEC = 140; // must match server's MOVE_SPEED_PER_SEC for accurate prediction
const LANE_HEIGHT = 90;
const TRACK_MARGIN_X = 60;
const RECONCILE_LERP = 0.15; // how aggressively we snap the local player back to the server's truth

/**
 * Renders each player's personal lane with their bridge progress.
 * - The local player is CLIENT-PREDICTED: we simulate their forward motion
 *   every frame using the same speed constant the server uses, so movement
 *   feels instant even though plank placements are server-authoritative.
 *   We continuously reconcile toward the authoritative x from the server.
 * - Remote players are INTERPOLATED: we buffer their last two known
 *   positions + timestamps from state updates and smoothly tween between
 *   them, instead of snapping on every network tick.
 */
export class RaceScene extends Phaser.Scene {
  constructor() {
    super("race");
    this.lanes = new Map(); // sessionId -> { sprite, bridgeGfx, laneY, nameText }
    this.remoteBuffer = new Map(); // sessionId -> { from: {x,t}, to: {x,t} }
    this.localPredictedX = 0;
    this.raceStartAt = 0;
    this.unsubState = null;
  }

  create() {
    this.cameras.main.setBackgroundColor("#0e1c33");
    this.trackWidth = this.scale.width - TRACK_MARGIN_X * 2;

    this.add.tileSprite(0, 0, this.scale.width, this.scale.height, "water")
      .setOrigin(0, 0)
      .setAlpha(0.35)
      .setScrollFactor(0);

    for (let i = 0; i < 3; i++) {
      this.add.image(100 + i * 260, 40 + (i % 2) * 30, "cloud").setAlpha(0.4);
    }

    this.finishLine = this.add.rectangle(
      TRACK_MARGIN_X + this.trackWidth, this.scale.height / 2, 6, this.scale.height, 0xffb347
    ).setOrigin(0.5, 0.5);

    this.unsubState = network.on("state", (state) => this.onStateUpdate(state));
    if (network.state) this.onStateUpdate(network.state);

    this.input.keyboard?.on("keydown-SPACE", () => this.placePlank());

    this.scale.on("resize", (gameSize) => {
      this.trackWidth = gameSize.width - TRACK_MARGIN_X * 2;
      this.finishLine.x = TRACK_MARGIN_X + this.trackWidth;
      this.finishLine.height = gameSize.height;
      this.layoutLanes(gameSize.height);
    });
  }

  placePlank() {
    network.placePlank();
  }

  ensureLane(sessionId, player, index) {
    if (this.lanes.has(sessionId)) return this.lanes.get(sessionId);

    const laneY = 70 + index * LANE_HEIGHT;
    const bridgeGfx = this.add.graphics();
    const sprite = this.add.image(TRACK_MARGIN_X, laneY, `player_${player.colorIndex % 6}`);
    sprite.setDepth(2);
    const nameText = this.add.text(TRACK_MARGIN_X, laneY - 26, player.name, {
      fontSize: "12px",
      color: "#f4f7fb",
      fontFamily: "Segoe UI, sans-serif",
    }).setOrigin(0.5, 1);

    const laneBg = this.add.rectangle(
      TRACK_MARGIN_X, laneY, this.trackWidth, LANE_HEIGHT - 14, 0x0b1220, 0.25
    ).setOrigin(0, 0.5);

    const entry = { sprite, bridgeGfx, nameText, laneBg, laneY };
    this.lanes.set(sessionId, entry);
    return entry;
  }

  layoutLanes(height) {
    // Recompute lane Y positions if the canvas height changes (responsive resize).
    let i = 0;
    this.lanes.forEach((entry) => {
      const laneY = 70 + i * LANE_HEIGHT;
      entry.laneY = laneY;
      entry.laneBg.y = laneY;
      entry.nameText.y = laneY - 26;
      i += 1;
    });
  }

  progressToPixelX(progress) {
    return TRACK_MARGIN_X + (progress / TRACK_LENGTH) * this.trackWidth;
  }

  onStateUpdate(state) {
    if (state.phase === "racing" && !this.raceStartAt) {
      this.raceStartAt = state.raceStartAt;
    }

    let index = 0;
    state.players.forEach((player, sessionId) => {
      const entry = this.ensureLane(sessionId, player, index);
      index += 1;

      // Redraw the bridge up to the authoritative bridgeLen for this player.
      entry.bridgeGfx.clear();
      const plankCount = Math.floor(player.bridgeLen / 45) + 1;
      entry.bridgeGfx.fillStyle(0xc98a4b, 1);
      const px = this.progressToPixelX(player.bridgeLen);
      entry.bridgeGfx.fillRect(TRACK_MARGIN_X, entry.laneY + 12, px - TRACK_MARGIN_X, 6);

      if (sessionId === network.sessionId) {
        this.localPredictedX = player.x; // reconciled gradually in update()
        this._localServerX = player.x;
        this._localFinished = player.finished;
      } else {
        const buf = this.remoteBuffer.get(sessionId) || { from: { x: player.x, t: performance.now() }, to: { x: player.x, t: performance.now() } };
        buf.from = buf.to;
        buf.to = { x: player.x, t: performance.now() };
        this.remoteBuffer.set(sessionId, buf);
      }

      entry.sprite.setAlpha(player.connected ? 1 : 0.4);
    });
  }

  update(_time, deltaMs) {
    const dt = deltaMs / 1000;

    this.lanes.forEach((entry, sessionId) => {
      let renderX;
      if (sessionId === network.sessionId) {
        if (!this._localFinished && this.localPredictedX < this._targetBridgeLen(sessionId)) {
          this.localPredictedX = Math.min(
            this._targetBridgeLen(sessionId),
            this.localPredictedX + MOVE_SPEED_PER_SEC * dt
          );
        }
        // Gently reconcile toward the server's authoritative x to correct drift.
        this.localPredictedX += (this._localServerX - this.localPredictedX) * RECONCILE_LERP;
        renderX = this.localPredictedX;
      } else {
        const buf = this.remoteBuffer.get(sessionId);
        if (buf) {
          const span = Math.max(1, buf.to.t - buf.from.t);
          const t = Phaser.Math.Clamp((performance.now() - buf.to.t + span) / span, 0, 1.4);
          renderX = Phaser.Math.Linear(buf.from.x, buf.to.x, Math.min(1, t));
        } else {
          renderX = 0;
        }
      }

      const px = this.progressToPixelX(renderX);
      entry.sprite.x = px;
      entry.nameText.x = px;

      // Little bobbing animation while moving, purely cosmetic.
      entry.sprite.y = entry.laneY + Math.sin(_time / 90 + entry.laneY) * (renderX > 1 ? 3 : 0);
    });
  }

  _targetBridgeLen(sessionId) {
    const p = network.state?.players.get(sessionId);
    return p ? p.bridgeLen : 0;
  }

  shutdown() {
    if (this.unsubState) this.unsubState();
  }
}
