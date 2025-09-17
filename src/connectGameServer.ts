import type { Scene, TransformNode } from "@babylonjs/core";
import { despawnRemote, spawnRemote, updateRemoteFromServer } from "./players/remotePlayers";
import { MODEL_PEPE } from "./utils/constant";

const LOCAL_WS_URL = "wss://babylon-joytick-be-test.onrender.com"; // ⚡ đổi IP khi chạy LAN
let ws: WebSocket | null = null;
let myId: string | null = null;

export function connectGameServer(scene: Scene, player: TransformNode, getAnimState: () => string) {
    try {
        ws = new WebSocket(LOCAL_WS_URL);

        ws.onopen = () => console.log("✅ Connected to game server");

        ws.onmessage = async (ev) => {
            const data = JSON.parse(ev.data);
            console.log("📩 [FROM SERVER]", data);

            if (data.type === "welcome") {
                myId = data.id;
                console.log("🆔 My ID:", myId);

                // Spawn các player có sẵn
                if (Array.isArray(data.others)) {
                    for (const otherId of data.others) {
                        await spawnRemote(scene, otherId, MODEL_PEPE);
                    }
                }
            }

            if (data.type === "join") {
                console.log("➕ Player joined:", data.id);
                await spawnRemote(scene, data.id, MODEL_PEPE);
            }

            if (data.type === "update") {
                if (data.id === myId) return; // bỏ qua self
                updateRemoteFromServer(data.id, {
                    pos: data.pos,
                    yaw: data.yaw,
                    state: data.state,
                });
            }

            if (data.type === "leave") {
                console.log("❌ Player left:", data.id);
                despawnRemote(data.id);
            }

            if (data.type === "full") {
                alert("🚫 Server full (30 players). Please wait.");
            }
        };

        ws.onclose = () => {
            console.log("❌ Server offline → fallback solo mode");
        };

        // Gửi update đều đặn
        // let lastPos = { x: 0, z: 0 };
        setInterval(() => {
            if (!ws || ws.readyState !== WebSocket.OPEN || !myId) return;

            // const dx = player.position.x - lastPos.x;
            // const dz = player.position.z - lastPos.z;
            // const dist = Math.sqrt(dx * dx + dz * dz);
            // lastPos = { x: player.position.x, z: player.position.z };

            ws.send(
                JSON.stringify({
                    type: "update",
                    pos: [player.position.x, player.position.y, player.position.z],
                    yaw: player.rotation.y,
                    state: getAnimState(), // lấy từ localPlayer
                })
            );
        }, 100);
    } catch (err) {
        console.warn("⚠️ Connect failed, running solo mode", err);
    }
}
