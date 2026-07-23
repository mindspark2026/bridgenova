import { network } from "../network/client.js";
import { sfx } from "../utils/audio.js";

export function initLobby({ showScreen, appState, toast }) {
  const statusLine = document.getElementById("lobby-status");
  const codeInput = document.getElementById("input-room-code");

  function setBusy(busy, msg) {
    statusLine.textContent = msg || "";
    [btnQuick, btnCreate, btnJoin].forEach((b) => (b.disabled = busy));
  }

  const btnQuick = document.getElementById("btn-quick-match");
  const btnCreate = document.getElementById("btn-create-private");
  const btnJoin = document.getElementById("btn-join-code");

  btnQuick.addEventListener("click", async () => {
    sfx.click();
    setBusy(true, "Searching for a match…");
    try {
      await network.quickMatch(appState.playerName);
      appState.isPrivateRoom = false;
      showScreen("waiting");
    } catch (err) {
      console.error(err);
      sfx.error();
      toast(err.message || "Could not join a match. Try again.");
    } finally {
      setBusy(false);
    }
  });

  btnCreate.addEventListener("click", async () => {
    sfx.click();
    setBusy(true, "Creating private room…");
    try {
      await network.createPrivateRoom(appState.playerName);
      appState.isPrivateRoom = true;
      showScreen("waiting");
    } catch (err) {
      console.error(err);
      sfx.error();
      toast(err.message || "Could not create a room.");
    } finally {
      setBusy(false);
    }
  });

  btnJoin.addEventListener("click", async () => {
    const code = codeInput.value.trim().toUpperCase();
    if (code.length !== 5) {
      sfx.error();
      toast("Enter a valid 5-character room code.");
      return;
    }
    sfx.click();
    setBusy(true, "Joining room…");
    try {
      await network.joinByCode(code, appState.playerName);
      appState.isPrivateRoom = true;
      showScreen("waiting");
    } catch (err) {
      console.error(err);
      sfx.error();
      toast(err.message || "Room not found, full, or already started.");
    } finally {
      setBusy(false);
    }
  });

  document.getElementById("btn-back-home-lobby").addEventListener("click", () => {
    sfx.click();
    showScreen("home");
  });
}
