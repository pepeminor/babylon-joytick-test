import { Scene, SceneLoader } from "@babylonjs/core";

export async function importMeshWithRetry(rootUrl: string, fileName: string, scene: Scene, retries = 2) {
    let lastErr: any;
    for (let i = 0; i <= retries; i++) {
        try { return await SceneLoader.ImportMeshAsync("", rootUrl, fileName, scene); }
        catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 250 * (i + 1))); }
    }
    throw lastErr;
}
