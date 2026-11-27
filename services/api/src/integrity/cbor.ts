/**
 * Minimal CBOR decoder for App Attest objects: unsigned/negative ints, byte and text strings,
 * arrays, maps, and simple false/true/null. Definite lengths only (as Apple emits).
 */
export type Cbor = number | bigint | Buffer | string | boolean | null | Cbor[] | Map<Cbor, Cbor>;

export function decodeCbor(input: Buffer): Cbor {
  let offset = 0;
  const need = (n: number) => { if (offset + n > input.length) throw new Error('cbor_truncated'); };
  const length = (info: number): number => {
    if (info < 24) return info;
    if (info === 24) { need(1); return input.readUInt8(offset++); }
    if (info === 25) { need(2); const v = input.readUInt16BE(offset); offset += 2; return v; }
    if (info === 26) { need(4); const v = input.readUInt32BE(offset); offset += 4; return v; }
    if (info === 27) {
      need(8); const v = input.readBigUInt64BE(offset); offset += 8;
      if (v > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cbor_too_large');
      return Number(v);
    }
    throw new Error('cbor_indefinite_unsupported');
  };
  const item = (depth: number): Cbor => {
    if (depth > 16) throw new Error('cbor_too_deep');
    need(1);
    const head = input.readUInt8(offset++);
    const major = head >> 5;
    const info = head & 0x1f;
    switch (major) {
      case 0: return length(info);
      case 1: return -1 - length(info);
      case 2: { const n = length(info); need(n); const v = Buffer.from(input.subarray(offset, offset + n)); offset += n; return v; }
      case 3: { const n = length(info); need(n); const v = input.toString('utf8', offset, offset + n); offset += n; return v; }
      case 4: { const n = length(info); const out: Cbor[] = []; for (let i = 0; i < n; i++) out.push(item(depth + 1)); return out; }
      case 5: { const n = length(info); const out = new Map<Cbor, Cbor>(); for (let i = 0; i < n; i++) { const k = item(depth + 1); out.set(k, item(depth + 1)); } return out; }
      case 7:
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        throw new Error('cbor_simple_unsupported');
      default: throw new Error('cbor_tag_unsupported');
    }
  };
  const value = item(0);
  if (offset !== input.length) throw new Error('cbor_trailing_bytes');
  return value;
}

export function cborField(map: Cbor, key: string): Cbor | undefined {
  return map instanceof Map ? map.get(key) : undefined;
}

/** DER TLV reader, enough to walk to one certificate extension. */
type Tlv = { tag: number; start: number; end: number; next: number };
function readTlv(der: Buffer, at: number): Tlv {
  if (at + 2 > der.length) throw new Error('der_truncated');
  const tag = der[at]!;
  let len = der[at + 1]!;
  let start = at + 2;
  if (len & 0x80) {
    const bytes = len & 0x7f;
    if (bytes < 1 || bytes > 4 || start + bytes > der.length) throw new Error('der_length');
    len = 0;
    for (let i = 0; i < bytes; i++) len = len * 256 + der[start + i]!;
    start += bytes;
  }
  const end = start + len;
  if (end > der.length) throw new Error('der_truncated');
  return { tag, start, end, next: end };
}
function children(der: Buffer, parent: Tlv): Tlv[] {
  const out: Tlv[] = [];
  for (let at = parent.start; at < parent.end;) { const t = readTlv(der, at); out.push(t); at = t.next; }
  return out;
}

/** OID 1.2.840.113635.100.8.2: Apple App Attest nonce extension. */
const APPLE_NONCE_OID = Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x63, 0x64, 0x08, 0x02]);

/** The 32-byte nonce from an App Attest credential certificate, or null. */
export function appleAttestNonce(certDer: Buffer): Buffer | null {
  try {
    const cert = readTlv(certDer, 0);
    const tbs = children(certDer, cert)[0]!;
    const extsWrapper = children(certDer, tbs).find(t => t.tag === 0xa3);
    if (!extsWrapper) return null;
    const exts = children(certDer, children(certDer, extsWrapper)[0]!);
    for (const ext of exts) {
      const parts = children(certDer, ext);
      const oid = parts[0]!;
      if (oid.tag !== 0x06 || !certDer.subarray(oid.start, oid.end).equals(APPLE_NONCE_OID)) continue;
      const value = parts[parts.length - 1]!; // OCTET STRING
      const seq = readTlv(certDer, value.start); // SEQUENCE
      const tagged = children(certDer, seq).find(t => t.tag === 0xa1);
      if (!tagged) return null;
      const octets = readTlv(certDer, tagged.start);
      if (octets.tag !== 0x04) return null;
      return Buffer.from(certDer.subarray(octets.start, octets.end));
    }
    return null;
  } catch {
    return null;
  }
}
