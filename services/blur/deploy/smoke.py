"""Smoke test, run as root on Atlas. Reads the token from the root-only env file; never prints it."""
import base64, glob, json, os, statistics, subprocess, time, urllib.request, urllib.error

URL = "http://10.0.0.93:8791"
token = [l.split("=", 1)[1].strip() for l in open("/etc/supercargo-blur/blur.env") if l.startswith("SUPERCARGO_BLUR_TOKEN=")][0]
print("token length ok:", len(token) >= 32)

def post(body, auth=True):
    req = urllib.request.Request(URL + "/v1/redact", data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + token} if auth else {})})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

def cpu_ns():
    out = subprocess.check_output(["systemctl", "show", "-p", "CPUUsageNSec", "supercargo-blur"]).decode()
    return int(out.strip().split("=")[1])

print("health:", urllib.request.urlopen(URL + "/health", timeout=10).read().decode())
print("no token ->", post({"jpeg": "/9j/x"}, auth=False)[0])
print("bad body ->", post({"jpeg": "nope"})[0])

files = sorted(glob.glob("/tmp/sgblur-pkg/samples/*.jpg"))
lat = []
cpu0, t0 = cpu_ns(), time.time()
os.makedirs("/tmp/sgblur-out", exist_ok=True)
for rnd in range(3):
    for f in files:
        b = base64.b64encode(open(f, "rb").read()).decode()
        s = time.time(); code, r = post({"jpeg": b}); dt = time.time() - s
        lat.append(dt)
        if rnd == 0:
            print(os.path.basename(f), code, r.get("status"), r.get("reason"), "faces", r.get("faces"), "plates", r.get("plates"), f"{dt:.2f}s")
            if r.get("status") == "done":
                open("/tmp/sgblur-out/" + os.path.basename(f), "wb").write(base64.b64decode(r["jpeg"]))
wall = time.time() - t0
used = (cpu_ns() - cpu0) / 1e9
lat.sort()
print(f"requests {len(lat)}  p50 {statistics.median(lat):.2f}s  p95 {lat[int(len(lat)*0.95)-1]:.2f}s  max {lat[-1]:.2f}s")
print(f"cpu seconds {used:.1f} over {wall:.1f}s wall = {used/wall:.2f} cores average (cap 4)")
