// fakeServer.ts
import type { Scene } from "@babylonjs/core";
import { Vector3 } from "@babylonjs/core";
import { spawnRemote, updateRemoteFromServer } from "./players/remotePlayers";

const MODEL_PATH = "/models/pepe-test.glb";

type BotState = { pos: Vector3; target: Vector3; speed: number };
const bots: Record<string, BotState> = {};

function randomFarTarget(from: Vector3, minDist = 6, maxDist = 12) {
    let target: Vector3;
    while (true) {
        const R = maxDist;
        target = new Vector3(
            (Math.random() - 0.5) * R * 2,
            0,
            (Math.random() - 0.5) * R * 2
        );
        if (Vector3.Distance(from, target) > minDist) break;
    }
    return target;
}

export async function connectFakeServer(scene: Scene) {
    // 🟢 spawn 1 lần duy nhất khi connect
    for (let i = 0; i < 10; i++) {
        const id = "p" + i;
        const start = new Vector3(
            (Math.random() - 0.5) * 10,
            0,
            (Math.random() - 0.5) * 10
        );

        bots[id] = {
            pos: start,
            target: randomFarTarget(start),
            speed: 2 + Math.random() * 1.5,
        };

        // chỉ gọi spawn 1 lần ở đây
        await spawnRemote(scene, id, MODEL_PATH);
    }

    // loop update
    setInterval(() => {
        for (const [id, bot] of Object.entries(bots)) {
            const dir = bot.target.subtract(bot.pos);
            const dist = dir.length();

            if (dist < 0.5) {
                bot.target = randomFarTarget(bot.pos);
            } else {
                dir.normalize();
                bot.pos.addInPlace(dir.scale(bot.speed * 0.1));
            }

            const yaw = Math.atan2(dir.x, dir.z);
            const state = dist > 0.5 ? "run" : "idle";

            updateRemoteFromServer(id, {
                pos: [bot.pos.x, bot.pos.y, bot.pos.z],
                yaw,
                state,
            });
        }
    }, 100); // tick 10fps
}
