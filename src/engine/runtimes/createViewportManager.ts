import type { Engine, Scene } from "@babylonjs/core";

// engine/runtime/createViewportManager.ts
export function createViewportManager(engine: Engine, scene: Scene) {
    const resizeSafe = () => {
        engine.resize();
    };

    const handleVisibility = () => {
        if (!document.hidden) {
            resizeSafe();
            requestAnimationFrame(resizeSafe);
            setTimeout(resizeSafe, 200);
            try {
                scene.render();
            } catch { }
        }
    };

    window.addEventListener("resize", resizeSafe);
    window.addEventListener("orientationchange", resizeSafe);
    document.addEventListener("visibilitychange", handleVisibility);

    // init kick
    resizeSafe();
    setTimeout(resizeSafe, 200);

    return {
        dispose() {
            window.removeEventListener("resize", resizeSafe);
            window.removeEventListener("orientationchange", resizeSafe);
            document.removeEventListener("visibilitychange", handleVisibility);
        },
    };
}
