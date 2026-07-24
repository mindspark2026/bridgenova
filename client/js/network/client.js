import { SERVER_URL } from "../config.js";

// Thin wrapper around the Colyseus browser client so the rest of the app
// never touches the raw connection directly. Room/session are kept here so
// they survive navigating between in-app "screens" (this is a single-page
// app - screens are shown/hidden, not full page reloads, so the WebSocket
// connection is preserved across the whole match).
class NetworkClient {
  constructor() {
    this.client = new Colyseus.Client(SERVER_URL);
    this.room = null;
    this.listeners = new Map(); // event name -> Set of callbacks
  }

  on(event, cb) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(cb);
    return () => this.listeners.get(event)?.delete(cb);
  }

  emit(event, payload) {
    this.listeners.get(event)?.forEach((cb) => cb(payload));
  }

  async quickMatch(name) {
    this.room = await this.client.joinOrCreate("bridge_race", { name, isPrivate: false });
    this._bindRoomEvents();
    return this.room;
  }

  async createPrivateRoom(name) {
    this.room = await this.client.create("bridge_race", { name, isPrivate: true });
    this._bindRoomEvents();
    return this.room;
  }

  async joinByCode(code, name) {
    const res = await fetch(`/api/rooms/by-code/${encodeURIComponent(code)}`);
    if (!res.ok) throw new Error("Room not found or full");
    const { roomId } = await res.json();
    this.room = await this.client.joinById(roomId, { name });
    this._bindRoomEvents();
    return this.room;
  }

  // Best-effort resume after a hard page refresh (a fresh page load has no
  // in-memory Room object, so the SDK's automatic mid-session reconnection
  // never gets a chance to run - this covers that gap using the token we
  // cached in sessionStorage from the previous connection).
  async tryResumeSession() {
    const token = sessionStorage.getItem("bridgeRace.reconnectionToken");
    if (!token) return null;

    try {
      this.room = await this.client.reconnect(token);
      this._bindRoomEvents();
      return this.room;
    } catch (e) {
      sessionStorage.removeItem("bridgeRace.reconnectionToken");
      sessionStorage.removeItem("bridgeRace.roomId");
      return null;
    }
  }

  _bindRoomEvents() {
    if (!this.room) return;

    // Persist the reconnection token so a hard refresh mid-match can still
    // attempt to rejoin via tryResumeSession() above.
    sessionStorage.setItem("bridgeRace.reconnectionToken", this.room.reconnectionToken);
    sessionStorage.setItem("bridgeRace.roomId", this.room.roomId);

    this.room.onStateChange((state) => this.emit("state", state));

    // Abnormal disconnect - the SDK is already retrying automatically in
    // the background; this is purely a UI hook (e.g. "Reconnecting..." banner).
    this.room.onDrop((code, reason) => this.emit("drop", { code, reason }));

    // Reconnection (within the same page session) succeeded.
    this.room.onReconnect(() => {
      // Reconnecting gives us a new token - keep sessionStorage in sync.
      sessionStorage.setItem("bridgeRace.reconnectionToken", this.room.reconnectionToken);
      this.emit("reconnect");
    });

    // Permanent leave - either a consented leave, or reconnection failed/expired.
    this.room.onLeave((code, reason) => {
      sessionStorage.removeItem("bridgeRace.reconnectionToken");
      sessionStorage.removeItem("bridgeRace.roomId");
      this.emit("leave", code);
    });

    this.room.onError((code, message) => this.emit("error", { code, message }));
  }

  startGame() {
    this.room?.send("start_game");
  }

  placePlank() {
    this.room?.send("place_plank");
  }

  setName(name) {
    this.room?.send("set_name", name);
  }

  leaveRoom() {
    this.room?.leave(true);
    this.room = null;
    sessionStorage.removeItem("bridgeRace.reconnectionToken");
    sessionStorage.removeItem("bridgeRace.roomId");
  }

  get sessionId() {
    return this.room?.sessionId || null;
  }

  get state() {
    return this.room?.state || null;
  }
}

export const network = new NetworkClient();
