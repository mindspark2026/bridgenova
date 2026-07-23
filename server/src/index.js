const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server, matchMaker } = require("colyseus");
const { WebSocketTransport } = require("@colyseus/ws-transport");

const { BridgeRaceRoom } = require("./rooms/BridgeRaceRoom");

const PORT = process.env.PORT || 2567;
const CLIENT_DIR = path.join(__dirname, "..", "..", "client");

const app = express();
app.use(cors());
app.use(express.json());

// Serve the static frontend (Home / Login / Lobby / Waiting Room / Game / etc.
// are all screens inside client/index.html, switched client-side).
app.use(express.static(CLIENT_DIR));

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Look up a private room by its shareable 5-character code, used by the
// Lobby screen's "Join with code" flow before calling client.joinById(...).
app.get("/api/rooms/by-code/:code", async (req, res) => {
  try {
    const code = String(req.params.code || "").toUpperCase();
    const rooms = await matchMaker.query({ name: "bridge_race", metadata: { code } });
    const room = rooms.find((r) => !r.locked && r.clients < r.maxClients);
    if (!room) return res.status(404).json({ error: "Room not found or full" });
    res.json({ roomId: room.roomId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Lookup failed" });
  }
});

// Fallback: any unknown route serves the SPA shell so client-side routing works.
app.get("*", (_req, res) => res.sendFile(path.join(CLIENT_DIR, "index.html")));

const httpServer = http.createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

// "bridge_race" room type is used for BOTH public matchmaking (joinOrCreate)
// and private rooms (create with { isPrivate: true }); privacy is handled
// per-instance inside the room via setPrivate()/setMetadata().
gameServer.define("bridge_race", BridgeRaceRoom);

gameServer.listen(PORT).then(() => {
  console.log(`Bridge Race server listening on ws://localhost:${PORT}`);
});
