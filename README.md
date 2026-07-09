# Babylon Joystick Test

3D game client built with **Babylon.js + React + TypeScript + Vite**. The current source is a multiplayer/action prototype optimized for both mobile and desktop, featuring:

- a Babylon scene with a neon grid ground, retro sky, custom sun shader, and fog.
- local player control via touch joystick, WASD keys, and drag look.
- state sync over WebSocket to a local game server at `ws://127.0.0.1:7350`.
- remote player handling for snapshot, update, attack, leave, and weapon change events.
- separate cosmetics/avatar/weapon systems for easier expansion.
- PWA support through `vite-plugin-pwa`.

## Tech Stack

- Babylon.js `@babylonjs/core`, `@babylonjs/loaders`
- React 19
- TypeScript 5
- Vite 7
- Zustand for combat state
- WebSocket realtime sync

## Getting Started

```bash
yarn install
yarn dev
```

Open the URL printed by Vite, typically `http://localhost:5173`.

### Build

```bash
yarn build
```

### Lint

```bash
yarn lint
```

### Preview production build

```bash
yarn preview
```

## Runtime Flow

1. `src/main.tsx` mounts the React app.
2. `src/App.tsx` creates the canvas, input hooks, debug overlay, and game server connection.
3. `src/engine/runtimes/setupRunTime.ts` builds the Babylon engine/scene, camera, movement, sync, and render loop.
4. `src/engine/createScene.ts` creates the local player, ghost manager, and remote player update loop.
5. `src/network/connectGameServer.ts` opens the WebSocket, handles the handshake, and dispatches opcodes.
6. `src/network/handlers.ts` maps server messages to spawn/update/despawn/attack actions.

## Controls

- Mouse or touch drag: rotate camera.
- Joystick: move the character on mobile.
- WASD: move on desktop.
- Attack: emitted from `useCombatStore` over WebSocket when the attack tick changes.

## Game Data

### Assets

- Models live in `public/models/`
- Textures live in `public/textures/`
- The current avatar skin is mapped in `src/players/cosmetics/cosmeticRegistry.ts`
- The current weapon is mapped in `src/weapons/weaponRegistry.ts`

### Network

- Opcodes are defined in `src/opcodes.ts`
- The default server endpoint is hard-coded in `src/network/connectGameServer.ts`
- If the server endpoint changes, update that file first

### Client Preset

`src/config/clientPreset.ts` selects a preset based on:

- device memory
- orientation

That preset controls:

- look sensitivity
- camera distance
- joystick radius and deadzone
- DPR cap
- render budget

## Project Structure

- `src/App.tsx`: app shell and game lifecycle
- `src/engine/`: Babylon scene, controllers, runtime
- `src/network/`: server connection and handlers
- `src/players/`: local player, remote player, cosmetics, ghost/reuse pool
- `src/weapons/`: weapon factory and registry
- `src/hooks/`: input, scroll lock, game server
- `src/components/`: joystick and debug overlay
- `public/`: models, textures, manifest, sample env

## Development Notes

- Keep local and remote sync on the same contract.
- Avoid large runtime refactors unless you understand their impact on the render loop.
- Prefer caching and reusing rigs, meshes, and asset containers when adding new entities.
- If you add a new opcode, update both the server contract and `handlers.ts`.
- If you change input handling, verify both mobile joystick and desktop pointer capture flows.
