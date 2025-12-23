import type { Scene } from "@babylonjs/core";
import { handlers } from "./handlers";
import { OPCODES } from "../opcodes";

// const WS_URL = "wss://beast-describe-flag-affiliate.trycloudflare.com";
const WS_URL = "ws://127.0.0.1:7350";

// send update
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


// Connect game server
export async function connectGameServer(scene: Scene) {
    let cleanupDone = false;

    return new Promise<{
        socket: WebSocket;
        myIdRef: { current: string | null };
        close: (code?: number, reason?: string) => void;
    }>((resolve, reject) => {
        const socket = new WebSocket(WS_URL);
        const myIdRef = { current: null as string | null };
        let settled = false;

        const handshakeTimer = window.setTimeout(() => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("WebSocket handshake timeout"));
            if (socket.readyState === WebSocket.CONNECTING) socket.close(4000, "handshake timeout");
        }, 10000);

        const cleanup = () => {
            if (cleanupDone) return;
            cleanupDone = true;
            window.clearTimeout(handshakeTimer);
            socket.removeEventListener("open", handleOpen);
            socket.removeEventListener("message", handleMessage);
            socket.removeEventListener("error", handleError);
            socket.removeEventListener("close", handleClose);
        };

        const close = (code = 1000, reason = "client disconnect") => {
            cleanup();
            if (
                socket.readyState === WebSocket.OPEN ||
                socket.readyState === WebSocket.CONNECTING
            ) {
                socket.close(code, reason);
            }
        };

        const handleOpen = () => {
            console.log("✅ Connected to Pepe WS server");
        };

        const handleMessage = (event: MessageEvent) => {
            try {
                const msg = JSON.parse(event.data);
                const handler = handlers[msg.op];

                if (handler) {
                    handler({ msg, scene, myIdRef, socket });
                    if (!settled && msg.op === OPCODES.WELCOME) {
                        settled = true;
                        window.clearTimeout(handshakeTimer);
                        resolve({ socket, myIdRef, close });
                    }
                } else {
                    console.log("ℹ️ Unknown message:", msg);
                }
            } catch (e) {
                if (!settled) {
                    settled = true;
                    cleanup();
                    reject(e instanceof Error ? e : new Error("Failed to parse WS message"));
                } else {
                    console.error("❌ Parse error:", e);
                }
            }
        };

        const handleError = (_event: Event) => {
            if (settled) return;
            settled = true;
            cleanup();
            reject(new Error("WebSocket connection error"));
        };

        const handleClose = (event: CloseEvent) => {
            cleanup();
            if (!settled) {
                settled = true;
                reject(new Error(`WebSocket closed before ready (code ${event.code})`));
            }
        };

        socket.addEventListener("open", handleOpen);
        socket.addEventListener("message", handleMessage);
        socket.addEventListener("error", handleError);
        socket.addEventListener("close", handleClose);
    });
}
