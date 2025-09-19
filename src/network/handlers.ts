import { MODEL_PEPE } from "../constants";
import {
    spawnRemotePlayer,
    despawnRemotePlayer,
    updateRemotePlayerFromServer,
} from "../players/remotePlayers";
import { sendUpdate } from "./connectGameServer";
import { OPCODES } from "../opcodes";

type HandlerArgs = {
    msg: any;
    scene: any;
    myIdRef: { current: string | null };
    socket: WebSocket;
};

export const handlers: Record<number, (args: HandlerArgs) => void> = {
    [OPCODES.JOIN]: ({ msg, scene, myIdRef }) => {
        if (msg.id !== myIdRef.current) {
            console.log("👋 Player joined:", msg.id, msg.pos);
            spawnRemotePlayer(scene, msg.id, MODEL_PEPE, {
                pos: msg.pos,
                yaw: msg.yaw,
                state: msg.state,
            });
        }
    },
    [OPCODES.WELCOME]: ({ msg, scene, myIdRef, socket }) => {
        myIdRef.current = msg.id;
        console.log("🆔 WELCOME, myId=", myIdRef.current);
        console.log("📥 SNAPSHOT received:", msg.snapshot);
        // ❌ Đừng spawn local ở đây nữa
        // spawnRemotePlayer(scene, myIdRef.current!, MODEL_PEPE);

        // ✅ Chỉ spawn remote từ snapshot
        for (const [otherId, info] of Object.entries<any>(msg.snapshot)) {
            if (otherId !== myIdRef.current) {
                console.log(`👀 Spawn remote: ${otherId} at`, info.pos);
                spawnRemotePlayer(scene, otherId, MODEL_PEPE, {
                    pos: info.pos,
                    yaw: info.yaw,
                    state: info.state,
                });
            }
        }

        sendUpdate(socket, myIdRef.current!, {
            pos: [0, 0, 0],
            yaw: 0,
            action: "idle",
        });
    },


    [OPCODES.UPDATE]: ({ msg, myIdRef }) => {
        if (msg.id && msg.id !== myIdRef.current) {
            console.log(`📡 UPDATE from ${msg.id}: pos=${msg.pos}, yaw=${msg.yaw}, state=${msg.state}`);

            updateRemotePlayerFromServer(msg.id, {
                pos: [msg.pos[0], 0, msg.pos[2]],
                yaw: msg.yaw,
                state: msg.state,
            });
        }
    },

    [OPCODES.LEAVE]: ({ msg }) => {
        console.log(`🚪 LEAVE: ${msg.id}`);
        despawnRemotePlayer(msg.id);
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
