#!/usr/bin/env bash
# Download the two detector models and verify them. Run on Atlas (or locally for tests).
set -euo pipefail
DIR="${1:-/opt/supercargo-blur/models}"
mkdir -p "$DIR"
fetch() { curl -fL --retry 3 -o "$DIR/$2" "$1"; echo "$3  $DIR/$2" | sha256sum -c -; }
# YuNet, OpenCV Zoo, MIT licence.
fetch https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx \
  face_detection_yunet_2023mar.onnx 8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4
# RF-DETR Medium plate fine-tune, Apache-2.0 (Roboflow RF-DETR Apache-2.0; Open Images data CC BY).
fetch https://huggingface.co/imbcmdth/rfdetr-onnx/resolve/main/rf-detr-medium-plate.onnx \
  rf-detr-medium-plate.onnx 2597bc5f0f71e2a6c8da3983367d774599d0e587b2e298238fd8fb71bd1af337
