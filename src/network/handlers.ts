import { MODEL_PEPE } from "../config";
import { getLocalGhostManager } from "../engine/createScene";
import { OPCODES } from "../opcodes";
import {
  spawnRemotePlayer,
  despawnRemotePlayer,
  updateRemotePlayerFromServer,
  remotes,
  queueRemoteAttack,
  triggerRemoteAttack,
} from "../players/remotePlayers";
import { sendUpdate } from "./connectGameServer";

type HandlerArgs = {
  msg: any;
  scene: any;
  myIdRef: { current: string | null };
  socket: WebSocket;
};

export const handlers: Record<string, (args: HandlerArgs) => void> = {
  [OPCODES.JOIN]: ({ msg, scene, myIdRef }) => {
    if (msg.id !== myIdRef.current) {
      spawnRemotePlayer(scene, msg.id, MODEL_PEPE, {
        pos: msg.pos,
        yaw: msg.yaw,
        state: msg.state,
        cosmeticId: msg.cosmeticId,
      });
    }
  },
  [OPCODES.WELCOME]: ({ msg, scene, myIdRef, socket }) => {
    // Set local player ID
    myIdRef.current = msg.id;

    // --- 🔥 FIX GHOST PLAYERS: clear everything on welcome ---
    for (const rid of Object.keys(remotes)) {
      despawnRemotePlayer(rid);
    }

    // Build snapshot players
    const snapshotIds = new Set<string>();
    for (const [otherId, info] of Object.entries<any>(msg.snapshot)) {
      snapshotIds.add(otherId);

      if (otherId !== myIdRef.current) {
        spawnRemotePlayer(scene, otherId, MODEL_PEPE, {
          pos: info.pos,
          yaw: info.yaw,
          state: info.state,
          cosmeticId: info.cosmeticId,
        });

      }
    }

    // Ensure no leftovers (just safety, snapshot already handled)
    for (const rid of Object.keys(remotes)) {
      if (!snapshotIds.has(rid) && rid !== myIdRef.current) {
        despawnRemotePlayer(rid);
      }
    }

    // Start sending movement updates
    sendUpdate(socket, myIdRef.current!, {
      pos: [0, 0, 0],
      yaw: 0,
      action: "idle",
    });
  },

  [OPCODES.UPDATE]: ({ msg, myIdRef }) => {
    if (msg.id && msg.id !== myIdRef.current) {
      updateRemotePlayerFromServer(msg.id, {
        pos: [msg.pos[0], 0, msg.pos[2]],
        yaw: msg.yaw,
        state: msg.state,
      });
    }
  },
  [OPCODES.BATCH_UPDATE]: ({ msg, myIdRef }) => {
    for (const p of msg.players) {
      if (p.id !== myIdRef.current) {
        updateRemotePlayerFromServer(p.id, {
          pos: [p.pos[0], 0, p.pos[2]],
          yaw: p.yaw,
          state: p.state,
        });
      }
    }
  },

  [OPCODES.ATTACK]: ({ msg }) => {
    const attack = {
      pos: msg.pos,
      yaw: msg.yaw,
      duration: msg.duration,
    };

    const r = remotes[msg.id];
    if (!r) {
      queueRemoteAttack(msg.id, attack);
      return;
    }

    triggerRemoteAttack(r, attack);
  },

  [OPCODES.LEAVE]: ({ msg }) => {
    despawnRemotePlayer(msg.id);
    getLocalGhostManager()?.remove(msg.id);
  },

  [OPCODES.WEAPON_CHANGE]: ({ msg }) => {
    console.log("🔄 Weapon changed:", msg);
    // TODO: update weapon mesh
  },

  [OPCODES.DAMAGE]: ({ msg }) => {
    console.log("💥 Damage:", msg);
    // TODO: update HP UI
  },

  [OPCODES.CHAT]: ({ msg }) => {
    console.log("💬 Chat:", msg.from, msg.text);
    // TODO: append to chat box
  },
};
