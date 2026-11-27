#!/usr/bin/env python3
"""Build a FAKE App Attest attestation (test-only CA) for services/api tests.

Mirrors Apple's format: CBOR {fmt:'apple-appattest', attStmt:{x5c:[leaf, intermediate], receipt}, authData}.
The leaf certificate carries the nonce extension 1.2.840.113635.100.8.2.
Requires openssl. Output: app-attest-fixture.json (includes the test leaf private key).
"""
import base64, hashlib, json, os, subprocess, tempfile

APP_ID = 'TEAMID1234.com.kableix.underground'
CHALLENGE = 'test-challenge-0123456789abcdef'

def run(*args, cwd):
    subprocess.run(args, cwd=cwd, check=True, capture_output=True)

def cbor_len(major, n):
    if n < 24: return bytes([major << 5 | n])
    if n < 256: return bytes([major << 5 | 24, n])
    if n < 65536: return bytes([major << 5 | 25]) + n.to_bytes(2, 'big')
    return bytes([major << 5 | 26]) + n.to_bytes(4, 'big')

def cbor(v):
    if isinstance(v, bytes): return cbor_len(2, len(v)) + v
    if isinstance(v, str): b = v.encode(); return cbor_len(3, len(b)) + b
    if isinstance(v, list): return cbor_len(4, len(v)) + b''.join(cbor(x) for x in v)
    if isinstance(v, dict): return cbor_len(5, len(v)) + b''.join(cbor(k) + cbor(x) for k, x in v.items())
    if isinstance(v, int) and v >= 0: return cbor_len(0, v)
    if isinstance(v, int): return cbor_len(1, -1 - v)
    raise TypeError(v)

with tempfile.TemporaryDirectory() as d:
    days = '7300'
    run('openssl', 'ecparam', '-name', 'secp384r1', '-genkey', '-noout', '-out', 'root.key', cwd=d)
    run('openssl', 'req', '-x509', '-new', '-key', 'root.key', '-subj', '/CN=TEST App Attestation Root CA', '-days', days,
        '-addext', 'basicConstraints=critical,CA:true', '-addext', 'keyUsage=critical,keyCertSign,cRLSign', '-out', 'root.pem', cwd=d)
    run('openssl', 'ecparam', '-name', 'secp384r1', '-genkey', '-noout', '-out', 'ca.key', cwd=d)
    run('openssl', 'req', '-new', '-key', 'ca.key', '-subj', '/CN=TEST App Attestation CA 1', '-out', 'ca.csr', cwd=d)
    open(os.path.join(d, 'ca.ext'), 'w').write('basicConstraints=critical,CA:true\nkeyUsage=critical,keyCertSign,cRLSign\n')
    run('openssl', 'x509', '-req', '-in', 'ca.csr', '-CA', 'root.pem', '-CAkey', 'root.key', '-CAcreateserial', '-days', days, '-extfile', 'ca.ext', '-out', 'ca.pem', cwd=d)
    run('openssl', 'ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', 'leaf.key', cwd=d)
    run('openssl', 'pkcs8', '-topk8', '-nocrypt', '-in', 'leaf.key', '-out', 'leaf.pk8', cwd=d)
    pub = subprocess.run(['openssl', 'ec', '-in', 'leaf.key', '-pubout', '-outform', 'DER'], cwd=d, check=True, capture_output=True).stdout
    point = pub[-65:]
    assert point[0] == 4
    key_id = hashlib.sha256(point).digest()
    rp = hashlib.sha256(APP_ID.encode()).digest()
    cose = cbor({1: 2, 3: -7})  # minimal COSE key header; not parsed by the verifier
    auth = rp + bytes([0x41]) + (0).to_bytes(4, 'big') + b'appattestdevelop' + (32).to_bytes(2, 'big') + key_id + cose
    nonce = hashlib.sha256(auth + hashlib.sha256(CHALLENGE.encode()).digest()).digest()
    ext_der = bytes([0x30, 0x24, 0xa1, 0x22, 0x04, 0x20]) + nonce
    run('openssl', 'req', '-new', '-key', 'leaf.key', '-subj', '/CN=' + key_id.hex(), '-out', 'leaf.csr', cwd=d)
    open(os.path.join(d, 'leaf.ext'), 'w').write('basicConstraints=critical,CA:false\nkeyUsage=critical,digitalSignature\n1.2.840.113635.100.8.2=DER:' + ext_der.hex() + '\n')
    run('openssl', 'x509', '-req', '-in', 'leaf.csr', '-CA', 'ca.pem', '-CAkey', 'ca.key', '-CAcreateserial', '-days', days, '-extfile', 'leaf.ext', '-out', 'leaf.pem', cwd=d)
    der = lambda name: subprocess.run(['openssl', 'x509', '-in', name, '-outform', 'DER'], cwd=d, check=True, capture_output=True).stdout
    attestation = cbor({'fmt': 'apple-appattest', 'attStmt': {'x5c': [der('leaf.pem'), der('ca.pem')], 'receipt': b'test-receipt'}, 'authData': auth})
    out = {
        'note': 'FAKE test-only App Attest fixture. Not an Apple certificate.',
        'appId': APP_ID, 'challenge': CHALLENGE,
        'keyId': base64.b64encode(key_id).decode(),
        'attestation': base64.b64encode(attestation).decode(),
        'rootPem': open(os.path.join(d, 'root.pem')).read(),
        'leafPrivateKeyPem': open(os.path.join(d, 'leaf.pk8')).read(),
    }
json.dump(out, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'app-attest-fixture.json'), 'w'), indent=2)
print('ok', out['keyId'])
