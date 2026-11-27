# SupercarGO blur service

Blurs licence plates and faces before a SupercarGO sighting can reach the members map. Designed to run on Atlas next to the API. **Not deployed.**

## Contract

- `POST /v1/redact` with `Authorization: Bearer $SUPERCARGO_BLUR_TOKEN` and `{"jpeg": "<base64>"}`.
- Returns `{"status":"done","jpeg","faces","plates","dhash"}` or `{"status":"unavailable","reason"}`.
- `GET /health` reports whether both models loaded.

## Fail closed

Missing model, bad image, detector error, or a face or plate still detectable after blurring: `unavailable`. The API then keeps the sighting private. Nothing is published on doubt.

## Method

1. Decode. Refuse anything over 4096 px or under 64 px.
2. Faces: YuNet at score 0.5. Plates: RF-DETR plate model at 0.25, on the full frame plus four overlapping 60% tiles for small plates.
3. Pad each box 15%. Pixelate to a coarse grid (at most 8 x 5 blocks) and Gaussian-blur.
4. Run both detectors again on the result. Anything found at face 0.6 or plate 0.35 is obscured again with a 50% margin, up to three rounds. Still found after that: failure.
5. Re-encode as JPEG (no EXIF). Return a 64-bit difference hash for near-duplicate checks.

## Models and licences

| Use | Model | Licence |
| --- | --- | --- |
| Faces | YuNet `face_detection_yunet_2023mar.onnx`, OpenCV Zoo | MIT |
| Plates | `rf-detr-medium-plate.onnx` from `imbcmdth/rfdetr-onnx`: RF-DETR Medium fine-tuned on Open Images V7 plates | Apache-2.0 (RF-DETR Apache-2.0; data CC BY 4.0 / CC BY 2.0) |
| Runtime | opencv-python-headless, numpy, onnxruntime | Apache-2.0, BSD-3, MIT |

Rejected: Ultralytics YOLO plate weights (AGPL-3.0); `open-image-models` YOLOv9 plates (repo MIT, but trained with code derived from GPL-3.0 YOLOv9, licence unclear). Fallback if needed: `Topurrra/rtdetr-license-plate-detection-onnx` (Apache-2.0), whose compressed scores need a different threshold.

Model card numbers for the plate model: recall 0.87 / precision 0.91 at 0.25. Weak below 32 px plate width (recall 0.47), which is why the tile pass exists.

## Photos and storage

Photos live on members' phones. The full-resolution original never leaves the phone. The app sends a 1280 px working copy, EXIF stripped, which this service holds in memory for one request. Only the blurred derivative is stored, and only when the sighting can be published.

## Running on Atlas

Installed 2026-11-27 as `supercargo-blur.service`. Not wired into the API.

- Code, venv and models: `/data/supercargo-blur/{app,venv,models}`, owned by root, run as the `supercargo-blur` system user.
- Listens on `10.0.0.93:8791` (LAN). Accepts private-network callers only, and every redact call needs the token.
- Token: generated on Atlas, in `/etc/supercargo-blur/blur.env` (root, 0600). Never printed or committed.
- CPU only: `CUDA_VISIBLE_DEVICES=` and `PrivateDevices=yes`, so no GPU device is even visible. `onnxruntime` (CPU build) only; the installer refuses `onnxruntime-gpu`.
- Kept out of training's way: `Nice=15`, `CPUWeight=10`, `CPUQuota=400%` (4 cores at most), 4 inference threads, one photo at a time (others wait up to 15 s, then fail closed), idle IO, `MemoryMax=3G`.
- Reinstall or update: put `redact.py`, `server.py`, `requirements.txt` and `fetch_models.sh` in `/tmp/sgblur-pkg/app/`, then run `sudo bash deploy/install.sh`. The token is kept if it already exists.
- Smoke test: `sudo /data/supercargo-blur/venv/bin/python deploy/smoke.py` (health, auth, sample photos, latency, CPU seconds).

Measured on Atlas with 8 sample photos x 3 (1280 px): p50 5.3 s, p95 5.9 s, 3.9 cores average while busy (cap 4), nothing on any GPU.

To wire it in later, set on the API: `SUPERCARGO_BLUR_URL=http://10.0.0.93:8791/v1/redact` and `SUPERCARGO_BLUR_TOKEN` (same value as in `blur.env`).

## Tests

```
python3 -m unittest discover -s tests -v          # model-free tests always run
SUPERCARGO_BLUR_MODELS=/path/to/models python3 -m unittest discover -s tests -v   # adds the real-model tests
```
