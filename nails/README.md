# Lacquer — press-on nail shop

A variation on the 3D rack idea: eight press-on nail boxes hang from pegs on a wall. Your cursor is a
real pointing finger. Click a box and it flies to a try-on room, opens, and the nails appear on a
half-folded hand.

No build step and no CDN (three.js r186 is vendored). Serve the folder over HTTP:

```sh
cd nails && python3 -m http.server 8000
```

| Action | Result |
| --- | --- |
| Move | The pointing finger follows; it glides just in front of the boxes and nudges them |
| Press and drag over a box | Pushes it back into the wall and swings it |
| Click a box | Fly to the try-on room: lid opens, the set is fitted to five fingers |
| Shape / skin tone | Re-cuts the nails (almond, coffin, square, stiletto) and recolours the hand |
| Drag in the try-on room | Turn the hand |
| `←` `→` / `Esc` | Previous / next set, close (the box hangs itself back on its peg) |

## How it's made

- `assets/hands.glb` is built by `tools/build-hand.mjs`: each hand is a signed-distance field (tapered
  capsules per bone, ellipsoid palm and thumb pads, smooth-unioned so the webbing forms naturally),
  polygonised with surface nets and baked with smooth normals and ambient-occlusion vertex colours. It
  contains the half-folded try-on hand and the pointing hand used as the cursor, plus per-finger
  "nail frames" (a curve of surface points over each fingernail).
- `js/nail.js` cuts a nail shell (almond / coffin / square / stiletto, any length) that follows those
  frames and curls past the fingertip as a free edge.
- `js/box.js` models the hang-sell box: back plate with a euro-slot tab, wall ring, velvet insert with
  the nail set, a clear window film and a printed lid hinged on the left that really opens.
- `js/main.js` is the scene: each box is a pendulum on its peg (swing, tilt toward the wall, yaw) with
  soft collisions between neighbours; the fingertip applies contact and drag forces at the touch point.
