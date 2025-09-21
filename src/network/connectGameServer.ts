import type { Scene } from "@babylonjs/core";
import { handlers } from "./handlers";
import { OPCODES } from "../opcodes";

// Local ID ref
let deviceId = localStorage.getItem("deviceId");
if (!deviceId) {
    deviceId = "device-" + crypto.randomUUID();
    localStorage.setItem("deviceId", deviceId);
}

// Tạo socket
const socket = new WebSocket("wss://admitted-miss-advocacy-transmitted.trycloudflare.com");
// const socket = new WebSocket("ws://localhost:7350");

// Hàm gửi update
export function sendUpdate(
    socket: WebSocket,
    myId: string,
    state: { pos: [number, number, number]; yaw: number; action: string }
) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    socket.send(
        JSON.stringify({
            type: "update",
            id: myId,
            pos: [state.pos[0], 0, state.pos[2]],
            yaw: state.yaw,
            state: state.action,
        })
    );
}


// Kết nối game server
export async function connectGameServer(scene: Scene) {
    return new Promise<{ socket: WebSocket; myIdRef: { current: string | null } }>((resolve) => {
        const myIdRef = { current: null as string | null };

        socket.onopen = () => {
            console.log("✅ Connected to Pepe WS server");
        };

        socket.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                const handler = handlers[msg.op];

                if (handler) {
                    handler({ msg, scene, myIdRef, socket });
                    if (msg.op === OPCODES.WELCOME) {
                        resolve({ socket, myIdRef });
                    }
                } else {
                    console.log("ℹ️ Unknown message:", msg);
                }
            } catch (e) {
                console.error("❌ Parse error:", e);
            }
        };
    });
}
