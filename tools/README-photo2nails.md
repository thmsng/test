# photo2nails – photo → per-nail 3D data

Takes one top-down photo of a press-on set (e.g. in a clear case) and produces, for every nail:
a rectified RGBA cutout (`nail-NN.png`, tip up), a relief height map (`-height.png`) and a tangent-space
normal map (`-normal.png`), plus `manifest.json` (real-world size, shape, mean colour) and a contact sheet
(`overview.jpg`) / numbered contours (`detected.jpg`) for checking.

```
pip install onnxruntime opencv-python-headless scipy scikit-image numpy
# models (not committed): tools/models/u2netp.onnx (rembg release v0.0.0), tools/models/midas_small.onnx (MiDaS v2_1 model-small.onnx)
python3 tools/photo2nails.py photo.jpg --out nails/images/sets/my-set --name "My Set" --layout 2x5
```

`--layout ROWSxCOLS` is the most reliable option. Other knobs: `--expect N`, `--chroma-thresh`, `--relief-mm`, `--no-depth`.

Limits: a single photo gives surface relief (beads, bows, domes), not hidden geometry; true charm meshes
would need a multi-view or generative image-to-3D service. The sample in `nails/images/sets/clown-carnival/`
comes from the user's own photo.
