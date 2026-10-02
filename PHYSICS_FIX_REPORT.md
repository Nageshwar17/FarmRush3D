# Physics-only update

This build is based on the previously approved `FarmRush3D-NoBarn-NoTrees` 3× minimal extension.

Changes in this update are limited to trailer/plough collision physics:

- Trailer collision now uses a compound full-body footprint covering the cargo body, front drawbar/hitch projection, and rear cap.
- Trailer/tractor contact uses tiny bounded depenetration and low damped push, avoiding large jumps and camera shake.
- Trailer/environment contact resolves the strongest contact only and does not shift an attached trailer child in world-space.
- Detached plough uses a compound footprint for the full visible bar and tine section.
- Plough/tractor contact uses tiny bounded depenetration and low damped push.
- Impact damage remains speed-based and cooldown-protected.
- Land, roads, billboards, camera, UI, tractor model and general driving behavior are unchanged.
