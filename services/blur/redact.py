"""SupercarGO blur: find plates and faces, blur them, prove it worked.

Fail closed. Any missing model, decode problem or detection that survives the
blur returns 'unavailable', and the API keeps the sighting private.
Nothing is written to disk. CPU only.
"""
from __future__ import annotations

import base64
import os
from dataclasses import dataclass, field
from typing import Callable, List, Optional, Sequence, Tuple

import cv2
import numpy as np

Box = Tuple[int, int, int, int]  # x, y, w, h in pixels

MAX_SIDE = 4096
PAD = 0.15
FACE_THRESHOLD = 0.5   # YuNet score; blur anything at or above
PLATE_THRESHOLD = 0.25  # RF-DETR plate confidence; 0.87 recall / 0.91 precision per model card
VERIFY_FACE = 0.6      # a face this sure after blurring means failure
VERIFY_PLATE = 0.35    # a plate this sure after blurring means failure
IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


@dataclass
class Result:
    status: str  # 'done' or 'unavailable'
    jpeg: Optional[str] = None
    faces: int = 0
    plates: int = 0
    dhash: Optional[str] = None
    reason: Optional[str] = None
    boxes: List[Box] = field(default_factory=list)


Detector = Callable[[np.ndarray, float], List[Box]]


class YuNetFaces:
    """OpenCV Zoo YuNet (MIT). Model: face_detection_yunet_2023mar.onnx."""

    def __init__(self, path: str):
        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        self.path = path

    def __call__(self, img: np.ndarray, threshold: float) -> List[Box]:
        h, w = img.shape[:2]
        det = cv2.FaceDetectorYN.create(self.path, "", (w, h), threshold, 0.3, 5000)
        _, faces = det.detect(img)
        if faces is None:
            return []
        return [(int(f[0]), int(f[1]), int(f[2]), int(f[3])) for f in faces]


class RfDetrPlates:
    """RF-DETR Medium plate fine-tune (Apache-2.0), imbcmdth/rfdetr-onnx rf-detr-medium-plate.onnx.

    Input 1x3x576x576 RGB stretched, ImageNet-normalized. Output dets (cx, cy, w, h)
    as fractions, labels as logits; index 0 is the plate. A second pass over four
    overlapping tiles catches small plates the full-frame pass misses.
    """

    SIZE = 576

    def __init__(self, path: str):
        import onnxruntime as ort  # MIT

        if not os.path.isfile(path):
            raise FileNotFoundError(path)
        self.session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])

    def _pass(self, img: np.ndarray, threshold: float) -> List[Tuple[float, float, float, float]]:
        rgb = cv2.cvtColor(cv2.resize(img, (self.SIZE, self.SIZE)), cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        x = ((rgb - IMAGENET_MEAN) / IMAGENET_STD).transpose(2, 0, 1)[None]
        dets, labels = self.session.run(None, {"input": x})
        conf = 1.0 / (1.0 + np.exp(-labels[0][:, 0]))
        return [tuple(d) for d, c in zip(dets[0], conf) if c >= threshold]

    def __call__(self, img: np.ndarray, threshold: float) -> List[Box]:
        h, w = img.shape[:2]
        boxes: List[Box] = []
        regions = [(0, 0, w, h)]
        tw, th = int(w * 0.6), int(h * 0.6)
        regions += [(0, 0, tw, th), (w - tw, 0, tw, th), (0, h - th, tw, th), (w - tw, h - th, tw, th)]
        for rx, ry, rw, rh in regions:
            for cx, cy, bw, bh in self._pass(img[ry:ry + rh, rx:rx + rw], threshold):
                boxes.append((int(rx + (cx - bw / 2) * rw), int(ry + (cy - bh / 2) * rh), int(bw * rw), int(bh * rh)))
        return boxes


def pad_box(box: Box, w: int, h: int, pad: float = PAD) -> Box:
    x, y, bw, bh = box
    px, py = int(bw * pad), int(bh * pad)
    x0, y0 = max(0, x - px), max(0, y - py)
    x1, y1 = min(w, x + bw + px), min(h, y + bh + py)
    return x0, y0, max(0, x1 - x0), max(0, y1 - y0)


def obscure(img: np.ndarray, boxes: Sequence[Box]) -> np.ndarray:
    """Pixelate to a coarse grid, then blur, each padded box. Irreversible at any zoom."""
    out = img.copy()
    h, w = out.shape[:2]
    for box in boxes:
        x, y, bw, bh = pad_box(box, w, h)
        if bw < 2 or bh < 2:
            continue
        roi = out[y:y + bh, x:x + bw]
        # A fixed, coarse grid whatever the box size: at most 8 x 5 blocks, so no glyph survives.
        small = cv2.resize(roi, (max(1, min(8, bw // 6)), max(1, min(5, bh // 6))), interpolation=cv2.INTER_AREA)
        block = cv2.resize(small, (bw, bh), interpolation=cv2.INTER_NEAREST)
        k = max(3, (min(bw, bh) // 2) | 1)
        out[y:y + bh, x:x + bw] = cv2.GaussianBlur(block, (k, k), 0)
    return out


def dhash64(img: np.ndarray) -> int:
    """64-bit difference hash as a signed integer (fits Postgres bigint)."""
    g = cv2.resize(cv2.cvtColor(img, cv2.COLOR_BGR2GRAY), (9, 8), interpolation=cv2.INTER_AREA)
    bits = (g[:, 1:] > g[:, :-1]).flatten()
    v = 0
    for b in bits:
        v = (v << 1) | int(b)
    return v - (1 << 64) if v >= (1 << 63) else v


def redact_jpeg(jpeg_b64: str, faces: Optional[Detector], plates: Optional[Detector]) -> Result:
    if faces is None or plates is None:
        return Result("unavailable", reason="models_missing")
    try:
        data = base64.b64decode(jpeg_b64, validate=True)
    except Exception:
        return Result("unavailable", reason="bad_base64")
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        return Result("unavailable", reason="bad_jpeg")
    h, w = img.shape[:2]
    if max(h, w) > MAX_SIDE or min(h, w) < 64:
        return Result("unavailable", reason="bad_size")
    try:
        face_boxes = faces(img, FACE_THRESHOLD)
        plate_boxes = plates(img, PLATE_THRESHOLD)
        out = obscure(img, face_boxes + plate_boxes)
        # Prove it: run both detectors again on the output.
        if faces(out, VERIFY_FACE) or plates(out, VERIFY_PLATE):
            return Result("unavailable", reason="residual_detection")
    except Exception:
        return Result("unavailable", reason="detector_error")
    ok, enc = cv2.imencode(".jpg", out, [int(cv2.IMWRITE_JPEG_QUALITY), 85])  # no EXIF is written
    if not ok:
        return Result("unavailable", reason="encode_failed")
    return Result(
        "done",
        jpeg=base64.b64encode(enc.tobytes()).decode(),
        faces=len(face_boxes),
        plates=len(plate_boxes),
        dhash=str(dhash64(img)),
        boxes=face_boxes + plate_boxes,
    )


def load_detectors(model_dir: str) -> Tuple[Optional[Detector], Optional[Detector]]:
    try:
        faces: Optional[Detector] = YuNetFaces(os.path.join(model_dir, "face_detection_yunet_2023mar.onnx"))
    except Exception:
        faces = None
    try:
        plates: Optional[Detector] = RfDetrPlates(os.path.join(model_dir, "rf-detr-medium-plate.onnx"))
    except Exception:
        plates = None
    return faces, plates
