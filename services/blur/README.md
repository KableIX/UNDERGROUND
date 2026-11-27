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
3. Pad each box 15%. Pixelate to 1/16 and Gaussian-blur.
4. Run both detectors again on the result. A face at 0.6 or a plate at 0.35 means failure.
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

## Running on Atlas (when approved)

```
python3 -m venv /opt/supercargo-blur/venv
/opt/supercargo-blur/venv/bin/pip install -r requirements.txt
./fetch_models.sh /opt/supercargo-blur/models
SUPERCARGO_BLUR_TOKEN=... CUDA_VISIBLE_DEVICES= /opt/supercargo-blur/venv/bin/python server.py   # 127.0.0.1:8791
```

API side: `SUPERCARGO_BLUR_URL=http://127.0.0.1:8791/v1/redact` and the same token as `SUPERCARGO_BLUR_TOKEN`. CPU only by design; it does not use GPU0 or :8188.

## Tests

```
python3 -m unittest discover -s tests -v          # model-free tests always run
SUPERCARGO_BLUR_MODELS=/path/to/models python3 -m unittest discover -s tests -v   # adds the real-model tests
```
