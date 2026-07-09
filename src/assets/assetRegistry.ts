import type { AssetContainer, Scene } from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { getSkinModelPath } from "../players/cosmetics/cosmeticRegistry";
import type { SkinId } from "../players/cosmetics/cosmeticTypes";

type AssetRecord = {
  container: AssetContainer;
};

const avatarContainerCache = new WeakMap<Scene, Map<SkinId, Promise<AssetRecord>>>();

export async function loadAvatarContainer(scene: Scene, skinId: SkinId) {
  let sceneCache = avatarContainerCache.get(scene);
  if (!sceneCache) {
    sceneCache = new Map<SkinId, Promise<AssetRecord>>();
    avatarContainerCache.set(scene, sceneCache);
  }

  const cached = sceneCache.get(skinId);
  if (cached) return cached;

  const promise = (async () => {
    const modelPath = getSkinModelPath(skinId);
    const rootUrl = modelPath.slice(0, modelPath.lastIndexOf("/") + 1);
    const fileName = modelPath.slice(modelPath.lastIndexOf("/") + 1);
    const container = await SceneLoader.LoadAssetContainerAsync(
      rootUrl,
      fileName,
      scene
    );

    return { container };
  })();

  sceneCache.set(skinId, promise);
  return promise;
}
