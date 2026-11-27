import { encode } from "base64-arraybuffer";

const crcTable = Uint32Array.from({ length: 256 }, (_, i) => {
  let c = i;
  for (let bit = 0; bit < 8; bit++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  return c;
});

// Truecolor PNG with stored DEFLATE blocks. iOS and Android's built-in image views
// can display the framebuffer without adding native code to the installed client.
export function framePng(width: number, height: number, pixels: Uint8Array) {
  const rowBytes = width * 3;
  const stride = rowBytes + 1;
  const rawLength = stride * height;
  const blockCount = Math.ceil(rawLength / 65535);
  const dataLength = 6 + blockCount * 5 + rawLength;
  const bytes = new Uint8Array(8 + 25 + 12 + dataLength + 12);
  const view = new DataView(bytes.buffer);
  let pos = 0;
  function push(data: Uint8Array | number[]) {
    bytes.set(data, pos);
    pos += data.length;
  }
  function word(value: number) {
    view.setUint32(pos, value);
    pos += 4;
  }
  function begin(type: string, length: number) {
    word(length);
    const start = pos;
    for (let i = 0; i < 4; i++) bytes[pos++] = type.charCodeAt(i);
    return start;
  }
  function end(start: number) {
    let c = 0xffffffff;
    for (let i = start; i < pos; i++)
      c = (c >>> 8) ^ crcTable[(c ^ bytes[i]) & 255];
    word((c ^ 0xffffffff) >>> 0);
  }
  push([137, 80, 78, 71, 13, 10, 26, 10]);
  let chunk = begin("IHDR", 13);
  word(width);
  word(height);
  push([8, 2, 0, 0, 0]);
  end(chunk);
  chunk = begin("IDAT", dataLength);
  push([0x78, 0x01]);
  let raw = 0,
    a = 1,
    b = 0;
  for (let block = 0; block < blockCount; block++) {
    const n = Math.min(rawLength - raw, 65535);
    push([
      block === blockCount - 1 ? 1 : 0,
      n & 255,
      n >>> 8,
      ~n & 255,
      (~n >>> 8) & 255,
    ]);
    for (let j = 0; j < n;) {
      const y = Math.floor(raw / stride),
        x = raw - y * stride;
      if (x === 0) {
        bytes[pos++] = 0;
        b += a;
        raw++;
        j++;
        continue;
      }
      const count = Math.min(n - j, stride - x);
      const start = y * rowBytes + x - 1;
      bytes.set(pixels.subarray(start, start + count), pos);
      pos += count;
      for (let k = start; k < start + count; k++) {
        a += pixels[k];
        b += a;
      }
      a %= 65521;
      b %= 65521;
      raw += count;
      j += count;
    }
  }
  word(((b % 65521) * 65536 + a) >>> 0);
  end(chunk);
  chunk = begin("IEND", 0);
  end(chunk);
  return "data:image/png;base64," + encode(bytes.buffer);
}
