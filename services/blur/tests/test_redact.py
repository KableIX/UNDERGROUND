import base64
import json
import os
import sys
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

import cv2
import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from redact import dhash64, load_detectors, obscure, redact_jpeg  # noqa: E402
from server import make_handler  # noqa: E402

MODELS = os.environ.get("SUPERCARGO_BLUR_MODELS", "")


def jpeg(img):
    return base64.b64encode(cv2.imencode(".jpg", img)[1].tobytes()).decode()


def scene():
    rng = np.random.default_rng(3)
    img = (rng.random((480, 640, 3)) * 60 + 60).astype(np.uint8)
    cv2.rectangle(img, (120, 200), (520, 380), (40, 40, 160), -1)  # a red slab
    return img


def none(_img, _t):
    return []


class Core(unittest.TestCase):
    def test_missing_models_fail_closed(self):
        self.assertEqual(redact_jpeg(jpeg(scene()), None, none).status, "unavailable")
        self.assertEqual(redact_jpeg(jpeg(scene()), none, None).reason, "models_missing")

    def test_bad_input_fails_closed(self):
        self.assertEqual(redact_jpeg("not base64!!", none, none).reason, "bad_base64")
        self.assertEqual(redact_jpeg(base64.b64encode(b"hello").decode(), none, none).reason, "bad_jpeg")
        tiny = np.zeros((20, 20, 3), np.uint8)
        self.assertEqual(redact_jpeg(jpeg(tiny), none, none).reason, "bad_size")

    def test_detector_error_fails_closed(self):
        def boom(_i, _t):
            raise RuntimeError("x")
        self.assertEqual(redact_jpeg(jpeg(scene()), boom, none).reason, "detector_error")

    def test_residual_detection_fails_closed(self):
        always = lambda _i, _t: [(200, 250, 80, 30)]  # noqa: E731
        self.assertEqual(redact_jpeg(jpeg(scene()), none, always).reason, "residual_detection")

    def test_detected_boxes_are_destroyed(self):
        img = scene()
        cv2.putText(img, "7ABC123", (220, 300), cv2.FONT_HERSHEY_SIMPLEX, 1.2, (255, 255, 255), 3)
        box = (210, 260, 200, 60)
        calls = []

        def plates(i, t):
            calls.append(t)
            return [box] if len(calls) == 1 else []

        r = redact_jpeg(jpeg(img), none, plates)
        self.assertEqual(r.status, "done")
        self.assertEqual(r.plates, 1)
        out = cv2.imdecode(np.frombuffer(base64.b64decode(r.jpeg), np.uint8), cv2.IMREAD_GRAYSCALE)
        before = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)[262:318, 212:408]
        after = out[262:318, 212:408]
        self.assertLess(cv2.Laplacian(after, cv2.CV_64F).var(), cv2.Laplacian(before, cv2.CV_64F).var() / 20)

    def test_output_has_no_exif_and_a_hash(self):
        r = redact_jpeg(jpeg(scene()), none, none)
        self.assertEqual(r.status, "done")
        self.assertNotIn(b"Exif", base64.b64decode(r.jpeg)[:200])
        self.assertIsInstance(int(r.dhash), int)

    def test_dhash_survives_recompression_but_not_a_new_photo(self):
        a = cv2.GaussianBlur(scene(), (31, 31), 0)
        cv2.circle(a, (480, 120), 70, (200, 190, 170), -1)
        b = cv2.imdecode(cv2.imencode(".jpg", a, [int(cv2.IMWRITE_JPEG_QUALITY), 40])[1], cv2.IMREAD_COLOR)
        c = cv2.flip(a, 1)
        dist = lambda x, y: bin((x ^ y) & ((1 << 64) - 1)).count("1")  # noqa: E731
        self.assertLessEqual(dist(dhash64(a), dhash64(b)), 6)
        self.assertGreater(dist(dhash64(a), dhash64(c)), 6)

    def test_obscure_clips_to_frame(self):
        out = obscure(scene(), [(600, 450, 200, 200), (-10, -10, 30, 30)])
        self.assertEqual(out.shape, (480, 640, 3))


class Http(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.token = "t" * 40
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), make_handler(cls.token, none, none))
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()
        cls.url = "http://127.0.0.1:%d" % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def post(self, body, token):
        req = urllib.request.Request(self.url + "/v1/redact", data=json.dumps(body).encode(), method="POST",
                                     headers={"Content-Type": "application/json", "Authorization": "Bearer " + token})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def test_requires_token(self):
        self.assertEqual(self.post({"jpeg": jpeg(scene())}, "wrong")[0], 401)

    def test_rejects_non_jpeg(self):
        self.assertEqual(self.post({"jpeg": "iVBOR"}, self.token)[0], 400)

    def test_redacts(self):
        code, body = self.post({"jpeg": jpeg(scene())}, self.token)
        self.assertEqual((code, body["status"]), (200, "done"))
        self.assertIn("dhash", body)


@unittest.skipUnless(MODELS and os.path.isdir(MODELS), "set SUPERCARGO_BLUR_MODELS to run real-model tests")
class RealModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.faces, cls.plates = load_detectors(MODELS)

    def test_models_load_on_cpu(self):
        self.assertIsNotNone(self.faces)
        self.assertIsNotNone(self.plates)

    def test_plain_scene_passes(self):
        r = redact_jpeg(jpeg(scene()), self.faces, self.plates)
        self.assertEqual(r.status, "done", r.reason)

    def test_samples_if_present(self):
        folder = os.environ.get("SUPERCARGO_BLUR_SAMPLES", "")
        if not folder or not os.path.isdir(folder):
            self.skipTest("no sample photos")
        for name in sorted(os.listdir(folder)):
            img = cv2.imread(os.path.join(folder, name))
            if img is None:
                continue
            r = redact_jpeg(jpeg(img), self.faces, self.plates)
            print(name, r.status, r.reason, "faces", r.faces, "plates", r.plates)


if __name__ == "__main__":
    unittest.main()


class Callers(unittest.TestCase):
    def test_only_private_networks(self):
        import server

        self.assertTrue(server.allowed("10.0.0.93"))
        self.assertTrue(server.allowed("127.0.0.1"))
        self.assertFalse(server.allowed("8.8.8.8"))
        self.assertFalse(server.allowed("100.77.37.88"))
        self.assertFalse(server.allowed("not-an-ip"))
