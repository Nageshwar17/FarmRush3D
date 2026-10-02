# FarmRush 3D — Static Edition

FarmRush 3D is a browser-based Three.js tractor game packaged as a **static website**.

## What is included

- `index.html` — game UI and page shell
- `styles.css` — all responsive/mobile styling
- `js/game.js` — 3D world, tractor physics, trailer, ploughing, HUD, input and game loop
- `js/audio.js` — WebAudio engine and horn subsystem

## Database / backend

This version does **not** require a database, backend server, API, login system, or build process.
All game state is held in the browser while the page is running. The terrain, vegetation, field textures, tractor, trailer artwork and other visuals are generated in JavaScript.

The runtime has one external dependency: Three.js `0.160.0`, loaded from jsDelivr in `index.html`.

## Deploy

Upload the project folder as a normal static site. A host only needs to serve `index.html` and the `js/` and `styles.css` files.

Examples of suitable static hosting workflows include Netlify, GitHub Pages, Vercel static hosting, or any ordinary web server.

## Local test

Use a local HTTP server rather than opening `index.html` directly with `file://`:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Controls

Desktop: `W/A/S/D`, arrow keys, `Q/E`, `R`, `N`, `1–5`, `Space`, `Shift`, `X/C`, `T`, `H`, `Esc`.

Mobile: on-screen steering and throttle/reverse controls plus the action dock.

Attachment controls: `Z` toggles the plough and `V` toggles the trailer.

## Rigid vehicle handling

The vehicle simulation uses a deterministic client-side rigid-body approximation. The tractor chassis stays level, acceleration/braking is mass-like, steering response changes with speed, the trailer hitch has a firm damped articulation with a hard steering stop, and vehicle/world collisions apply a firm impulse. No physics server or database is required.


### Collision behavior
- Tractor: collides with the three defined rock/hazard objects.
- Trailer: kinematic and collision-free with the environment. It does not push, snag, bounce, or take damage from hazards.
- Tractor ↔ trailer: no independent collision system; the trailer remains mechanically attached through the hitch.


Trailer physics: the detached trailer is a heavy rigid body that collides with the tractor and registered environment objects, reacts to impact momentum, and contributes speed-based tractor damage. The attached trailer remains constrained by the hitch but still collides with the environment. Physics is deterministic and client-side; no backend or database is required.


### Stable physical collision update
The detached trailer remains a real physical object, but tractor/trailer contact is resolved without teleporting the tractor. The trailer receives a small, smooth separation velocity so impacts do not cause repeated penetration, jitter, or follow-camera shaking. Trailer/environment contact uses the same stable separation approach.

### Runtime fix
This build also fixes the detached-trailer collision runtime error by replacing an unsupported `Vector2.perp()` call with an explicit perpendicular vector.


## Clean integrated build
- Based on the last stable physical-trailer build.
- Added heavy detached-plough physics and environment collision.
- Natural camera uses smoothed position/look target with level horizon and no quaternion roll.
- Cabin camera is slightly higher.
- Safe startup spawn avoids initial overlap with environment colliders.
- Flowers/grass remain visual-only; tree collisions use trunk footprints.
- Barn collisions use wall segments with a door opening; billboard collisions use support legs.
- Engine master volume is increased slightly (15%).
- No backend or database is required.


## Confirmed change
Barn 1, Barn 2, and all tree objects/trunk colliders are removed from this build. No other gameplay systems are intentionally changed in this step.
