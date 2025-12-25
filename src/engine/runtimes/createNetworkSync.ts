import type { TransformNode } from "@babylonjs/core";
import { sendUpdate } from "../../network/connectGameServer";

type RefHolder<T> = { current: T };

export function createNetworkSync({
    player,
    serverSocketRef,
    lastSentRef,
    movementCtrl
}: {
    player: TransformNode,
    serverSocketRef: React.RefObject<WebSocket | null>,
    lastSentRef: RefHolder<{ x: number; y: number; z: number; yaw: number; state: string }>;
    movementCtrl: {
        update: (dt: number, camera: any) => void;
        getSpeed: () => number;
    }
}) {
    let netAccum = 0;

    function update(dt: number) {
        const sock = serverSocketRef.current;
        if (!sock || sock.readyState !== WebSocket.OPEN) return;

        netAccum += dt;
        if (netAccum < 0.1) return;
        netAccum = 0;

        const speed = movementCtrl.getSpeed();

        const state =
            (player as any).isAttacking?.()
                ? "attack"
                : speed > 0.1
                    ? "run"
                    : "idle";

        const cur = {
            x: player.position.x,
            y: 0,
            z: player.position.z,
            yaw: player.rotation.y,
            state,
        };


        const last = lastSentRef.current;

        const moved =
            Math.hypot(cur.x - last.x, cur.z - last.z) > 0.01 ||
            Math.abs(cur.yaw - last.yaw) > 0.02 ||
            cur.state !== last.state;

        if (!moved) return;

        sendUpdate(sock, player.id, {
            pos: [cur.x, 0, cur.z],
            yaw: cur.yaw,
            action: cur.state,
        });

        lastSentRef.current = cur;
    }

    return { update };
}

