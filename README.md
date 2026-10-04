# Courier Empire / Курьерская Империя

First playable foundation: a top-down walking courier in a small placeholder city.
JavaScript ES modules, Phaser 3, Vite. All visuals are original Phaser shapes;
no downloaded assets, backend, or Yandex Games SDK.

## Install and run

Install Node.js 22.12+ (or 20.19+), which includes npm. From the project folder:

```sh
npm install
npm run dev
```

Open the local URL printed by Vite (normally http://localhost:5173).
The city starts immediately. The dev server binds to all interfaces so you can
also open `http://YOUR_COMPUTER_LAN_IP:5173` on a phone on the same network.

```sh
npm run build
npm run preview
```

`build` writes a production build to `dist/`; `preview` serves that build locally.

## Controls

- Desktop: WASD or arrow keys. Diagonal movement keeps the same speed.
- Mobile / narrow screens: hold the on-screen direction buttons. Hold two for diagonal movement.
- The camera follows the courier. Buildings and city boundaries block movement.
- Grass, roads, sidewalks, and the park are walkable. Trees are decorative.

The canvas fills the window and resizes with it, including portrait/landscape
changes. Movement stops when the tab loses focus.

## Project structure

```text
index.html                      Page, accessible HUD, touch buttons
package.json                    Scripts and two direct dependencies
package-lock.json               Reproducible dependency versions
src/
  main.js                       Phaser configuration and scene registration
  style.css                     Responsive page/HUD styles
  scenes/
    BootScene.js                Local platform initialization and courier texture
    GameScene.js                World, collisions, camera, and HUD binding
  entities/
    Courier.js                  Keyboard/touch input and physics movement
  world/
    createCity.js               City layout, original shapes, static obstacles
  state/
    GameState.js                Shared money, level, xp, reputation
  services/
    PlatformService.js          LOCAL platform adapter
```

## Scope and extension points

The world is 2400 × 2000 pixels. Courier speed is 220 pixels/second, integrated
by Arcade Physics. Buildings use static rectangular bodies; the courier uses
a small rectangular body independent of its visual facing direction.

`gameState.getSnapshot()`, `update(changes)`, and `subscribe(listener)` own all
progression values. The prototype starts with money 0, level 1, xp 0, reputation 0;
exploring does not increase these values yet.

`platformService` exposes initialization, local save/load, language, authentication,
ad, and leaderboard entry points. Save/load uses localStorage with graceful
failure when storage is unavailable. The prototype does not automatically load
or save progression yet. Authentication, ads, and leaderboard methods return
explicit unsupported LOCAL results and have no external side effects.

No orders, NPCs, vehicles, leveling gameplay, idle/tycoon mechanics, real ads,
audio, authentication, leaderboards, or SDK integration are implemented.

## Prototype verification

Verified npm install, npm run dev, and npm run build. Browser checks covered
WASD, arrow keys, camera tracking, sustained movement against a building,
pointer-pad movement, and canvas resizing at desktop, 390 × 844 portrait,
and 844 × 390 landscape sizes. No browser console warnings or errors were observed.
Vite reports a large-chunk warning because Phaser is bundled (about 1.2 MB
minified / 322 KB gzipped); the production build succeeds.
