# Atelier — 3D t-shirt rack

A minimalist clothing-store landing page. Eight tees hang side-on from a rail; they swing with real
physics, and clicking one lifts it into a front / back viewer.

No build step and no CDN: three.js (r186) is vendored in `vendor/`.

## Run

ES modules need a web server (not `file://`):

```sh
cd atelier
python3 -m http.server 8000   # then open http://localhost:8000
```

## Use

| Action | Result |
| --- | --- |
| Drag a tee | Grab it by the point you touch and swing / twist it; neighbours get bumped |
| Sweep the cursor across tees | Brush them like clothes on a rack |
| Drag the background | Orbit the camera (pans along the rail on narrow screens) |
| Click a tee | Others slide away along the rail, the tee turns to face you |
| **Front / Back**, or drag in the viewer | Swivel the hanger; it snaps to front or back |
| `←` `→` / `Esc` | Previous / next tee, close |

## How it's built

- `js/shirt.js` — the garment is procedural geometry: a lofted torso (super-ellipse cross-sections,
  neckline scoop, drape folds, curved hem), two lofted sleeves, rolled hem / cuff / collar tubes and a
  wooden hanger with a swivel hook. A small shader patch adds hem lag and flutter to the fabric.
- `js/designs.js` — the 8 products, their prints (drawn to a canvas, front on one half and back on the
  other) and a knit bump texture.
- `js/main.js` — scene, lighting, soft shadows on the wall, and the physics:
  each hanger is a rigid pendulum about the rail (swing, tilt along the rail, yaw, and sliding along the
  rail) integrated at 240 Hz, with soft collisions between neighbours. The user's drag is a spring on the
  grabbed point, so torque depends on where you grab. The cloth hem follows through a second-order
  spring so it overshoots and wobbles.

Edit `PRODUCTS` in `js/designs.js` to change names, colours and prints.
