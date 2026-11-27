"""SupercarGO blur service for Atlas.

LAN-bound on Atlas, private callers only, bearer token, CPU only, one photo at a time.

POST /v1/redact {"jpeg": "<base64>"} -> {"status": "done", "jpeg", "faces", "plates", "dhash"}
                                      or {"status": "unavailable", "reason"}
GET  /health -> {"ok": true, "models": {"faces": bool, "plates": bool}}

Photos are held in memory for one request and never written to disk or logs.
"""
from __future__ import annotations

import hmac
import ipaddress
import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

os.environ.setdefault("CUDA_VISIBLE_DEVICES", "")  # never touch the GPUs

from redact import load_detectors, redact_jpeg  # noqa: E402

MAX_BODY = 1_600_000
# Detectors are not thread-safe and CPU is shared with training: one photo at a time by default.
SLOTS = threading.BoundedSemaphore(max(1, int(os.environ.get("SUPERCARGO_BLUR_CONCURRENCY", "1"))))
QUEUE_WAIT_S = 15.0
# Only private-network callers (the API on the LAN or this host). Token is still required.
ALLOWED = [ipaddress.ip_network(n.strip()) for n in os.environ.get("SUPERCARGO_BLUR_ALLOW", "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16").split(",") if n.strip()]


def allowed(addr: str) -> bool:
    try:
        ip = ipaddress.ip_address(addr)
    except ValueError:
        return False
    return any(ip in net for net in ALLOWED)


def make_handler(token: str, faces, plates):
    class Handler(BaseHTTPRequestHandler):
        server_version = "supercargo-blur/1"

        def log_message(self, *_args):  # no request logging: nothing about photos leaves memory
            return

        def _send(self, code: int, body: dict):
            data = json.dumps(body).encode()
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                return self._send(200, {"ok": True, "models": {"faces": faces is not None, "plates": plates is not None}})
            return self._send(404, {"ok": False})

        def do_POST(self):
            if not allowed(self.client_address[0]):
                return self._send(403, {"status": "unavailable", "reason": "forbidden"})
            if self.path != "/v1/redact":
                return self._send(404, {"ok": False})
            given = self.headers.get("Authorization", "")
            if not token or not hmac.compare_digest(given.encode(), ("Bearer " + token).encode()):
                return self._send(401, {"status": "unavailable", "reason": "unauthorized"})
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > MAX_BODY:
                return self._send(413, {"status": "unavailable", "reason": "size"})
            try:
                body = json.loads(self.rfile.read(length))
                jpeg = body["jpeg"]
                if not isinstance(jpeg, str) or not jpeg.startswith("/9j/"):
                    raise ValueError
            except Exception:
                return self._send(400, {"status": "unavailable", "reason": "bad_request"})
            if not SLOTS.acquire(timeout=QUEUE_WAIT_S):
                return self._send(503, {"status": "unavailable", "reason": "busy"})
            try:
                r = redact_jpeg(jpeg, faces, plates)
            finally:
                SLOTS.release()
            if r.status != "done":
                return self._send(200, {"status": "unavailable", "reason": r.reason})
            return self._send(200, {"status": "done", "jpeg": r.jpeg, "faces": r.faces, "plates": r.plates, "dhash": r.dhash})

    return Handler


def main():
    token = os.environ.get("SUPERCARGO_BLUR_TOKEN", "")
    if len(token) < 32:
        raise SystemExit("SUPERCARGO_BLUR_TOKEN must be at least 32 characters")
    faces, plates = load_detectors(os.environ.get("SUPERCARGO_BLUR_MODELS", "/opt/supercargo-blur/models"))
    host = os.environ.get("SUPERCARGO_BLUR_HOST", "127.0.0.1")
    port = int(os.environ.get("SUPERCARGO_BLUR_PORT", "8791"))
    ThreadingHTTPServer((host, port), make_handler(token, faces, plates)).serve_forever()


if __name__ == "__main__":
    main()
