import { decode } from "base64-arraybuffer";
import packed from "../../assets/garage/private-studio.json";

// Raw LZ4 blocks keep the baked studio small enough for the development bundle.
export function inflate(value: string, length: number) {
  const source = new Uint8Array(decode(value));
  const result = new Uint8Array(length);
  let input = 0,
    output = 0;
  function run(size: number) {
    if (size === 15) {
      let next;
      do {
        next = source[input++];
        size += next;
      } while (next === 255);
    }
    return size;
  }
  while (input < source.length) {
    const token = source[input++];
    const literals = run(token >> 4);
    result.set(source.subarray(input, input + literals), output);
    input += literals;
    output += literals;
    if (input === source.length) break;
    const distance = source[input++] | (source[input++] << 8);
    const end = output + run(token & 15) + 4;
    while (output < end) {
      result[output] = result[output - distance];
      output++;
    }
  }
  if (output !== length) throw new Error("Incomplete studio light probe");
  return result;
}

export const backdropSize = 448;
const samples = 6 * backdropSize * backdropSize;
function buildBackdrop() {
  const y = inflate(packed.luma, samples);
  const co = inflate(packed.orange, samples);
  const cg = inflate(packed.green, samples);
  const result = new Uint32Array(samples);
  for (let i = 0; i < samples; i++) {
    const chroma = co[i] - 128,
      green = cg[i] - 128;
    const r = Math.max(0, Math.min(255, y[i] + chroma - green));
    const g = Math.max(0, Math.min(255, y[i] + green));
    const b = Math.max(0, Math.min(255, y[i] - chroma - green));
    result[i] = r | (g << 8) | (b << 16);
  }
  return result;
}
export const backdrop = buildBackdrop();
function lightField(data: string, size: number) {
  const bytes = inflate(data, 6 * size * size * 3);
  const lut = Float32Array.from({ length: 256 }, (_, i) => 2 ** (i / 12 - 13));
  return Float32Array.from(bytes, (b) => lut[b]);
}
export const glossField = lightField(packed.gloss, 128);
export const satinField = lightField(packed.satin, 64);
export const diffuseField = lightField(packed.diffuse, 24);

// Dominant-axis projection avoids trigonometry in the pixel loop.
let fracX = 0,
  fracY = 0;
export function cubeTexel(x: number, y: number, z: number, size: number) {
  const worldX = x;
  x = 0.155 * worldX - 0.988 * y;
  y = 0.988 * worldX + 0.155 * y;
  const ax = Math.abs(x),
    ay = Math.abs(y),
    az = Math.abs(z);
  let face, u, v, d;
  if (ax >= ay && ax >= az) {
    face = x >= 0 ? 0 : 1;
    d = ax;
    u = x >= 0 ? y : -y;
    v = -z;
  } else if (ay >= az) {
    face = y >= 0 ? 2 : 3;
    d = ay;
    u = y >= 0 ? -x : x;
    v = -z;
  } else {
    face = z >= 0 ? 4 : 5;
    d = az;
    u = x;
    v = z >= 0 ? y : -y;
  }
  const scale = (size * 0.5) / Math.max(d, 1e-8),
    half = size * 0.5;
  const sx = Math.max(0, Math.min(size - 1.00001, u * scale + half - 0.5));
  const sy = Math.max(0, Math.min(size - 1.00001, v * scale + half - 0.5));
  const col = sx | 0,
    row = sy | 0;
  fracX = sx - col;
  fracY = sy - row;
  return (face * size + row) * size + col;
}

export function backgroundColor(x: number, y: number, z: number) {
  const i = cubeTexel(x, y, z, backdropSize),
    u = fracX,
    v = fracY;
  const a = backdrop[i],
    b = backdrop[i + 1],
    c = backdrop[i + backdropSize],
    d = backdrop[i + backdropSize + 1];
  const c0 = (1 - u) * (1 - v),
    c1 = u * (1 - v),
    c2 = (1 - u) * v,
    c3 = u * v;
  const r =
    ((a & 255) * c0 + (b & 255) * c1 + (c & 255) * c2 + (d & 255) * c3 + 0.5) |
    0;
  const g =
    (((a >> 8) & 255) * c0 +
      ((b >> 8) & 255) * c1 +
      ((c >> 8) & 255) * c2 +
      ((d >> 8) & 255) * c3 +
      0.5) |
    0;
  const blue =
    ((a >> 16) * c0 + (b >> 16) * c1 + (c >> 16) * c2 + (d >> 16) * c3 + 0.5) |
    0;
  return r | (g << 8) | (blue << 16);
}
export function sampleLobe(
  map: Float32Array,
  size: number,
  x: number,
  y: number,
  z: number,
  target: Float32Array,
) {
  const i = cubeTexel(x, y, z, size) * 3,
    u = fracX,
    v = fracY;
  const c0 = (1 - u) * (1 - v),
    c1 = u * (1 - v),
    c2 = (1 - u) * v,
    c3 = u * v,
    step = size * 3;
  for (let channel = 0; channel < 3; channel++) {
    const k = i + channel;
    target[channel] =
      map[k] * c0 +
      map[k + 3] * c1 +
      map[k + step] * c2 +
      map[k + step + 3] * c3;
  }
}
