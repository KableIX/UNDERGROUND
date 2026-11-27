#!/usr/bin/env bash
# SupercarGO blur service install on Atlas. Run as root. CPU only. Never prints the token.
set -euo pipefail
SRC=/tmp/sgblur-pkg
ROOT=/data/supercargo-blur
ETC=/etc/supercargo-blur
id -u supercargo-blur >/dev/null 2>&1 || useradd --system --no-create-home --home-dir /nonexistent --shell /usr/sbin/nologin supercargo-blur
install -d -m 0755 -o root -g root "$ROOT" "$ROOT/app" "$ROOT/models"
install -m 0644 "$SRC/app/redact.py" "$SRC/app/server.py" "$SRC/app/requirements.txt" "$ROOT/app/"
install -m 0755 "$SRC/app/fetch_models.sh" "$ROOT/app/"
# Models, checksum-pinned (fetch_models.sh fails on any mismatch).
"$ROOT/app/fetch_models.sh" "$ROOT/models" >/dev/null
chmod 0644 "$ROOT"/models/*.onnx
# Own venv, CPU-only runtime (onnxruntime, not onnxruntime-gpu).
[ -x "$ROOT/venv/bin/python" ] || python3 -m venv "$ROOT/venv"
"$ROOT/venv/bin/pip" install -q --upgrade pip
"$ROOT/venv/bin/pip" install -q -r "$ROOT/app/requirements.txt"
"$ROOT/venv/bin/pip" freeze > "$ROOT/app/requirements.lock"
if "$ROOT/venv/bin/pip" show onnxruntime-gpu >/dev/null 2>&1; then echo "onnxruntime-gpu present: refusing" >&2; exit 1; fi
# Token: generated here, root-only, never printed.
install -d -m 0700 -o root -g root "$ETC"
if [ ! -s "$ETC/blur.env" ]; then
  umask 077
  printf 'SUPERCARGO_BLUR_TOKEN=%s\n' "$(openssl rand -hex 32)" > "$ETC/blur.env"
fi
chown root:root "$ETC/blur.env"; chmod 0600 "$ETC/blur.env"
cat > /etc/systemd/system/supercargo-blur.service <<'UNIT'
[Unit]
Description=SupercarGO blur service (plates and faces, CPU only)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=supercargo-blur
Group=supercargo-blur
WorkingDirectory=/data/supercargo-blur/app
EnvironmentFile=/etc/supercargo-blur/blur.env
Environment=CUDA_VISIBLE_DEVICES=
Environment=NVIDIA_VISIBLE_DEVICES=none
Environment=SUPERCARGO_BLUR_HOST=10.0.0.93
Environment=SUPERCARGO_BLUR_PORT=8791
Environment=SUPERCARGO_BLUR_MODELS=/data/supercargo-blur/models
Environment=SUPERCARGO_BLUR_THREADS=4
Environment=SUPERCARGO_BLUR_CONCURRENCY=1
Environment=OMP_NUM_THREADS=4
Environment=OPENCV_LOG_LEVEL=ERROR
Environment=PYTHONDONTWRITEBYTECODE=1
ExecStart=/data/supercargo-blur/venv/bin/python /data/supercargo-blur/app/server.py
Restart=on-failure
RestartSec=5
# Never compete with training: low priority, hard cap of 4 cores, idle IO, bounded memory.
Nice=15
CPUWeight=10
CPUQuota=400%
IOSchedulingClass=idle
MemoryMax=3G
TasksMax=64
# No GPU access at all, and a read-only view of the system.
PrivateDevices=yes
DevicePolicy=closed
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX
RestrictNamespaces=yes
LockPersonality=yes
CapabilityBoundingSet=
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now supercargo-blur.service
systemctl restart supercargo-blur.service
echo INSTALLED
