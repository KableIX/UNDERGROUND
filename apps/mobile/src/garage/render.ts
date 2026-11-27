import { decode } from "base64-arraybuffer";
import { defaultBuilds, paints, type Car, type Spec } from "./builds";
import sto from "../../assets/garage/sto-surface.json";
import r8 from "../../assets/garage/r8-surface.json";
import uv from "../../assets/garage/sto-uv.json";
import finishes from "../../assets/garage/sto-finishes.json";
import occlusion from "../../assets/garage/garage-occlusion.json";
import { framePng } from "./indexed-png";
import {
  inflate,
  backgroundColor,
  sampleLobe,
  cubeTexel,
  diffuseField,
  glossField,
  satinField,
} from "./studio-light";

import { limit, type Camera } from "./camera";
export { homeCamera, limit, type Camera } from "./camera";
function unpack(data: typeof r8, visibility: string, wide = false) {
  const position = Float32Array.from(
    new Int16Array(decode(data.position)),
    (v) => v / 4096,
  );
  const normal = Float32Array.from(
    new Int8Array(decode(data.normal)),
    (v) => v / 126,
  );
  const material = new Uint8Array(decode(data.material));
  const indices = wide
    ? new Uint32Array(decode(data.index))
    : new Uint16Array(decode(data.index));
  const ao = new Uint8Array(decode(visibility));
  if (ao.length !== material.length)
    throw new Error("Mismatched garage mesh and occlusion");
  return { position, normal, material, indices, ao };
}
const meshes = {
  r8: unpack(r8, occlusion.r8),
  sto: unpack(sto, occlusion.sto, uv.index32),
};
type Mesh = typeof meshes.r8;
const stoUv = new Uint16Array(decode(uv.coord)),
  stoLayer = new Uint8Array(decode(uv.layer));
const albedo = inflate(finishes.atlas, 12 * 256 * 256 * 3);
const linear = Float32Array.from(
  { length: 256 },
  (_, i) => ((i / 255 + 0.055) / 1.055) ** 2.4,
);
const srgbToLinear = (s: number) => ((s / 255 + 0.055) / 1.055) ** 2.4;
const toneMap = Uint8Array.from({ length: 32768 }, (_, i) => {
  const v = i / 2048;
  return Math.round(
    255 *
      Math.min(
        1,
        ((v * (2.51 * v + 0.03)) / (v * (2.43 * v + 0.59) + 0.14)) ** (1 / 2.2),
      ),
  );
});
function display(v: number) {
  return toneMap[Math.min(32767, Math.max(0, (v * 2048) | 0))];
}

// Linear diffuse reflectance, normal-incidence specular reflectance and lobe softness.
const materials = [
  [0.02, 0.02, 0.025, 0.046, 0.24],
  [0.02, 0.021, 0.024, 0.05, 0.64],
  [0.009, 0.013, 0.016, 0.053, 0.18],
  [0.073, 0.08, 0.09, 0.52, 0.32],
  [0.036, 0.036, 0.038, 0.026, 0.93],
  [0.038, 0.043, 0.046, 0.09, 0.38],
  [0.015, 0.018, 0.022, 0.045, 0.7],
  [0.56, 0.012, 0.018, 0.13, 0.13],
  [0.66, 0.73, 0.76, 0.62, 0.18],
  [0.12, 0.13, 0.14, 0.12, 0.28],
  [0.071, 0.076, 0.085, 0.39, 0.59],
  [0.026, 0.027, 0.029, 0.27, 0.59],
  [0.15, 0.16, 0.18, 0.72, 0.29],
  [0.13, 0.14, 0.16, 0.74, 0.28],
  [0.028, 0.034, 0.04, 0.07, 0.35],
  [0.03, 0.034, 0.043, 0.07, 0.35],
  [0.14, 0.14, 0.15, 0.55, 0.63],
  [0.033, 0.037, 0.042, 0.094, 0.36],
  [0.075, 0.079, 0.081, 0.3, 0.68],
  [0.37, 0.014, 0.012, 0.06, 0.29],
];
function getProjection(w: number, h: number, c: Camera, mesh: Mesh) {
  const sn = Math.sin(c.yaw),
    cs = Math.cos(c.yaw),
    sp = Math.sin(c.pitch),
    cp = Math.cos(c.pitch);
  const dist = 6.45 / c.zoom,
    cx = sn * cp * dist,
    cy = -cs * cp * dist,
    cz = 0.62 + sp * dist;
  let focal = Math.min(w * 1.53, h * 1.78);
  // Fit the actual silhouette, including accessory geometry at close zoom.
  const xyz = mesh.position;
  for (let i = 0; i < xyz.length; i += 3) {
    const x = xyz[i] - cx,
      y = xyz[i + 1] - cy,
      z = xyz[i + 2] - cz,
      forward = -sn * cp * x + cs * cp * y - sp * z;
    focal = Math.min(
      focal,
      (w * 0.463 * forward) / Math.max(0.001, Math.abs(cs * x + sn * y)),
      (h * 0.432 * forward) /
        Math.max(0.001, Math.abs(-sn * sp * x + cs * sp * y + cp * z)),
    );
  }
  return { sn, cs, sp, cp, cx, cy, cz, focal };
}
type Projection = ReturnType<typeof getProjection>;
function visibleMaterial(m: number, spec: Spec) {
  if (m === 10) return spec.wheels === "factory";
  if (m === 11 || m === 16) return spec.wheels !== "factory";
  if (m === 12) return spec.wheels === "five";
  if (m === 13) return spec.wheels === "split";
  if (m === 14) return spec.aero !== "factory";
  if (m === 15) return spec.aero === "track";
  return true;
}
function geometry(
  w: number,
  h: number,
  cam: Projection,
  mesh: Mesh,
  spec: Spec,
  transparent: boolean,
) {
  const { sn, cs, sp, cp, cx, cy, cz, focal } = cam;
  const { position, material, indices } = mesh;
  const sx = new Float32Array(material.length),
    sy = new Float32Array(material.length),
    iz = new Float32Array(material.length);
  for (let i = 0; i < material.length; i++) {
    const k = i * 3,
      x = position[k] - cx,
      y = position[k + 1] - cy,
      z = position[k + 2] - cz;
    iz[i] = 1 / (-sn * cp * x + cs * cp * y - sp * z);
    sx[i] = w * 0.5 + (cs * x + sn * y) * focal * iz[i];
    sy[i] = h * 0.53 - (-sn * sp * x + cs * sp * y + cp * z) * focal * iz[i];
  }
  const depth = new Float32Array(w * h),
    face = new Int32Array(w * h),
    weightB = new Float32Array(w * h),
    weightC = new Float32Array(w * h);
  face.fill(-1);
  const glassDepth = new Float32Array(transparent ? w * h : 0),
    glassFace = new Int32Array(transparent ? w * h : 0);
  const glassB = new Float32Array(transparent ? w * h : 0),
    glassC = new Float32Array(transparent ? w * h : 0);
  glassFace.fill(-1);
  for (let t = 0; t < indices.length; t += 3) {
    const a = indices[t],
      b = indices[t + 1],
      c = indices[t + 2];
    if (!visibleMaterial(material[a], spec)) continue;
    const glass = transparent && material[a] === 2;
    const zBuffer = glass ? glassDepth : depth,
      faces = glass ? glassFace : face;
    const weightsB = glass ? glassB : weightB,
      weightsC = glass ? glassC : weightC;
    const ax = sx[a],
      ay = sy[a],
      bx = sx[b],
      by = sy[b],
      cx2 = sx[c],
      cy2 = sy[c];
    const dx1 = bx - ax,
      dy1 = by - ay,
      dx2 = cx2 - ax,
      dy2 = cy2 - ay,
      area = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(area) < 0.015) continue;
    const left = Math.max(0, Math.ceil(Math.min(ax, bx, cx2) - 0.5)),
      right = Math.min(w - 1, Math.floor(Math.max(ax, bx, cx2) - 0.5));
    const top = Math.max(0, Math.ceil(Math.min(ay, by, cy2) - 0.5)),
      bottom = Math.min(h - 1, Math.floor(Math.max(ay, by, cy2) - 0.5));
    const ux = dy2 / area,
      uy = -dx2 / area,
      vx = -dy1 / area,
      vy = dx1 / area;
    const dz1 = iz[b] - iz[a],
      dz2 = iz[c] - iz[a];
    for (let y = top; y <= bottom; y++) {
      let u = (left + 0.5 - ax) * ux + (y + 0.5 - ay) * uy,
        v = (left + 0.5 - ax) * vx + (y + 0.5 - ay) * vy;
      for (let x = left; x <= right; x++, u += ux, v += vx) {
        if (u < 0 || v < 0 || u + v > 1) continue;
        const z = iz[a] + u * dz1 + v * dz2,
          off = y * w + x;
        if (z <= zBuffer[off]) continue;
        zBuffer[off] = z;
        faces[off] = t;
        weightsB[off] = (u * iz[b]) / z;
        weightsC[off] = (v * iz[c]) / z;
      }
    }
  }
  return {
    face,
    weightB,
    weightC,
    depth,
    glassDepth,
    glassFace,
    glassB,
    glassC,
  };
}
// Intersect the same walls, ceiling and floor used to project the HDR environment.
// This keeps the reflected window frames and the overhead light fixtures aligned.
function roomDistance(
  px: number,
  py: number,
  pz: number,
  dx: number,
  dy: number,
  dz: number,
) {
  return Math.min(
    dx === 0 ? Infinity : ((dx > 0 ? 17 : -17) - px) / dx,
    dy === 0 ? Infinity : ((dy > 0 ? 25 : -25) - py) / dy,
    dz === 0 ? Infinity : ((dz > 0 ? 5.7 : 0) - pz) / dz,
  );
}
// The reference meshes carry tinted window surfaces. Model the first visible
// dashboard, seat or rear deck beneath the glass instead of making it a chrome panel.
function cabinLight(
  px: number,
  py: number,
  pz: number,
  dx: number,
  dy: number,
  dz: number,
) {
  let light = 0.003;
  if (dz < -0.006) {
    const t = (0.735 - pz) / dz;
    const x = px + t * dx,
      y = py + t * dy;
    if (t > 0 && Math.abs(x) < 0.76 && y > -0.98 && y < -0.34) {
      const vent = Math.abs(x) > 0.44 && y < -0.57 && y > -0.68;
      light = vent ? 0.003 : 0.009 + 0.004 * (1 - Math.abs(x));
    }
  }
  if (Math.abs(dy) > 0.02) {
    const t = (0.24 - py) / dy;
    const x = px + t * dx,
      z = pz + t * dz;
    const lateral = Math.abs(Math.abs(x) - 0.36);
    if (t > 0 && lateral < 0.22 && z > 0.57 && z < 1.03) {
      const head = z > 0.88;
      const radius = head ? 0.112 : 0.21;
      const profile =
        ((z - (head ? 0.957 : 0.73)) / (head ? 0.083 : 0.18)) ** 2 +
        (lateral / radius) ** 2;
      if (profile < 1) light = 0.008 + 0.012 * Math.sqrt(1 - profile);
    }
  }
  return light;
}
export function renderGarage(
  w: number,
  h: number,
  camera: Camera,
  warm: boolean,
  car: Car = "r8",
  spec: Spec = defaultBuilds.builds[car],
) {
  const mesh = meshes[car],
    cam = getProjection(w, h, camera, mesh);
  const { sn, cs, sp, cp, cx, cy, cz, focal } = cam;
  const { indices, material, normal, ao } = mesh;
  const {
    face,
    weightB,
    weightC,
    depth,
    glassDepth,
    glassFace,
    glassB,
    glassC,
  } = geometry(w, h, cam, mesh, spec, car === "sto");
  const rgb = new Uint8Array(w * h * 3);
  const sharp = new Float32Array(3),
    soft = new Float32Array(3);
  const body = paints[spec.paint].rgb.map(srgbToLinear);
  const redGain = warm ? 1.12 : 1,
    blueGain = warm ? 0.84 : 1;
  for (let y = 0; y < h; y++) {
    const up = (h * 0.53 - y - 0.5) / focal,
      dz = -sp + cp * up;
    const rowX = -sn * (cp + sp * up),
      rowY = cs * (cp + sp * up);
    for (let x = 0; x < w; x++) {
      const off = y * w + x,
        j = off * 3,
        right = (x + 0.5 - w * 0.5) / focal;
      const dx = rowX + cs * right,
        dy = rowY + sn * right,
        t = face[off];
      if (t < 0) {
        const distance = roomDistance(cx, cy, cz, dx, dy, dz);
        const px = cx + dx * distance,
          py = cy + dy * distance,
          pz = cz + dz * distance;
        // Far walls use the captured perspective. Parallax grows gradually toward
        // the nearby floor, avoiding a bend where a proxy wall meets the slab.
        const fall = limit((-dz - 0.4) / 0.33, 0, 1);
        const blend = fall * fall * (3 - 2 * fall);
        const ground = dz < 0 ? -cz / dz : 1;
        const gx = cx + dx * ground,
          gy = cy + dy * ground,
          gz = -1.65;
        const sl = 1 / Math.sqrt(gx * gx + gy * gy + gz * gz);
        const vl = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
        const pixel = backgroundColor(
          dx * vl * (1 - blend) + gx * sl * blend,
          dy * vl * (1 - blend) + gy * sl * blend,
          dz * vl * (1 - blend) + gz * sl * blend,
        );
        let shadow = 1;
        if (pz < 0.001) {
          const ex = Math.max(0, Math.abs(px) - 0.48),
            ey = Math.max(0, Math.abs(py) - 1.2);
          const bodyShadow = 1 / (1 + 3.6 * ex * ex + 3.3 * ey * ey);
          const wheel =
            (Math.abs(px) - 0.87) ** 2 * 43 +
            (py - (py < 0 ? -1.2 : 1.42)) ** 2 * 23;
          const cast =
            1 /
            (1 +
              2.6 * Math.max(0, Math.abs(px + 0.16) - 0.64) ** 2 +
              1.8 * Math.max(0, Math.abs(py - 0.18) - 1.43) ** 2);
          shadow = Math.max(
            0.11,
            1 -
              0.39 * bodyShadow * bodyShadow -
              0.32 * cast * cast -
              0.26 / (1 + wheel * wheel),
          );
        }
        rgb[j] = Math.min(255, (pixel & 255) * shadow * (warm ? 1.045 : 1));
        rgb[j + 1] = ((pixel >> 8) & 255) * shadow;
        rgb[j + 2] = (pixel >> 16) * shadow * (warm ? 0.91 : 1);
        continue;
      }
      const b = weightB[off],
        c = weightC[off],
        a = 1 - b - c;
      const ia = indices[t],
        ib = indices[t + 1],
        ic = indices[t + 2],
        ka = ia * 3,
        kb = ib * 3,
        kc = ic * 3;
      const hit = 1 / depth[off],
        px = cx + dx * hit,
        py = cy + dy * hit,
        pz = cz + dz * hit;
      let m = material[ia];
      const hood =
        m === 0 &&
        spec.carbon === "hood" &&
        py < -0.66 &&
        pz > 0.45 &&
        Math.abs(px) < 0.7;
      const trim =
        spec.carbon === "lower" &&
        (m === 0 || m === 5 || m === 14 || m === 15) &&
        (pz < 0.44 || m >= 14);
      if (hood || trim) m = 17;
      const mat = materials[m];
      let nx = a * normal[ka] + b * normal[kb] + c * normal[kc],
        ny = a * normal[ka + 1] + b * normal[kb + 1] + c * normal[kc + 1],
        nz = a * normal[ka + 2] + b * normal[kb + 2] + c * normal[kc + 2];
      const length = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz || 1);
      nx *= length;
      ny *= length;
      nz *= length;
      const vl = -1 / Math.sqrt(dx * dx + dy * dy + dz * dz),
        vx = dx * vl,
        vy = dy * vl,
        vz = dz * vl;
      let nDotV = nx * vx + ny * vy + nz * vz;
      if (nDotV < 0) {
        nx = -nx;
        ny = -ny;
        nz = -nz;
        nDotV = -nDotV;
      }
      const rx = 2 * nDotV * nx - vx,
        ry = 2 * nDotV * ny - vy,
        rz = 2 * nDotV * nz - vz;
      const dist = roomDistance(px, py, pz, rx, ry, rz);
      const ex = px + dist * rx,
        ey = py + dist * ry,
        ez = pz + dist * rz - 1.65;
      sampleLobe(glossField, 128, ex, ey, ez, sharp);
      sampleLobe(satinField, 64, ex, ey, ez, soft);
      const hemi = cubeTexel(nx, ny, nz, 24) * 3;
      const visibility = (ao[ia] * a + ao[ib] * b + ao[ic] * c) / 255;
      const rough = mat[4],
        f0 = mat[3],
        fresnel = f0 + (0.49 - f0) * (1 - Math.min(1, nDotV)) ** 5;
      const specular = fresnel * (0.23 + 0.77 * visibility);
      const diffuse = (0.25 + 0.75 * visibility) * 2.1;
      // Broad studio bounce gradients sit underneath the crisp clearcoat reflections.
      const skyFill = 0.28 + 0.63 * Math.max(0, nz) + 0.17 * Math.max(0, -ny);
      const shoulder = Math.max(0, 1 - Math.abs(rz - 0.46) * 1.55);
      const softbox =
        (0.18 + 0.9 * shoulder * shoulder) * (0.48 + 0.52 * Math.abs(rx));
      const fill =
        m === 0 ? 0.032 : m === 1 || m === 17 ? 0.021 : m === 2 ? 0.01 : 0;
      const weave =
        m === 5 || m === 17
          ? 0.88 +
            0.12 * Math.sin(180 * (px + py)) * Math.sin(174 * (py - px + pz))
          : 1;
      let brakeFinish = 1;
      if (m === 18) {
        const yy = py - (py > 0 ? 1.417 : -1.205),
          zz = pz - 0.318;
        const radius = Math.hypot(yy, zz),
          angle = Math.atan2(zz, yy);
        const holes =
          Math.abs(Math.sin(angle * 15 + radius * 48)) < 0.16 &&
          Math.abs(Math.sin(radius * 146)) < 0.36;
        brakeFinish = holes ? 0.18 : 0.84 + 0.07 * Math.sin(radius * 1250);
      }
      const pigment = m === 0 ? body : mat;
      let texel = -1,
        primaryPaint = false;
      if (car === "sto" && stoLayer[ia] !== 255 && m !== 17) {
        const u =
          (a * stoUv[ia * 2] + b * stoUv[ib * 2] + c * stoUv[ic * 2]) / 65535;
        const v =
          (a * stoUv[ia * 2 + 1] +
            b * stoUv[ib * 2 + 1] +
            c * stoUv[ic * 2 + 1]) /
          65535;
        texel =
          ((stoLayer[ia] * 256 + (((v * 256) | 0) % 256)) * 256 +
            (((u * 256) | 0) % 256)) *
          3;
        primaryPaint =
          m === 0 &&
          albedo[texel + 2] > albedo[texel] * 1.25 &&
          albedo[texel + 2] > 48;
      }
      const cabin =
        m === 2 && Math.abs(px) < 0.89 && py < 0.67
          ? cabinLight(px, py, pz, dx, dy, dz)
          : 0;
      for (let channel = 0; channel < 3; channel++) {
        const lighting = sharp[channel] * (1 - rough) + soft[channel] * rough;
        const reflected = lighting * specular;
        let color = pigment[channel] * brakeFinish;
        if (texel >= 0) {
          color = primaryPaint
            ? body[channel] * (0.35 + 0.65 * linear[albedo[texel + 2]])
            : linear[albedo[texel + channel]];
        }
        const lit =
          color * weave * diffuse * (skyFill + diffuseField[hemi + channel]) +
          fill * softbox * (0.5 + 0.5 * visibility) +
          cabin;
        const emitted =
          m === 8
            ? texel >= 0
              ? 0.35 * linear[albedo[texel + channel]]
              : 0.3
            : m === 7 && channel === 0
              ? 0.045
              : 0;
        rgb[j + channel] = display(
          (lit + reflected + emitted) *
            (channel === 0 ? redGain : channel === 2 ? blueGain : 1),
        );
      }
    }
  }
  if (car === "sto") {
    // Transmit the opaque cabin and lamp optics already rendered behind each window.
    for (let off = 0; off < glassFace.length; off++) {
      const t = glassFace[off];
      if (t < 0 || glassDepth[off] <= depth[off] + 0.00001) continue;
      const a = indices[t] * 3,
        b = indices[t + 1] * 3,
        c = indices[t + 2] * 3;
      const wb = glassB[off],
        wc = glassC[off],
        wa = 1 - wb - wc;
      let nx = wa * normal[a] + wb * normal[b] + wc * normal[c];
      let ny = wa * normal[a + 1] + wb * normal[b + 1] + wc * normal[c + 1];
      let nz = wa * normal[a + 2] + wb * normal[b + 2] + wc * normal[c + 2];
      const nl = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz || 1);
      nx *= nl;
      ny *= nl;
      nz *= nl;
      const y = (off / w) | 0,
        x = off - y * w,
        up = (h * 0.53 - y - 0.5) / focal,
        right = (x + 0.5 - w * 0.5) / focal;
      const dx = -sn * (cp + sp * up) + cs * right,
        dy = cs * (cp + sp * up) + sn * right,
        dz = -sp + cp * up;
      const vl = -1 / Math.sqrt(dx * dx + dy * dy + dz * dz),
        vx = dx * vl,
        vy = dy * vl,
        vz = dz * vl;
      const ndv = nx * vx + ny * vy + nz * vz,
        rx = 2 * ndv * nx - vx,
        ry = 2 * ndv * ny - vy,
        rz = 2 * ndv * nz - vz;
      const z = 1 / glassDepth[off],
        px = cx + z * dx,
        py = cy + z * dy,
        pz = cz + z * dz;
      const d = roomDistance(px, py, pz, rx, ry, rz);
      sampleLobe(
        glossField,
        128,
        px + d * rx,
        py + d * ry,
        pz + d * rz - 1.65,
        sharp,
      );
      const fresnel = 0.045 + 0.75 * (1 - Math.min(1, Math.abs(ndv))) ** 5;
      for (let ch = 0; ch < 3; ch++) {
        const transmitted =
          rgb[off * 3 + ch] *
          (Math.abs(py) > 1.5 ? 0.92 : 0.76) *
          (1 - fresnel);
        const reflection = display(
          sharp[ch] * (ch === 0 ? redGain : ch === 2 ? blueGain : 1) * fresnel,
        );
        rgb[off * 3 + ch] = Math.min(255, Math.hypot(transmitted, reflection));
      }
    }
  }
  return framePng(w, h, rgb);
}
